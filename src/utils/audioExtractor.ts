/**
 * Audio extraction and intelligent chunking utilities for Khmer Subtitle AI.
 * Handles MP4, MOV, WebM, and MKV directly in the browser using Web Audio API.
 */

export interface AudioChunk {
  index: number;
  total: number;
  startTime: number;
  endTime: number;
  duration: number;
  audioBase64: string;
  mimeType: string;
}

/**
 * Encodes Float32Array PCM samples into standard 16-bit mono RIFF/WAV format
 */
export function encodeWAV(samples: Float32Array, sampleRate: number = 16000): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM) */
  view.setUint16(20, 1, true);
  /* channel count (mono) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sampleRate * 2) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  // Write PCM 16-bit samples
  floatTo16BitPCM(view, 44, samples);

  return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

/**
 * Converts ArrayBuffer to Base64 safely without stack overflow
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 0x8000; // 32KB chunks to avoid call stack limits

  for (let i = 0; i < len; i += chunkSize) {
    const subarray = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, subarray as unknown as number[]);
  }

  return btoa(binary);
}

/**
 * Resamples audio buffer to 16,000 Hz mono
 */
export function downsampleTo16kMono(audioBuffer: AudioBuffer): Float32Array {
  const targetRate = 16000;
  const numChannels = audioBuffer.numberOfChannels;
  const originalLength = audioBuffer.length;
  const originalRate = audioBuffer.sampleRate;

  // Mix channels down to mono
  const mono = new Float32Array(originalLength);
  for (let c = 0; c < numChannels; c++) {
    const channelData = audioBuffer.getChannelData(c);
    for (let i = 0; i < originalLength; i++) {
      mono[i] += channelData[i] / numChannels;
    }
  }

  if (originalRate === targetRate) {
    return mono;
  }

  // Linear interpolation downsampling
  const targetLength = Math.round((originalLength * targetRate) / originalRate);
  const result = new Float32Array(targetLength);
  const ratio = originalRate / targetRate;

  for (let i = 0; i < targetLength; i++) {
    const originPos = i * ratio;
    const indexFloor = Math.floor(originPos);
    const indexCeil = Math.min(originalLength - 1, Math.ceil(originPos));
    const weight = originPos - indexFloor;
    result[i] = mono[indexFloor] * (1 - weight) + mono[indexCeil] * weight;
  }

  return result;
}

/**
 * Scans for low-energy (silence/pause) windows near target split points
 * to avoid splitting audio in the middle of a spoken Khmer phrase.
 */
function findNaturalPause(
  samples: Float32Array,
  targetSample: number,
  searchWindowSamples: number,
  sampleRate: number
): number {
  const minSample = Math.max(0, targetSample - searchWindowSamples);
  const maxSample = Math.min(samples.length - 1, targetSample + searchWindowSamples);

  let bestSample = targetSample;
  let minEnergy = Infinity;

  // Evaluate energy in 100ms windows
  const windowSize = Math.round(0.1 * sampleRate);

  for (let s = minSample; s < maxSample - windowSize; s += Math.round(0.05 * sampleRate)) {
    let energy = 0;
    for (let w = 0; w < windowSize; w++) {
      const val = samples[s + w];
      energy += val * val;
    }

    if (energy < minEnergy) {
      minEnergy = energy;
      bestSample = s + Math.round(windowSize / 2);
    }
  }

  return bestSample;
}

/**
 * Detects any audio timeline onset silence or container timestamp delay.
 * Returns the offset in seconds where audible sound begins.
 */
export function detectAudioLeadOffset(samples: Float32Array, sampleRate: number = 16000): number {
  const noiseThreshold = 0.0012;
  const windowSize = Math.round(0.005 * sampleRate); // 5ms windows
  const maxSearch = Math.min(samples.length - windowSize, Math.round(1.0 * sampleRate)); // First 1s

  for (let s = 0; s < maxSearch; s += windowSize) {
    let sum = 0;
    for (let w = 0; w < windowSize; w++) {
      const v = samples[s + w];
      sum += v * v;
    }
    const rms = Math.sqrt(sum / windowSize);
    if (rms > noiseThreshold) {
      return Math.round((s / sampleRate) * 1000) / 1000;
    }
  }
  return 0;
}

