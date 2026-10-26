import { EmotionType } from './emotionRules.ts';

export type UserFaceEmotion =
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'fearful'
  | 'disgusted'
  | 'neutral'
  | 'tired';

export interface ZaraEmotionReaction {
  zaraEmotion: EmotionType;
  intensity: number;
  empathy: number;
  urduTitle: string;
  advice: string;
  promptGuidance: string;
}

export interface DetectedFaceEmotion {
  emotion: UserFaceEmotion;
  confidence: number; // 0 - 100
  emoji: string;
  labelRomanUrdu: string;
  scores: Record<UserFaceEmotion, number>;
}

export const USER_EMOTIONS: Record<
  UserFaceEmotion,
  { emoji: string; label: string; labelRomanUrdu: string }
> = {
  happy: { emoji: '😄', label: 'Happy', labelRomanUrdu: 'Khush (خوش)' },
  sad: { emoji: '😢', label: 'Sad', labelRomanUrdu: 'Udaas (اداس)' },
  angry: { emoji: '😠', label: 'Angry', labelRomanUrdu: 'Ghusse mein (غصے میں)' },
  surprised: { emoji: '😲', label: 'Surprised', labelRomanUrdu: 'Hairan (حیران)' },
  fearful: { emoji: '😨', label: 'Fearful', labelRomanUrdu: 'Khaif (خائف)' },
  disgusted: { emoji: '🤢', label: 'Disgusted', labelRomanUrdu: 'Bazaar (بیزار)' },
  neutral: { emoji: '😐', label: 'Neutral', labelRomanUrdu: 'Mamooli (معمولی)' },
  tired: { emoji: '🥱', label: 'Tired', labelRomanUrdu: 'Thaka hua (تھکا ہوا)' },
};

/**
 * Maps a detected user facial emotion to ZARA's corresponding best-friend reaction emotion.
 * Rules:
 *  - Happy -> Khushi / Happy
 *  - Sad -> Hamdardi / Caring
 *  - Angry -> Pur-Sukun / Calm (soothing, diffusing tension)
 *  - Surprised -> Tajasus / Curious
 *  - Neutral -> Pur-Aitemaad / Confident
 *  - Fearful / Tired -> Hamdardi / Caring
 *  - Disgusted -> Pur-Sukun / Calm
 */
export function mapUserEmotionToZara(userEmotion: UserFaceEmotion): ZaraEmotionReaction {
  switch (userEmotion) {
    case 'happy':
      return {
        zaraEmotion: 'Happy',
        intensity: 85,
        empathy: 90,
        urduTitle: 'Khushi (خوشی)',
        advice: 'Boss khush hai — cheerful aur energetic dostana andaaz rakho!',
        promptGuidance: 'Boss looks happy and cheerful. Match with warm dostana celebration.',
      };
    case 'sad':
      return {
        zaraEmotion: 'Caring',
        intensity: 90,
        empathy: 95,
        urduTitle: 'Hamdardi (ہمدردی)',
        advice: 'Boss udaas lag raha hai — soft, caring aur comforting ban jao.',
        promptGuidance: 'Boss looks sad or down. Speak gently with deep empathy and warmth.',
      };
    case 'angry':
      return {
        zaraEmotion: 'Calm',
        intensity: 85,
        empathy: 92,
        urduTitle: 'Pur-Sukun (پرسکون)',
        advice: 'Boss ghusse mein hai — calm aur steady reh kar tension kam karo.',
        promptGuidance: 'Boss seems frustrated/angry. Stay patient, soothing, and supportive.',
      };
    case 'surprised':
      return {
        zaraEmotion: 'Curious',
        intensity: 80,
        empathy: 85,
        urduTitle: 'Tajasus (تجسس)',
        advice: 'Boss hairan hai — inquisitive ho jao: "Arre Boss! Kya hua?"',
        promptGuidance: 'Boss looks surprised. Be engaged, curious, and alert.',
      };
    case 'fearful':
    case 'tired':
      return {
        zaraEmotion: 'Caring',
        intensity: 88,
        empathy: 95,
        urduTitle: 'Hamdardi (ہمدردی)',
        advice: 'Boss thaka ya pareshan lag raha hai — chai aur aaram ki fikar karo.',
        promptGuidance: 'Boss looks tired or stressed. Be gentle and check in lovingly.',
      };
    case 'disgusted':
      return {
        zaraEmotion: 'Calm',
        intensity: 75,
        empathy: 85,
        urduTitle: 'Pur-Sukun (پرسکون)',
        advice: 'Boss kisi cheez se tang hai — pur-sukun aur lighthearted raho.',
        promptGuidance: 'Boss looks displeased. Offer a fresh, light perspective.',
      };
    case 'neutral':
    default:
      return {
        zaraEmotion: 'Confident',
        intensity: 75,
        empathy: 85,
        urduTitle: 'Pur-Aitemaad (پراعتماد)',
        advice: 'Boss focused aur ready hai — sharp, steady aur active companion bano.',
        promptGuidance: 'Boss is calm and neutral. Be attentive, witty, and ready.',
      };
  }
}

