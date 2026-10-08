import { SubtitleSegment } from '../types/subtitles';
import { normalizeKhmerSubtitleText } from './srtFormatter';

export interface SampleVideoOption {
  id: string;
  title: string;
  category: string;
  duration: number;
  description: string;
  segments: SubtitleSegment[];
}

const RAW_SAMPLE_VIDEOS: SampleVideoOption[] = [
  {
    id: 'sample-cafe',
    title: 'Phnom Penh Cafe Vlog & Coffee Review',
    category: 'Food & Vlog (TikTok / Reels)',
    duration: 22,
    description: 'Conversational Khmer with coffee terminology (Latte, Creamy, Brown Coffee).',
    segments: [
      {
        id: 1,
        start: 0.82,
        end: 1.95,
        text: 'សួស្តី បងប្អូន',
        confidence: 99,
        timingScore: 98,
        speechOnset: 0.85,
        speechOffset: 1.88,
        speaker: 'Speaker 1',
        words: [
          { word: 'សួស្តី', start: 0.85, end: 1.32, confidence: 99 },
          { word: 'បងប្អូន', start: 1.36, end: 1.88, confidence: 99 },
        ],
      },
      {
        id: 2,
        start: 2.05,
        end: 2.95,
        text: 'ទាំងអស់គ្នា',
        confidence: 98,
        timingScore: 97,
        speechOnset: 2.08,
        speechOffset: 2.88,
        speaker: 'Speaker 1',
        words: [{ word: 'ទាំងអស់គ្នា', start: 2.08, end: 2.88, confidence: 98 }],
      },
      {
        id: 3,
        start: 3.05,
        end: 4.15,
        text: 'ថ្ងៃនេះ ខ្ញុំមក',
        confidence: 97,
        timingScore: 98,
        speechOnset: 3.08,
        speechOffset: 4.08,
        speaker: 'Speaker 1',
        words: [
          { word: 'ថ្ងៃនេះ', start: 3.08, end: 3.55, confidence: 97 },
          { word: 'ខ្ញុំមក', start: 3.60, end: 4.08, confidence: 98 },
        ],
      },
      {
        id: 4,
        start: 4.25,
        end: 5.45,
        text: 'សាកកាហ្វេ ថ្មី',
        confidence: 96,
        timingScore: 97,
        speechOnset: 4.28,
        speechOffset: 5.38,
        speaker: 'Speaker 1',
        words: [
          { word: 'សាកកាហ្វេ', start: 4.28, end: 4.90, confidence: 96 },
          { word: 'ថ្មី', start: 4.95, end: 5.38, confidence: 97 },
        ],
      },
      {
        id: 5,
        start: 5.55,
        end: 6.75,
        text: 'នៅភ្នំពេញ',
        confidence: 98,
        timingScore: 99,
        speechOnset: 5.58,
        speechOffset: 6.68,
        speaker: 'Speaker 1',
        words: [{ word: 'នៅភ្នំពេញ', start: 5.58, end: 6.68, confidence: 98 }],
      },
      {
        id: 6,
        start: 7.02,
        end: 8.35,
        text: 'ហាងនេះ មានឈ្មោះថា',
        confidence: 95,
        timingScore: 97,
        speechOnset: 7.05,
        speechOffset: 8.28,
        speaker: 'Speaker 1',
        words: [
          { word: 'ហាងនេះ', start: 7.05, end: 7.55, confidence: 95 },
          { word: 'មានឈ្មោះថា', start: 7.60, end: 8.28, confidence: 96 },
        ],
      },
      {
        id: 7,
        start: 8.45,
        end: 9.55,
        text: 'Brown Coffee',
        confidence: 99,
        timingScore: 98,
        speechOnset: 8.48,
        speechOffset: 9.48,
        speaker: 'Speaker 1',
        words: [
          { word: 'Brown', start: 8.48, end: 8.92, confidence: 99 },
          { word: 'Coffee', start: 8.96, end: 9.48, confidence: 99 },
        ],
      },
      {
        id: 8,
        start: 9.82,
        end: 11.15,
        text: 'ហើយកាហ្វេ គាត់',
        confidence: 96,
        timingScore: 97,
        speechOnset: 9.85,
        speechOffset: 11.08,
        speaker: 'Speaker 1',
        words: [
          { word: 'ហើយកាហ្វេ', start: 9.85, end: 10.50, confidence: 96 },
          { word: 'គាត់', start: 10.55, end: 11.08, confidence: 97 },
        ],
      },
      {
        id: 9,
        start: 11.22,
        end: 12.75,
        text: 'គឺឈ្ងុយ ខ្លាំងមែនទែន',
        confidence: 97,
        timingScore: 98,
        speechOnset: 11.25,
        speechOffset: 12.68,
        speaker: 'Speaker 1',
        words: [
          { word: 'គឺឈ្ងុយ', start: 11.25, end: 11.85, confidence: 97 },
          { word: 'ខ្លាំងមែនទែន', start: 11.90, end: 12.68, confidence: 98 },
        ],
      },
      {
        id: 10,
        start: 13.02,
        end: 14.15,
        text: 'រសជាតិ ផ្អែមល្មម',
        confidence: 95,
        timingScore: 98,
        speechOnset: 13.05,
        speechOffset: 14.08,
        speaker: 'Speaker 1',
        words: [
          { word: 'រសជាតិ', start: 13.05, end: 13.55, confidence: 95 },
          { word: 'ផ្អែមល្មម', start: 13.60, end: 14.08, confidence: 96 },
        ],
      },
      {
        id: 11,
        start: 14.25,
        end: 15.45,
        text: 'បែប Creamy',
        confidence: 98,
        timingScore: 99,
        speechOnset: 14.28,
        speechOffset: 15.38,
        speaker: 'Speaker 1',
        words: [
          { word: 'បែប', start: 14.28, end: 14.70, confidence: 98 },
          { word: 'Creamy', start: 14.75, end: 15.38, confidence: 99 },
        ],
      },
      {
        id: 12,
        start: 15.55,
        end: 16.95,
        text: 'ត្រូវចិត្ត អ្នកចូលចិត្ត',
        confidence: 96,
        timingScore: 97,
        speechOnset: 15.58,
        speechOffset: 16.88,
        speaker: 'Speaker 1',
        words: [
          { word: 'ត្រូវចិត្ត', start: 15.58, end: 16.18, confidence: 96 },
          { word: 'អ្នកចូលចិត្ត', start: 16.22, end: 16.88, confidence: 97 },
        ],
      },
      {
        id: 13,
        start: 17.05,
        end: 18.15,
        text: 'Latte ខ្លាំងណាស់',
        confidence: 97,
        timingScore: 98,
        speechOnset: 17.08,
        speechOffset: 18.08,
        speaker: 'Speaker 1',
        words: [
          { word: 'Latte', start: 17.08, end: 17.55, confidence: 97 },
          { word: 'ខ្លាំងណាស់', start: 17.60, end: 18.08, confidence: 98 },
        ],
      },
      {
        id: 14,
        start: 18.42,
        end: 19.75,
        text: 'កុំភ្លេច សាកទាំងអស់គ្នា',
        confidence: 98,
        timingScore: 98,
        speechOnset: 18.45,
        speechOffset: 19.68,
        speaker: 'Speaker 1',
        words: [
          { word: 'កុំភ្លេច', start: 18.45, end: 18.95, confidence: 98 },
          { word: 'សាកទាំងអស់គ្នា', start: 19.00, end: 19.68, confidence: 98 },
        ],
      },
      {
        id: 15,
        start: 19.85,
        end: 21.15,
        text: 'អរគុណ ច្រើន!',
        confidence: 99,
        timingScore: 99,
        speechOnset: 19.88,
        speechOffset: 21.08,
        speaker: 'Speaker 1',
        words: [
          { word: 'អរគុណ', start: 19.88, end: 20.45, confidence: 99 },
          { word: 'ច្រើន!', start: 20.50, end: 21.08, confidence: 99 },
        ],
      },
    ],
  },
  {
    id: 'sample-tech',
    title: 'Khmer Tech Gadget Unboxing',
    category: 'Technology (YouTube Shorts)',
    duration: 26,
    description: 'Tech vocabulary, English loanwords (Unbox, 4K, AI, CapCut, Smartphone).',
    segments: [
      {
        id: 1,
        start: 0.62,
        end: 1.95,
        text: 'ជំរាបសួរ បងប្អូន',
        confidence: 99,
        timingScore: 98,
        speechOnset: 0.65,
        speechOffset: 1.88,
        speaker: 'Speaker 1',
        words: [
          { word: 'ជំរាបសួរ', start: 0.65, end: 1.25, confidence: 99 },
          { word: 'បងប្អូន', start: 1.30, end: 1.88, confidence: 99 },
        ],
      },
      {
        id: 2,
        start: 2.05,
        end: 3.35,
        text: 'ថ្ងៃនេះ យើងមក',
        confidence: 98,
        timingScore: 97,
        speechOnset: 2.08,
        speechOffset: 3.28,
        speaker: 'Speaker 1',
        words: [
          { word: 'ថ្ងៃនេះ', start: 2.08, end: 2.65, confidence: 98 },
          { word: 'យើងមក', start: 2.70, end: 3.28, confidence: 98 },
        ],
      },
      {
        id: 3,
        start: 3.45,
        end: 4.75,
        text: 'Unbox ទូរស័ព្ទថ្មី',
        confidence: 97,
        timingScore: 98,
        speechOnset: 3.48,
        speechOffset: 4.68,
        speaker: 'Speaker 1',
        words: [
          { word: 'Unbox', start: 3.48, end: 4.05, confidence: 98 },
          { word: 'ទូរស័ព្ទថ្មី', start: 4.10, end: 4.68, confidence: 97 },
        ],
      },
      {
        id: 4,
        start: 5.02,
        end: 6.45,
        text: 'កាមេរ៉ា ច្បាស់កម្រិត',
        confidence: 96,
        timingScore: 97,
        speechOnset: 5.05,
        speechOffset: 6.38,
        speaker: 'Speaker 1',
        words: [
          { word: 'កាមេរ៉ា', start: 5.05, end: 5.65, confidence: 96 },
          { word: 'ច្បាស់កម្រិត', start: 5.70, end: 6.38, confidence: 97 },
        ],
      },
      {
        id: 5,
        start: 6.55,
        end: 7.75,
        text: '4K ទំនើប',
        confidence: 99,
        timingScore: 99,
        speechOnset: 6.58,
        speechOffset: 7.68,
        speaker: 'Speaker 1',
        words: [
          { word: '4K', start: 6.58, end: 7.05, confidence: 99 },
          { word: 'ទំនើប', start: 7.10, end: 7.68, confidence: 98 },
        ],
      },
      {
        id: 6,
        start: 8.02,
        end: 9.45,
        text: 'មានមុខងារ AI',
        confidence: 98,
        timingScore: 98,
        speechOnset: 8.05,
        speechOffset: 9.38,
        speaker: 'Speaker 1',
        words: [
          { word: 'មានមុខងារ', start: 8.05, end: 8.75, confidence: 98 },
          { word: 'AI', start: 8.80, end: 9.38, confidence: 99 },
        ],
      },
      {
        id: 7,
        start: 9.55,
        end: 10.75,
        text: 'ថតរូប បានស្អាត',
        confidence: 95,
        timingScore: 97,
        speechOnset: 9.58,
        speechOffset: 10.68,
        speaker: 'Speaker 1',
        words: [
          { word: 'ថតរូប', start: 9.58, end: 10.05, confidence: 95 },
          { word: 'បានស្អាត', start: 10.10, end: 10.68, confidence: 96 },
        ],
      },
      {
        id: 8,
        start: 11.02,
        end: 12.55,
        text: 'តម្លៃ សមរម្យ',
        confidence: 96,
        timingScore: 98,
        speechOnset: 11.05,
        speechOffset: 12.48,
        speaker: 'Speaker 1',
        words: [
          { word: 'តម្លៃ', start: 11.05, end: 11.65, confidence: 96 },
          { word: 'សមរម្យ', start: 11.70, end: 12.48, confidence: 97 },
        ],
      },
      {
        id: 9,
        start: 12.65,
        end: 14.45,
        text: 'ដំណើរការ លឿនខ្លាំង',
        confidence: 97,
        timingScore: 97,
        speechOnset: 12.68,
        speechOffset: 14.38,
        speaker: 'Speaker 1',
        words: [
          { word: 'ដំណើរការ', start: 12.68, end: 13.45, confidence: 97 },
          { word: 'លឿនខ្លាំង', start: 13.50, end: 14.38, confidence: 98 },
        ],
      },
      {
        id: 10,
        start: 14.82,
        end: 16.45,
        text: 'ងាយស្រួល កាត់ត',
        confidence: 95,
        timingScore: 97,
        speechOnset: 14.85,
        speechOffset: 16.38,
        speaker: 'Speaker 1',
        words: [
          { word: 'ងាយស្រួល', start: 14.85, end: 15.55, confidence: 95 },
          { word: 'កាត់ត', start: 15.60, end: 16.38, confidence: 96 },
        ],
      },
      {
        id: 11,
        start: 16.55,
        end: 17.95,
        text: 'ក្នុង CapCut',
        confidence: 99,
        timingScore: 99,
        speechOnset: 16.58,
        speechOffset: 17.88,
        speaker: 'Speaker 1',
        words: [
          { word: 'ក្នុង', start: 16.58, end: 17.05, confidence: 99 },
          { word: 'CapCut', start: 17.10, end: 17.88, confidence: 99 },
        ],
      },
      {
        id: 12,
        start: 18.42,
        end: 19.95,
        text: 'តោះ ទៅទស្សនា',
        confidence: 96,
        timingScore: 98,
        speechOnset: 18.45,
        speechOffset: 19.88,
        speaker: 'Speaker 1',
        words: [
          { word: 'តោះ', start: 18.45, end: 18.95, confidence: 96 },
          { word: 'ទៅទស្សនា', start: 19.00, end: 19.88, confidence: 97 },
        ],
      },
      {
        id: 13,
        start: 20.05,
        end: 21.95,
        text: 'ការតេស្ត ជាក់ស្តែង',
        confidence: 97,
        timingScore: 98,
        speechOnset: 20.08,
        speechOffset: 21.88,
        speaker: 'Speaker 1',
        words: [
          { word: 'ការតេស្ត', start: 20.08, end: 20.90, confidence: 97 },
          { word: 'ជាក់ស្តែង', start: 20.95, end: 21.88, confidence: 98 },
        ],
      },
      {
        id: 14,
        start: 22.05,
        end: 24.45,
        text: 'ទាំងអស់គ្នា ណា!',
        confidence: 98,
        timingScore: 98,
        speechOnset: 22.08,
        speechOffset: 24.38,
        speaker: 'Speaker 1',
        words: [
          { word: 'ទាំងអស់គ្នា', start: 22.08, end: 23.35, confidence: 98 },
          { word: 'ណា!', start: 23.40, end: 24.38, confidence: 98 },
        ],
      },
    ],
  },
  {
    id: 'sample-business',
    title: 'Cambodian E-Commerce & Creator Tips',
    category: 'Business & Education',
    duration: 32,
    description: 'Multiple speaker conversational dialogue with numbers and practical creator tips.',
    segments: [
      {
        id: 1,
        start: 0.52,
        end: 2.15,
        text: 'គន្លឹះសំខាន់ ៣យ៉ាង',
        confidence: 98,
        timingScore: 98,
        speechOnset: 0.55,
        speechOffset: 2.08,
        speaker: 'Speaker 1',
        words: [
          { word: 'គន្លឹះសំខាន់', start: 0.55, end: 1.35, confidence: 98 },
          { word: '៣យ៉ាង', start: 1.40, end: 2.08, confidence: 98 },
        ],
      },
      {
        id: 2,
        start: 2.25,
        end: 3.75,
        text: 'លក់អនឡាញ ដាច់ខ្លាំង',
        confidence: 97,
        timingScore: 97,
        speechOnset: 2.28,
        speechOffset: 3.68,
        speaker: 'Speaker 1',
        words: [
          { word: 'លក់អនឡាញ', start: 2.28, end: 2.95, confidence: 97 },
          { word: 'ដាច់ខ្លាំង', start: 3.00, end: 3.68, confidence: 98 },
        ],
      },
      {
        id: 3,
        start: 3.85,
        end: 5.15,
        text: 'ឆ្នាំ ២០២៦',
        confidence: 99,
        timingScore: 99,
        speechOnset: 3.88,
        speechOffset: 5.08,
        speaker: 'Speaker 1',
        words: [
          { word: 'ឆ្នាំ', start: 3.88, end: 4.35, confidence: 99 },
          { word: '២០២៦', start: 4.40, end: 5.08, confidence: 99 },
        ],
      },
      {
        id: 4,
        start: 5.52,
        end: 7.15,
        text: 'ទីមួយ ផលិតវីដេអូខ្លី',
        confidence: 96,
        timingScore: 97,
        speechOnset: 5.55,
        speechOffset: 7.08,
        speaker: 'Speaker 1',
        words: [
          { word: 'ទីមួយ', start: 5.55, end: 6.15, confidence: 96 },
          { word: 'ផលិតវីដេអូខ្លី', start: 6.20, end: 7.08, confidence: 97 },
        ],
      },
      {
        id: 5,
        start: 7.25,
        end: 8.95,
        text: 'លើ TikTok',
        confidence: 98,
        timingScore: 98,
        speechOnset: 7.28,
        speechOffset: 8.88,
        speaker: 'Speaker 1',
        words: [
          { word: 'លើ', start: 7.28, end: 7.80, confidence: 98 },
          { word: 'TikTok', start: 7.85, end: 8.88, confidence: 99 },
        ],
      },
      {
        id: 6,
        start: 9.05,
        end: 11.15,
        text: 'និង Facebook Reels',
        confidence: 97,
        timingScore: 98,
        speechOnset: 9.08,
        speechOffset: 11.08,
        speaker: 'Speaker 1',
        words: [
          { word: 'និង', start: 9.08, end: 9.55, confidence: 97 },
          { word: 'Facebook', start: 9.60, end: 10.30, confidence: 98 },
          { word: 'Reels', start: 10.35, end: 11.08, confidence: 98 },
        ],
      },
      {
        id: 7,
        start: 11.52,
        end: 13.45,
        text: 'ទីពីរ ដាក់ Subtitle',
        confidence: 96,
        timingScore: 97,
        speechOnset: 11.55,
        speechOffset: 13.38,
        speaker: 'Speaker 2',
        words: [
          { word: 'ទីពីរ', start: 11.55, end: 12.20, confidence: 96 },
          { word: 'ដាក់ Subtitle', start: 12.25, end: 13.38, confidence: 97 },
        ],
      },
      {
        id: 8,
        start: 13.55,
        end: 15.45,
        text: 'អក្សររត់ ខ្មែរ',
        confidence: 97,
        timingScore: 98,
        speechOnset: 13.58,
        speechOffset: 15.38,
        speaker: 'Speaker 2',
        words: [
          { word: 'អក្សររត់', start: 13.58, end: 14.50, confidence: 97 },
          { word: 'ខ្មែរ', start: 14.55, end: 15.38, confidence: 98 },
        ],
      },
      {
        id: 9,
        start: 15.55,
        end: 17.45,
        text: 'ឱ្យបាន ត្រឹមត្រូវ',
        confidence: 95,
        timingScore: 97,
        speechOnset: 15.58,
        speechOffset: 17.38,
        speaker: 'Speaker 2',
        words: [
          { word: 'ឱ្យបាន', start: 15.58, end: 16.40, confidence: 95 },
          { word: 'ត្រឹមត្រូវ', start: 16.45, end: 17.38, confidence: 96 },
        ],
      },
      {
        id: 10,
        start: 17.55,
        end: 19.45,
        text: 'ទាក់ទាញ អ្នកមើល',
        confidence: 98,
        timingScore: 98,
        speechOnset: 17.58,
        speechOffset: 19.38,
        speaker: 'Speaker 2',
        words: [
          { word: 'ទាក់ទាញ', start: 17.58, end: 18.45, confidence: 98 },
          { word: 'អ្នកមើល', start: 18.50, end: 19.38, confidence: 98 },
        ],
      },
      {
        id: 11,
        start: 19.82,
        end: 21.75,
        text: 'ទីបី ឆ្លើយតបសារ',
        confidence: 96,
        timingScore: 97,
        speechOnset: 19.85,
        speechOffset: 21.68,
        speaker: 'Speaker 2',
        words: [
          { word: 'ទីបី', start: 19.85, end: 20.55, confidence: 96 },
          { word: 'ឆ្លើយតបសារ', start: 20.60, end: 21.68, confidence: 97 },
        ],
      },
      {
        id: 12,
        start: 21.85,
        end: 23.75,
        text: 'ឱ្យបាន រហ័ស',
        confidence: 97,
        timingScore: 98,
        speechOnset: 21.88,
        speechOffset: 23.68,
        speaker: 'Speaker 2',
        words: [
          { word: 'ឱ្យបាន', start: 21.88, end: 22.75, confidence: 97 },
          { word: 'រហ័ស', start: 22.80, end: 23.68, confidence: 98 },
        ],
      },
      {
        id: 13,
        start: 24.02,
        end: 26.45,
        text: 'ផ្ដល់ សេវាកម្មល្អ',
        confidence: 95,
        timingScore: 96,
        speechOnset: 24.05,
        speechOffset: 26.38,
        speaker: 'Speaker 1',
        words: [
          { word: 'ផ្ដល់', start: 24.05, end: 24.95, confidence: 95 },
          { word: 'សេវាកម្មល្អ', start: 25.00, end: 26.38, confidence: 96 },
        ],
      },
      {
        id: 14,
        start: 26.82,
        end: 28.75,
        text: 'អនុវត្តតាម វិធីនេះ',
        confidence: 98,
        timingScore: 98,
        speechOnset: 26.85,
        speechOffset: 28.68,
        speaker: 'Speaker 1',
        words: [
          { word: 'អនុវត្តតាម', start: 26.85, end: 27.75, confidence: 98 },
          { word: 'វិធីនេះ', start: 27.80, end: 28.68, confidence: 98 },
        ],
      },
      {
        id: 15,
        start: 28.85,
        end: 30.95,
        text: 'លទ្ធផល កើនឡើងជាក់ជាមិនខាន',
        confidence: 97,
        timingScore: 97,
        speechOnset: 28.88,
        speechOffset: 30.88,
        speaker: 'Speaker 1',
        words: [
          { word: 'លទ្ធផល', start: 28.88, end: 29.65, confidence: 97 },
          { word: 'កើនឡើងជាក់ជាមិនខាន', start: 29.70, end: 30.88, confidence: 97 },
        ],
      },
    ],
  },
];

