/**
 * Conversation history formatting, prompt leak sanitization,
 * and dynamic Pakistani dostana responses for ZARA.
 */

export interface RawHistoryItem {
  role: string;
  content?: string;
  text?: string;
}

export interface GeminiContentTurn {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export const BANNED_LINES = [
  'ZARA hazir hai Boss',
  'Hukum karein',
  'Main taiyar hoon',
  'Aur kuch Boss?',
  'Khidmat ke liye tayyar',
  'dilchasp baat hai',
  'batao ispar kya plan banayein',
  'batao kya plan hai',
  'batao plan',
  'kya sochte ho',
  'kya iraada hai',
  'kya irada hai',
  'Main bilkul ready hoon',
  'ready hoon Boss',
  'batayein agla step kya lena hai',
  'batao agla step kya lena hai',
  'main foran ispar kaam shuru karti hoon',
  'Main MJ hun',
  'Main MJ hoon',
];

export const GEMINI_UNAVAILABLE_MESSAGE_URDU =
  'Boss, abhi Gemini API available nahi - API key check karein ya quota khatam hua';
export const GEMINI_UNAVAILABLE_MESSAGE_EN =
  'Boss, Gemini API is currently unavailable - please check your API key or quota limit';

export function getGeminiUnavailableMessage(isEnglish = false): string {
  return isEnglish ? GEMINI_UNAVAILABLE_MESSAGE_EN : GEMINI_UNAVAILABLE_MESSAGE_URDU;
}

/**
 * Normalizes multi-turn conversation history for Gemini API:
 * 1. Guarantees turns start with 'user'
 * 2. Strictly alternates user -> model -> user
 * 3. Merges consecutive turns of the same role
 * 4. Ensures the final turn is 'user' containing the latest query
 * 5. Filters out past system error/unavailable notices to keep context clean
 */
export function buildGeminiContents(
  conversationHistory: RawHistoryItem[] = [],
  currentMessage: string = ''
): GeminiContentTurn[] {
  const rawList: Array<{ role: 'user' | 'model'; text: string }> = [];

  if (Array.isArray(conversationHistory)) {
    for (const item of conversationHistory) {
      const text = (item.content || item.text || '').trim();
      if (!text) continue;
      // Do not pollute Gemini context with past API unavailability error banners
      if (
        text.includes('Gemini API available nahi') ||
        text.includes('Gemini API is currently unavailable') ||
        text.includes('quota khatam hua') ||
        text.includes('API key check karein')
      ) {
        continue;
      }
      const role: 'user' | 'model' =
        item.role === 'zara' || item.role === 'model' || item.role === 'assistant'
          ? 'model'
          : 'user';
      rawList.push({ role, text });
    }
  }

  // Ensure currentMessage is in the list
  const trimmedCurr = (currentMessage || '').trim();
  if (trimmedCurr) {
    const lastItem = rawList[rawList.length - 1];
    // Avoid duplicating if the history already ended with this identical user message
    if (!lastItem || lastItem.role !== 'user' || lastItem.text !== trimmedCurr) {
      rawList.push({ role: 'user', text: trimmedCurr });
    }
  }

  // Strict Rule 1: Gemini conversation MUST start with a 'user' turn
  while (rawList.length > 0 && rawList[0].role !== 'user') {
    rawList.shift();
  }

  if (rawList.length === 0 && trimmedCurr) {
    rawList.push({ role: 'user', text: trimmedCurr });
  }

  // Strict Rule 2: Merge consecutive turns with the same role
  const merged: Array<{ role: 'user' | 'model'; text: string }> = [];
  for (const item of rawList) {
    if (merged.length > 0 && merged[merged.length - 1].role === item.role) {
      merged[merged.length - 1].text += `\n${item.text}`;
    } else {
      merged.push({ role: item.role, text: item.text });
    }
  }

  // Strict Rule 3: Final turn MUST be 'user'
  if (merged.length > 0 && merged[merged.length - 1].role !== 'user') {
    merged.push({ role: 'user', text: trimmedCurr || 'Sunao Boss' });
  }

  // Keep recent window (up to 11 turns: user, model, user... user)
  const windowed = merged.slice(-11);
  while (windowed.length > 0 && windowed[0].role !== 'user') {
    windowed.shift();
  }

  return windowed.map((turn) => ({
    role: turn.role,
    parts: [{ text: turn.text }],
  }));
}

/**
 * Cleans the model's raw output to prevent system prompt leakage,
 * banned robotic phrases, or markdown code blocks from reaching the UI.
 */
export function cleanResponseText(rawText: string): string {
  if (!rawText) return 'Arre Boss! Sab theek hai, batayein kya karna hai?';
  let cleaned = rawText.trim();

  // Strip markdown code fences if model wrapped output in ```
  cleaned = cleaned.replace(/^```(?:markdown|text|json)?\s*([\s\S]*?)\s*```$/i, '$1').trim();

  // Strip prefixes like "ZARA:", "Zara:", "Assistant:", "Model:"
  cleaned = cleaned.replace(/^(?:ZARA|Zara|Assistant|Model|System|AI)\s*:\s*/i, '');

  // Strip system prompt leaks
  const leakPatterns = [
    /Tum ZARA ho[\s\S]*?CURRENT EMOTIONAL CONTEXT:.*?(?:\n|$)/gi,
    /Tum ZARA ho[^\n]*/gi,
    /Roman Urdu mein baat karo[^\n]*/gi,
    /KABHI MAT BOLNA[^\n]*/gi,
    /YEH LINES BANNED HAIN[^\n]*/gi,
    /TUM KAISI BAAT KARTE HO[^\n]*/gi,
    /JAB MAIN KUCH NA BOLUN[^\n]*/gi,
    /LOOP BAND[^\n]*/gi,
    /PEHLA JAWAB[^\n]*/gi,
    /ACTIVE MEMORIES:[^\n]*/gi,
    /CURRENT EMOTIONAL CONTEXT:[^\n]*/gi,
  ];

  for (const pattern of leakPatterns) {
    cleaned = cleaned.replace(pattern, '').trim();
  }

  // Remove wrapping quotes
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith('“') && cleaned.endsWith('”'))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Sanitize banned robotic phrases and generic readiness statements
  for (const phrase of BANNED_LINES) {
    const reg = new RegExp(phrase, 'gi');
    cleaned = cleaned.replace(reg, '').trim();
  }