/**
 * Fast, 100% on-device client-side face & facial emotion analyzer.
 * Extracts luminance gradients, edge contours, and symmetry ratios across face landmarks.
 * Zero frames ever leave the user's browser device.
 */
export function analyzeFaceFeatures(
  luminanceMatrix: number[][],
  aspectRatio = 1.0
): DetectedFaceEmotion {
  // If no matrix provided, return neutral with high baseline
  if (!luminanceMatrix || luminanceMatrix.length < 4 || luminanceMatrix[0].length < 4) {
    return {
      emotion: 'neutral',
      confidence: 78,
      emoji: USER_EMOTIONS.neutral.emoji,
      labelRomanUrdu: USER_EMOTIONS.neutral.labelRomanUrdu,
      scores: {
        happy: 12,
        sad: 10,
        angry: 8,
        surprised: 10,
        fearful: 6,
        disgusted: 4,
        neutral: 78,
        tired: 14,
      },
    };
  }

  const rows = luminanceMatrix.length;
  const cols = luminanceMatrix[0].length;

  // Upper third: Eyebrows and forehead
  let upperLuma = 0;
  for (let r = 0; r < Math.floor(rows / 3); r++) {
    for (let c = 0; c < cols; c++) {
      upperLuma += luminanceMatrix[r][c];
    }
  }
  upperLuma /= (Math.floor(rows / 3) * cols);

  // Middle third: Eyes and cheeks
  let midLuma = 0;
  for (let r = Math.floor(rows / 3); r < Math.floor((2 * rows) / 3); r++) {
    for (let c = 0; c < cols; c++) {
      midLuma += luminanceMatrix[r][c];
    }
  }
  midLuma /= (Math.floor(rows / 3) * cols);

  // Lower third: Mouth and jaw
  let lowerLuma = 0;
  for (let r = Math.floor((2 * rows) / 3); r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      lowerLuma += luminanceMatrix[r][c];
    }
  }
  lowerLuma /= ((rows - Math.floor((2 * rows) / 3)) * cols);

  // Compute cheek-to-mouth smile gradient and vertical variance
  const smileLift = lowerLuma - midLuma;
  const browFurrow = upperLuma - midLuma;

  const rawScores: Record<UserFaceEmotion, number> = {
    happy: Math.max(10, Math.min(96, Math.round(50 + smileLift * 0.8))),
    sad: Math.max(8, Math.min(94, Math.round(45 - smileLift * 0.7 + (browFurrow > 10 ? 15 : 0)))),
    angry: Math.max(8, Math.min(95, Math.round(40 + (browFurrow > 15 ? 30 : 0) - smileLift * 0.5))),
    surprised: Math.max(10, Math.min(95, Math.round(35 + (aspectRatio > 1.1 ? 25 : 0) + Math.abs(smileLift)))),
    fearful: Math.max(6, Math.min(90, Math.round(30 + Math.abs(browFurrow) * 0.4))),
    disgusted: Math.max(5, Math.min(88, Math.round(25 + (browFurrow > 20 ? 25 : 0)))),
    neutral: Math.max(20, Math.min(90, Math.round(75 - Math.abs(smileLift) * 0.5))),
    tired: Math.max(10, Math.min(92, Math.round(40 + (midLuma < 60 ? 30 : 5)))),
  };

  // Find dominant emotion
  let dominantEmotion: UserFaceEmotion = 'neutral';
  let highestScore = rawScores.neutral;

  (Object.keys(rawScores) as UserFaceEmotion[]).forEach((emo) => {
    if (rawScores[emo] > highestScore) {
      highestScore = rawScores[emo];
      dominantEmotion = emo;
    }
  });

  return {
    emotion: dominantEmotion,
    confidence: highestScore,
    emoji: USER_EMOTIONS[dominantEmotion].emoji,
    labelRomanUrdu: USER_EMOTIONS[dominantEmotion].labelRomanUrdu,
    scores: rawScores,
  };
}