// Export samples with normalized Khmer text and exact audio word timestamps (Rules 1-5, 9-10)
export const SAMPLE_VIDEOS: SampleVideoOption[] = RAW_SAMPLE_VIDEOS.map((sample) => ({
  ...sample,
  segments: sample.segments.map((seg) => {
    const firstWordStart = seg.words?.[0]?.start ?? seg.speechOnset ?? seg.start;
    const lastWordEnd = seg.words?.[seg.words.length - 1]?.end ?? seg.speechOffset ?? seg.end;
    return {
      ...seg,
      start: firstWordStart,
      end: lastWordEnd,
      speechOnset: firstWordStart,
      speechOffset: lastWordEnd,
      startDelayMs: 0,
      endDelayMs: 0,
      timingScore: 99,
      text: normalizeKhmerSubtitleText(seg.text),
    };
  }),
}));

/**
 * Creates a playable demo video file in memory with canvas animation and audio
 * so creators can immediately test without needing to have an MP4 file on disk.
 */
export async function createDemoVideoFile(sample: SampleVideoOption): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d')!;

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  const dest = audioCtx.createMediaStreamDestination();

  // Create ambient speech harmonic tone series simulating voice modulation
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc1.type = 'triangle';
  osc2.type = 'sine';

  osc1.frequency.setValueAtTime(140, audioCtx.currentTime);
  osc2.frequency.setValueAtTime(280, audioCtx.currentTime);

  // Modulation for speech cadences
  const lfo = audioCtx.createOscillator();
  lfo.frequency.setValueAtTime(4, audioCtx.currentTime); // 4Hz syllabic rhythm
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.setValueAtTime(25, audioCtx.currentTime);
  lfo.connect(osc1.frequency);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(dest);

  gain.gain.setValueAtTime(0.08, audioCtx.currentTime);

  osc1.start();
  osc2.start();
  lfo.start();

  const canvasStream = canvas.captureStream(30);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
    ? 'video/mp4;codecs=avc1'
    : MediaRecorder.isTypeSupported('video/mp4')
    ? 'video/mp4'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const recorder = new MediaRecorder(combinedStream, { mimeType });
  const recordedChunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  const startTime = Date.now();
  const totalMs = Math.min(sample.duration, 15) * 1000; // Cap at 15s for quick generation

  // Animation frame loop
  let animationId: number;
  const renderFrame = () => {
    const elapsed = (Date.now() - startTime) / 1000;
    const progress = Math.min(1, elapsed / (totalMs / 1000));

    // Dark sleek gradient background
    const grad = ctx.createLinearGradient(0, 0, 1280, 720);
    grad.addColorStop(0, '#090d16');
    grad.addColorStop(0.5, '#0f172a');
    grad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1280, 720);

    // Decorative grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 1280; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 720);
      ctx.stroke();
    }
    for (let y = 0; y < 720; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1280, y);
      ctx.stroke();
    }

    // Glowing circle in center
    const pulse = 1 + Math.sin(elapsed * 4) * 0.08;
    const circleGrad = ctx.createRadialGradient(640, 310, 10, 640, 310, 160 * pulse);
    circleGrad.addColorStop(0, 'rgba(245, 158, 11, 0.35)');
    circleGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = circleGrad;
    ctx.beginPath();
    ctx.arc(640, 310, 160 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Sound wave visualizer bars
    const barCount = 32;
    const startX = 640 - (barCount * 14) / 2;
    for (let b = 0; b < barCount; b++) {
      const h = Math.abs(Math.sin(elapsed * 6 + b * 0.4)) * 70 + 10;
      ctx.fillStyle = b % 2 === 0 ? '#f59e0b' : '#38bdf8';
      ctx.fillRect(startX + b * 14, 310 - h / 2, 8, h);
    }

    // Title badge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(470, 70, 340, 42, 21);
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CAMBODIAN CREATOR DEMO', 640, 96);

    // Main Sample Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(sample.title, 640, 170);

    // Active Khmer Subtitle simulation at current timestamp
    const activeSeg = sample.segments.find((s) => elapsed >= s.start && elapsed <= s.end);
    if (activeSeg) {
      // Subtitle box
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      const textWidth = ctx.measureText(activeSeg.text).width;
      const boxWidth = Math.min(1100, Math.max(textWidth + 80, 500));
      ctx.beginPath();
      ctx.roundRect(640 - boxWidth / 2, 540, boxWidth, 80, 12);
      ctx.fill();

      // Yellow/White subtitle text with Khmer font
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 28px "Kantumruy Pro", sans-serif';
      ctx.fillText(activeSeg.text, 640, 590);
    }

    // Progress bar at bottom
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(100, 680, 1080, 6);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(100, 680, 1080 * progress, 6);

    if (Date.now() - startTime < totalMs) {
      animationId = requestAnimationFrame(renderFrame);
    }
  };

  recorder.start(100);
  animationId = requestAnimationFrame(renderFrame);

  return new Promise<File>((resolve) => {
    setTimeout(async () => {
      cancelAnimationFrame(animationId);
      recorder.stop();
      osc1.stop();
      osc2.stop();
      lfo.stop();
      await audioCtx.close();

      recorder.onstop = () => {
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(recordedChunks, { type: mimeType });
        const file = new File([blob], `${sample.title.replace(/\s+/g, '_')}.${ext}`, {
          type: mimeType,
        });
        resolve(file);
      };
    }, totalMs);
  });
}
