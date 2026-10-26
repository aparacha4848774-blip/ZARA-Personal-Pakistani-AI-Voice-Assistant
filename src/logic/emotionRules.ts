export type EmotionType =
  | 'Happy'
  | 'Sad'
  | 'Angry'
  | 'Confident'
  | 'Caring'
  | 'Humorous'
  | 'Curious'
  | 'Calm'
  | 'Surprised'
  | 'Focused';

export interface EmotionInfo {
  id: EmotionType;
  urduName: string;
  emoji: string;
  color: string;
  defaultStyle: string;
}

export const EMOTIONS: Record<EmotionType, EmotionInfo> = {
  Happy: {
    id: 'Happy',
    urduName: 'Khushi (خوشی)',
    emoji: '😊',
    color: '#F59E0B',
    defaultStyle: 'Energetic & warm',
  },
  Sad: {
    id: 'Sad',
    urduName: 'Udaasi (اداسی)',
    emoji: '🥺',
    color: '#60A5FA',
    defaultStyle: 'Soft & compassionate',
  },
  Angry: {
    id: 'Angry',
    urduName: 'Ghussa (غصہ)',
    emoji: '😤',
    color: '#EF4444',
    defaultStyle: 'Firm & direct',
  },
  Confident: {
    id: 'Confident',
    urduName: 'Pur-Aitemaad (پراعتماد)',
    emoji: '✨',
    color: '#8B5CF6',
    defaultStyle: 'Clear, steady & poised',
  },
  Caring: {
    id: 'Caring',
    urduName: 'Hamdardi (ہمدردی)',
    emoji: '💖',
    color: '#EC4899',
    defaultStyle: 'Gentle, supportive friend',
  },
  Humorous: {
    id: 'Humorous',
    urduName: 'Mazahiya (مزاحیہ)',
    emoji: '😄',
    color: '#F97316',
    defaultStyle: 'Playful & witty dostana',
  },
  Curious: {
    id: 'Curious',
    urduName: 'Tajasus (تجسس)',
    emoji: '🧐',
    color: '#06B6D4',
    defaultStyle: 'Inquisitive & engaged',
  },
  Calm: {
    id: 'Calm',
    urduName: 'Pur-Sukun (پرسکون)',
    emoji: '🌿',
    color: '#10B981',
    defaultStyle: 'Measured, relaxed & patient',
  },
  Surprised: {
    id: 'Surprised',
    urduName: 'Hairat (حیرت)',
    emoji: '😲',
    color: '#A855F7',
    defaultStyle: 'Expressive & alert',
  },
  Focused: {
    id: 'Focused',
    urduName: 'Pur-Azm (پرعزم)',
    emoji: '🎯',
    color: '#3B82F6',
    defaultStyle: 'Sharp, goal-oriented & concise',
  },
};

export function inferEmotionFromText(text: string): {
  emotion: EmotionType;
  intensity: number;
  confidence: 'high' | 'medium' | 'low';
} {
  const lower = text.toLowerCase();

  if (
    lower.includes('shukriya') ||
    lower.includes('thanks') ||
    lower.includes('zabardast') ||
    lower.includes('great') ||
    lower.includes('bohot acha') ||
    lower.includes('congrats') ||
    lower.includes('mubarak')
  ) {
    return { emotion: 'Happy', intensity: 85, confidence: 'high' };
  }

  if (
    lower.includes('pareshan') ||
    lower.includes('sad') ||
    lower.includes('tension') ||
    lower.includes('problem') ||
    lower.includes('thak gaya') ||
    lower.includes('dard')
  ) {
    return { emotion: 'Caring', intensity: 90, confidence: 'high' };
  }

  if (
    lower.includes('haha') ||
    lower.includes('lol') ||
    lower.includes('mazaq') ||
    lower.includes('chawal') ||
    lower.includes('jugat') ||
    lower.includes('funny')
  ) {
    return { emotion: 'Humorous', intensity: 80, confidence: 'high' };
  }

  if (
    lower.includes('kyun') ||
    lower.includes('kese') ||
    lower.includes('why') ||
    lower.includes('how') ||
    lower.includes('kya hai') ||
    lower.includes('maloomat')
  ) {
    return { emotion: 'Curious', intensity: 75, confidence: 'medium' };
  }

  if (
    lower.includes('urgent') ||
    lower.includes('jaldi') ||
    lower.includes('code') ||
    lower.includes('bug') ||
    lower.includes('fix') ||
    lower.includes('error')
  ) {
    return { emotion: 'Focused', intensity: 85, confidence: 'high' };
  }

  if (
    lower.includes('arre') ||
    lower.includes('kya waqai') ||
    lower.includes('really') ||
    lower.includes('shock') ||
    lower.includes('sach mein')
  ) {
    return { emotion: 'Surprised', intensity: 75, confidence: 'medium' };
  }

  return { emotion: 'Confident', intensity: 70, confidence: 'medium' };
}