/**
 * Extracts and divides audio from a video File into speech-aligned chunks.
 * Target chunk duration is 40-50 seconds.
 */
export async function extractAndChunkAudio(
  file: File,
  targetChunkDurationSec: number = 45,
  onProgress?: (percent: number, statusText: string) => void
): Promise<{
  chunks: AudioChunk[];
  totalDuration: number;
  hasAudio: boolean;
  audioOffset: number;
}> {
  onProgress?.(10, 'Reading video file for audio track...');

  const arrayBuffer = await file.arrayBuffer();
  onProgress?.(30, 'Decoding audio track with Web Audio API...');

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (err) {
    await audioCtx.close();
    throw new Error('Could not decode audio from this video file. Ensure the video contains a valid audio track.');
  }

  await audioCtx.close();

  const totalDuration = audioBuffer.duration;
  if (totalDuration <= 0) {
    return { chunks: [], totalDuration: 0, hasAudio: false, audioOffset: 0 };
  }

  onProgress?.(50, 'Resampling to 16kHz mono and calibrating audio timeline...');
  const samples16k = downsampleTo16kMono(audioBuffer);

  // Audio offset calibration (Rule 5 & 6):
  // Web Audio API decodeAudioData decodes strictly from container timestamp 0.000s.
  // The extraction timeline offset is 0.000s. (Never add speech onset silence as an offset,
  // as the speech detector already timestamps words relative to audio start).
  const audioOffset = 0.0;

  // Check if audio has sound (RMS check)
  let sumSq = 0;
  const testSampleCount = Math.min(samples16k.length, 16000 * 10);
  for (let i = 0; i < testSampleCount; i++) {
    sumSq += samples16k[i] * samples16k[i];
  }
  const rms = Math.sqrt(sumSq / testSampleCount);
  const hasAudio = rms > 0.001;

  onProgress?.(70, 'Detecting speech boundaries & natural pauses...');

  const sampleRate = 16000;
  const splitPoints: number[] = [0];

  const targetSamplesPerChunk = targetChunkDurationSec * sampleRate;
  const searchWindowSamples = Math.round(6.0 * sampleRate); // +/- 6 seconds search window

  let currentSample = 0;
  while (currentSample + targetSamplesPerChunk < samples16k.length) {
    const rawTarget = currentSample + targetSamplesPerChunk;
    const naturalCut = findNaturalPause(samples16k, rawTarget, searchWindowSamples, sampleRate);
    splitPoints.push(naturalCut);
    currentSample = naturalCut;
  }
  splitPoints.push(samples16k.length);

  onProgress?.(85, 'Packaging audio chunks...');

  const chunks: AudioChunk[] = [];
  const totalChunks = splitPoints.length - 1;

  for (let i = 0; i < totalChunks; i++) {
    const startSample = splitPoints[i];
    const endSample = splitPoints[i + 1];
    const chunkSamples = samples16k.subarray(startSample, endSample);

    const startTime = startSample / sampleRate;
    const endTime = endSample / sampleRate;
    const duration = endTime - startTime;

    const wavBuffer = encodeWAV(chunkSamples, sampleRate);
    const audioBase64 = arrayBufferToBase64(wavBuffer);

    chunks.push({
      index: i,
      total: totalChunks,
      startTime,
      endTime,
      duration,
      audioBase64,
      mimeType: 'audio/wav',
    });
  }

  onProgress?.(100, 'Audio extraction and intelligent chunking complete');

  return {
    chunks,
    totalDuration,
    hasAudio,
    audioOffset,
  };
}
