/**
 * Intelligent Language Detector & Voice Clarification Service for ZARA
 *
 * Supports:
 * - Pakistani Urdu script (اردو)
 * - Pakistani Roman Urdu (Latin transliteration)
 * - English
 */

// Unicode range for Arabic & Urdu script
const URDU_ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g;

// Distinctive Pakistani Roman Urdu lexicon
const ROMAN_URDU_WORDS = new Set([
  'kya', 'kaise', 'kaisa', 'kaisi', 'haal', 'chal', 'raha', 'rahi', 'rahe',
  'hain', 'hai', 'hoon', 'hun', 'theek', 'acha', 'achi', 'ache',
  'batao', 'bataiye', 'bataen', 'bolo', 'boliye', 'suno', 'suniye',
  'karo', 'kariye', 'karna', 'karni', 'karne', 'banao', 'banayein', 'bana',
  'kholo', 'kholiye', 'bhejo', 'bhejiye', 'meri', 'mera', 'mere',
  'aap', 'aapka', 'aapki', 'aapke', 'tum', 'tumhara', 'tumhari', 'tumhare',
  'mujhe', 'mujhko', 'humein', 'hamara', 'hamari', 'hamare',
  'shukriya', 'khairiyat', 'sab', 'bohot', 'bohat', 'thoda', 'thodi', 'thode',
  'zara', 'yaar', 'bhai', 'janab', 'parso', 'kal', 'aaj', 'subah', 'shaam', 'raat',
  'waqt', 'kaam', 'kuch', 'kyun', 'kahan', 'kidhar', 'kisko', 'kis', 'kon', 'kaun',
  'konsa', 'konsi', 'konsey', 'wala', 'wali', 'wale', 'bolein', 'likhein',
  'chai', 'peeni', 'peelo', 'khana', 'khao', 'socho', 'socha', 'pehle', 'baad',
  'mein', 'par', 'se', 'ko', 'ka', 'ki', 'ke', 'na', 'nahi', 'naheen', 'mat',
  'bilkul', 'zabardast', 'mast', 'pareshan', 'tension', 'salam', 'assalam',
  'alaikum', 'walekum', 'waalaikum', 'zaroor', 'foran', 'wapis', 'sunao', 'dekho'
]);

// Common English words
const ENGLISH_WORDS = new Set([
  'the', 'is', 'are', 'am', 'and', 'or', 'to', 'in', 'on', 'at', 'for', 'with',
  'a', 'an', 'this', 'that', 'these', 'those', 'what', 'how', 'where', 'when',
  'why', 'who', 'which', 'can', 'could', 'would', 'should', 'please', 'help',
  'make', 'create', 'build', 'design', 'write', 'code', 'website', 'app', 'logo',
  'presentation', 'report', 'analyze', 'research', 'fix', 'error', 'bug', 'open',
  'close', 'search', 'find', 'delete', 'update', 'test', 'hello', 'hey', 'hi',
  'good', 'morning', 'night', 'thank', 'thanks', 'you', 'your', 'my', 'me', 'i',
  'we', 'our', 'they', 'them', 'their', 'want', 'need', 'like', 'show'
]);

export type SupportedLanguage = 'urdu' | 'roman_urdu' | 'english';

/**
 * Detects whether a text is Pakistani Urdu script, Roman Urdu, or English.
 */
export function detectLanguage(
  text: string,
  preferredFallback: SupportedLanguage = 'roman_urdu'
): SupportedLanguage {
  if (!text || typeof text !== 'string') {
    return preferredFallback;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return preferredFallback;
  }

  // 1. Urdu Script Detection: Check Arabic/Urdu Unicode characters
  const urduMatches = trimmed.match(URDU_ARABIC_REGEX);
  const totalChars = trimmed.replace(/\s+/g, '').length;
  if (urduMatches && totalChars > 0) {
    const urduRatio = urduMatches.length / totalChars;
    // If more than 15% of non-whitespace characters are Urdu/Arabic, or at least 2 Urdu chars in short query
    if (urduRatio > 0.15 || urduMatches.length >= 2) {
      return 'urdu';
    }
  }

  // 2. Tokenize Latin words
  const words = trimmed
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) {
    return preferredFallback;
  }

  let romanUrduScore = 0;
  let englishScore = 0;

  for (const word of words) {
    if (ROMAN_URDU_WORDS.has(word)) {
      romanUrduScore += 1.5;
    }
    if (ENGLISH_WORDS.has(word)) {
      englishScore += 1;
    }
  }

  // Common Pakistani hybrid phrases like "e-commerce site banao" or "AI trends research karo":
  // Verbs like 'banao', 'karo', 'kholo', 'bhejo' strongly indicate Roman Urdu intent
  const strongRomanVerbs = ['banao', 'karo', 'kholo', 'bhejo', 'sunao', 'batao', 'dekho', 'hai', 'hain', 'mein', 'ko', 'ka', 'ki', 'ke'];
  const hasStrongRomanVerb = words.some((w) => strongRomanVerbs.includes(w));
  if (hasStrongRomanVerb) {
    romanUrduScore += 2;
  }

  if (romanUrduScore > englishScore) {
    return 'roman_urdu';
  }

  if (englishScore > romanUrduScore) {
    return 'english';
  }

  return preferredFallback;
}

