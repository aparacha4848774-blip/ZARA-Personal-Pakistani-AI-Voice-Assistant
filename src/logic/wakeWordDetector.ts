export interface WakeWordMatch {
  detected: boolean;
  phrase: string;
  isAssalamGreeting: boolean;
  remainderText: string;
}

export const WAKE_WORD_PATTERNS = [
  'hello zara',
  'hey zara',
  'assalam-o-alaikum zara',
  'assalam o alaikum zara',
  'assalam-o-alaikum',
  'assalam o alaikum',
  'salam zara',
  'suno zara',
  'zara suno',
  'zara',
];

export function detectWakeWord(transcript: string): WakeWordMatch {
  if (!transcript || typeof transcript !== 'string') {
    return {
      detected: false,
      phrase: '',
      isAssalamGreeting: false,
      remainderText: '',
    };
  }

  const cleaned = transcript.trim().toLowerCase();

  for (const phrase of WAKE_WORD_PATTERNS) {
    if (cleaned === phrase) {
      return {
        detected: true,
        phrase,
        isAssalamGreeting: phrase.includes('assalam') || phrase.includes('salam'),
        remainderText: '',
      };
    }

    if (cleaned.startsWith(phrase + ' ') || cleaned.startsWith(phrase + ',')) {
      const remainder = cleaned.slice(phrase.length).replace(/^[,.\s]+/, '').trim();
      return {
        detected: true,
        phrase,
        isAssalamGreeting: phrase.includes('assalam') || phrase.includes('salam'),
        remainderText: remainder,
      };
    }
  }

  // Check if wake word is mentioned anywhere with punctuation
  const words = cleaned.split(/\s+/);
  const zaraIndex = words.indexOf('zara');
  if (zaraIndex !== -1) {
    const isGreeting =
      (zaraIndex > 0 && words[zaraIndex - 1] === 'salam') ||
      cleaned.includes('assalam');
    const remainder = words.slice(zaraIndex + 1).join(' ');
    return {
      detected: true,
      phrase: 'zara',
      isAssalamGreeting: isGreeting,
      remainderText: remainder,
    };
  }

  return {
    detected: false,
    phrase: '',
    isAssalamGreeting: false,
    remainderText: '',
  };
}