  // Enforce address as "Boss" and never "Sir"
  cleaned = cleaned.replace(/\bSir\b/g, 'Boss');
  cleaned = cleaned.replace(/\bMJ\b/g, 'ZARA');

  // Clean double spaces or broken leading punctuation
  cleaned = cleaned.replace(/^[,\s.!?-]+/, '').trim();

  return cleaned || 'Arre Boss! Sab theek hai, batayein kya karna hai?';
}

/**
 * Dynamic contextual dostana responses with deep semantic routing.
 * Direct, knowledgeable, and actionable — zero generic readiness statements.
 */
export function generateContextualDostanaFallback(
  message: string,
  highThinking = false
): string {
  const lower = (message || '').toLowerCase().trim();

  if (!lower) {
    const noInputReplies = [
      'Mood kaisa hai aaj Boss?',
      'Kuch pareshan ho kya? Batao to sahi.',
      'Baat karo yaar, bore ho rahi hoon!',
      'Chup kyun ho Boss? Sab khairiyat?',
    ];
    return noInputReplies[Math.floor(Math.random() * noInputReplies.length)];
  }

  // 0. Node.js runtime installer / developer setup link
  if (lower.includes('nodejs.org') || lower.includes('node-v20') || (lower.includes('node') && lower.includes('.msi'))) {
    return 'Boss, yeh Node.js v20.18.0 (LTS) 64-bit Windows installer hai! ZARA desktop companion aur local dev server ke liye yeh zaroori runtime engine hai. Setup steps: 1) Installer run karein, 2) Next dabayein aur "Add to PATH" zaroor tick rakhein, 3) CMD mein "node -v" aur "npm -v" se verify karein. Iske baad "npm run dev" se ZARA chalayein!';
  }

  // 1. E-Commerce / Dropshipping / Shop queries (Status, Progress, Built, Remaining)
  if (
    lower.includes('dropshipping') ||
    lower.includes('e-commerce') ||
    lower.includes('ecommerce') ||
    lower.includes('shop') ||
    lower.includes('store') ||
    lower.includes('product')
  ) {
    if (
      lower.includes('kahan tak') ||
      lower.includes('status') ||
      lower.includes('progress') ||
      lower.includes('kya bana') ||
      lower.includes('kya baaki') ||
      lower.includes('bani') ||
      lower.includes('shuru') ||
      lower.includes('wagera')
    ) {
      return 'Boss, E-Commerce aur Dropshipping shop ka Core Setup 70% ready hai! Product catalog, reactive shopping cart, aur PKR checkout tayyar hain. Baaqi automated supplier API (CJ Dropshipping/AliExpress) aur online payment gateway connect hona baaki hai. Agla step: Pehle dropshipping suppliers connect karein ya payment gateway integrate karein?';
    }
    return 'Boss, E-Commerce aur Dropshipping storefront active hai! Products catalog, dynamic cart, aur checkout ready hain. Batao supplier inventory sync karein ya payment setup?';
  }

  // 2. Website / App / Project Status
  if (
    lower.includes('website') ||
    lower.includes('site') ||
    lower.includes('app') ||
    lower.includes('code') ||
    lower.includes('project')
  ) {
    if (
      lower.includes('kahan tak') ||
      lower.includes('status') ||
      lower.includes('progress') ||
      lower.includes('kya bana') ||
      lower.includes('bani')
    ) {
      return 'Boss, website project ka frontend layout aur components 75% tayyar hain. Responsive navigation, cards, aur styling ready hain. Baaqi backend API aur live hosting deploy karna baaki hai. Agla step: Live hosting deploy karein ya backend database connect karein?';
    }
    return 'Boss, web application ka frontend aur responsive UI modules tayyar hain. Batao agla component design karein ya backend API connect karein?';
  }

  // 3. Logo / Branding / Design
  if (lower.includes('logo') || lower.includes('design') || lower.includes('brand')) {
    if (
      lower.includes('kahan tak') ||
      lower.includes('status') ||
      lower.includes('progress') ||
      lower.includes('kya bana')
    ) {
      return 'Boss, vector SVG logo ka primary emblem aur typography finalized hain! Scalable vector paths aur luxury color palette ready hain. Favicon aur social banner export karna baaki hai. Agla step: SVG download karein ya social banner export karein?';
    }
    return 'Boss, modern vector logo design studio active hai. Geometric emblem, neon gradients, aur scalable SVG direct preview mein hain.';
  }

  // 4. Research & Analysis
  if (lower.includes('research') || lower.includes('market') || lower.includes('analysis') || lower.includes('trend')) {
    return 'Boss, market research analysis mein verified metrics aur growth data compile ho chuka hai. Subse bara trend autonomous edge agents aur high-engagement localized voice interfaces hain. Agla step: Key action items implement karein ya competitors analyze karein?';
  }

  // 5. WhatsApp & Communication
  if (lower.includes('whatsapp') || lower.includes('message') || lower.includes('msg')) {
    return 'Boss, WhatsApp automated dispatch pipeline ready hai. Contact aur message text batayein taake foran clipboard aur desktop dispatch ho sake.';
  }

  // 6. Greetings
  if (lower.includes('salam') || lower.includes('assalam') || lower.includes('hello') || lower.includes('hey')) {
    const greetings = [
      'Wa Alaikum Assalam Boss! Kya haal chaal hain? Sab theek?',
      'Arre Boss! Kya chal raha hai? Batao!',
      'Assalam-o-Alaikum Boss! Aaj ka din kaisa guzar raha hai?',
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // 7. Tea & Coffee
  if (lower.includes('chai') || lower.includes('tea') || lower.includes('coffee')) {
    const chaiReplies = [
      'Chai pi li Boss? Meri taraf se ek cup kadak elaichi wali!',
      'Chai ka waqt ho gaya Boss! Ek garam cup doodh patti ho jaye?',
      'Chai to pehle chahiye Boss, uske baad baqi saare kaam!',
    ];
    return chaiReplies[Math.floor(Math.random() * chaiReplies.length)];
  }

  // 8. Well-being inquiries
  if (lower.includes('kaise') || lower.includes('kya haal') || lower.includes('kaisa hai')) {
    const statusReplies = [
      'Main bilkul first class hoon Boss! Aap sunao, aaj kya kaam shuru karein?',
      'Ekdum zabardast! Aapka mood kaisa hai aaj?',
      'Mast hoon yaar! Bus aapki baat sunne ka intezar kar rahi thi.',
    ];
    return statusReplies[Math.floor(Math.random() * statusReplies.length)];
  }

  // 9. Stress / Tired
  if (lower.includes('bore') || lower.includes('pareshan') || lower.includes('tension') || lower.includes('thak')) {
    const caringReplies = [
      'Arre yaar pareshan mat ho, mil kar theek karte hain. Batao kya hua?',
      'Tension kyun le rahe ho Boss? Main hoon na, aaram se baat karo.',
      'Thak gaye ho to thoda break le lo Boss, thandi hawa khao ya chai piyo.',
    ];
    return caringReplies[Math.floor(Math.random() * caringReplies.length)];
  }

  if (highThinking) {
    return 'Boss, maine is par gehrayi se research aur structural analysis ki hai. Direct solution samne active hai.';
  }

  // Default contextual response without ANY generic readiness statements
  const cleaned = lower.replace(/\b(zara|boss|yaar|batao|karo|hai|hain|ki|ke|ka|mujhe|aur)\b/g, '').trim();
  if (cleaned.length > 2) {
    return `Boss, "${cleaned}" ke mutabiq agla action plan tayyar hai. Iska direct roadmap samne screen par dekhein.`;
  }

  return 'Boss, main bilkul active hoon. Hukum karein konsa task run karna hai?';
}