/**
 * Language-appropriate, polite, and dostana clarification generator.
 * Completely replaces generic/dismissive canned phrases like "Arre Boss, kuch samajh nahi aaya, dobara bolo!".
 */
export function getClarificationResponse(
  lang: SupportedLanguage,
  reason: 'unclear' | 'empty' | 'network' | 'permission' | 'unsupported' = 'unclear'
): string {
  if (lang === 'urdu') {
    switch (reason) {
      case 'empty':
        return 'جی باس، میں ہمہ تن گوش ہوں۔ فرمائیے، کیا حکم ہے؟';
      case 'network':
        return 'باس، انٹرنیٹ رابطے میں ذرا خلل آ گیا ہے۔ ایک لمحے بعد دوبارہ فرمائیے گا!';
      case 'permission':
        return 'باس، براؤزر میں مائیکروفون کی اجازت درکار ہے۔ برائے مہربانی ایڈریس بار سے مائیک الاؤ کر دیں۔';
      case 'unsupported':
        return 'باس، اس براؤزر میں براہ راست صوتی شناخت فعال نہیں ہے۔ آپ ٹیکسٹ کے ذریعے باآسانی گفتگو کر سکتے ہیں۔';
      case 'unclear':
      default:
        return 'باس، آواز ذرا مدہم تھی یا بات پوری نہیں پہنچ سکی۔ ذرا دوبارہ فرمائیے گا؟ میں توجہ سے سن رہی ہوں۔';
    }
  }

  if (lang === 'english') {
    switch (reason) {
      case 'empty':
        return "I'm right here listening closely, Boss! What would you like to work on?";
      case 'network':
        return 'Boss, there seems to be a quick network hiccup. Could you say that again in a second?';
      case 'permission':
        return 'Boss, microphone permission is required in your browser. Please allow microphone access in your browser address bar.';
      case 'unsupported':
        return 'Boss, speech recognition is not supported in this browser. Please use Chrome/Edge or type your message.';
      case 'unclear':
      default:
        return "Boss, I couldn't catch that clearly. Could you please clarify or say that again? I'm listening!";
    }
  }

  // Roman Urdu (Default)
  switch (reason) {
    case 'empty':
      return 'Ji Boss, main dhyan se sun rahi hoon! Boliye, kya hukum hai?';
    case 'network':
      return 'Boss, internet connection mein thoda issue aaya hai. Ek second baad dobara bolein zara!';
    case 'permission':
      return 'Boss, browser mein mic ki permission required hai. Meherbani karke address bar se mic allow kar dein.';
    case 'unsupported':
      return 'Boss, is browser mein speech recognition support nahi hai. Aap Chrome ya Edge use karein ya text likhein.';
    case 'unclear':
    default:
      return 'Boss, awaaz thodi halki thi ya baat poori tarah clear nahi hui. Zara wazahat se dobara bataiye, main sun rahi hoon!';
  }
}

/**
 * Maps browser Web Speech API error codes to language-appropriate user notices.
 */
export function mapSpeechErrorToMessage(
  errorType: string,
  lang: SupportedLanguage = 'roman_urdu'
): { friendlyMessage: string; isFatal: boolean } {
  switch (errorType) {
    case 'not-allowed':
    case 'permission-denied':
      return {
        friendlyMessage: getClarificationResponse(lang, 'permission'),
        isFatal: true,
      };
    case 'network':
      return {
        friendlyMessage: getClarificationResponse(lang, 'network'),
        isFatal: false,
      };
    case 'audio-capture':
      return {
        friendlyMessage:
          lang === 'urdu'
            ? 'باس، کوئی مائیکروفون منسلک نہیں ملا۔ برائے مہربانی آڈیو ان پٹ کیبل یا مائیک سیٹنگ چیک کریں۔'
            : lang === 'english'
            ? 'No microphone input device was detected. Please check your audio hardware settings.'
            : 'Boss, koi mic connect nahi mila. Audio hardware settings check karein.',
        isFatal: true,
      };
    case 'service-not-allowed':
      return {
        friendlyMessage:
          lang === 'urdu'
            ? 'باس، سسٹم یا براؤزر پالیسی نے اسپیچ سروس کو بند کر رکھا ہے۔'
            : lang === 'english'
            ? 'Speech recognition service is blocked by your browser or operating system policy.'
            : 'Boss, system ya browser policy ne speech recognition service block ki hui hai.',
        isFatal: true,
      };
    case 'no-speech':
      return {
        friendlyMessage: '', // Background silence, ignore silently
        isFatal: false,
      };
    case 'aborted':
      return {
        friendlyMessage: '',
        isFatal: false,
      };
    default:
      return {
        friendlyMessage:
          lang === 'urdu'
            ? `صوتی شناخت کی اطلاع: ${errorType}`
            : lang === 'english'
            ? `Speech recognition notice: ${errorType}`
            : `Speech recognition notice: ${errorType}`,
        isFatal: false,
      };
  }
}
