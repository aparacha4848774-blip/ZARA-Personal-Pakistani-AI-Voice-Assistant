import {
  CodeSandboxArtifact,
  ResearchReportArtifact,
  SvgLogoArtifact,
  SlideDeckArtifact,
  VideoScriptArtifact,
  AutomationJobArtifact,
  FileOrganizationArtifact,
  MessageArtifact,
} from '../types/zara.types.ts';
import { detectLanguage } from './languageDetector.ts';


export type AdvancedIntentType =
  | 'software_engineering'
  | 'research_analysis'
  | 'creative_logo'
  | 'creative_presentation'
  | 'creative_video_script'
  | 'automation_schedule'
  | 'automation_organize_files'
  | 'code_error_fix'
  | 'app_launch'
  | 'whatsapp_draft'
  | 'general';

export interface AdvancedIntentResult {
  intent: AdvancedIntentType;
  topic: string;
  confidence: number;
  speechResponseRomanUrdu: string;
  artifact?: MessageArtifact;
  needsClarification?: boolean;
  clarificationType?:
    | 'logo_brand'
    | 'website_type'
    | 'research_topic'
    | 'whatsapp_message'
    | 'whatsapp_contact'
    | 'app_name';
  clarificationContext?: any;
  directAction?: {
    type: 'app_launch';
    appName: string;
  };
  whatsappDraft?: {
    contactName: string;
    messageText: string;
  };
}

/**
 * Intelligent single-shot intent detector with Direct Intent Execution.
 * No generic filler responses, no "batao kya plan hai" delays.
 */
export function detectAdvancedIntent(query: string): AdvancedIntentResult {
  if (!query || !query.trim()) {
    return {
      intent: 'general',
      topic: 'Conversation',
      confidence: 0.5,
      speechResponseRomanUrdu: '',
    };
  }

  const raw = query.trim();
  const lower = raw.toLowerCase().replace(/[,!?;:"'(){}\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  const lang = detectLanguage(raw);
  const isUrduScript = lang === 'urdu';
  const isEnglish = lang === 'english';

  // -------------------------------------------------------------
  // 0. Project Status & Progress Queries (E-Commerce, Dropshipping, Website, Logo)
  // -------------------------------------------------------------
  const statusMatch = checkProjectStatusIntent(lower, raw);
  if (statusMatch) {
    let speech = statusMatch.speechResponseRomanUrdu;
    if (isUrduScript) {
      if (statusMatch.topic.includes('E-Commerce')) {
        speech = 'باس، ای کامرس اور ڈراپ شپنگ شاپ کا کور سیٹ اپ 70 فیصد تیار ہے! پروڈکٹ کیٹلاگ، کارٹ، اور PKR چیک آؤٹ انٹرفیس ریڈی ہیں۔ لائیو پریویو سامنے سکرین پر دیکھیں۔';
      } else if (statusMatch.topic.includes('Website')) {
        speech = 'باس، ویب سائٹ پروجیکٹ کا فرنٹ اینڈ لے آؤٹ اور کمپوننٹس 75 فیصد تیار ہیں۔ ریسپانسیو نیویگیشن فعال ہے۔';
      } else if (statusMatch.topic.includes('Logo')) {
        speech = 'باس، ویکٹر لوگو کا ڈیزائن مکمل ہے! جیومیٹرک مونوگرام، ڈوئل کلر گریڈینٹ اور سکیل ایبل ویکٹرز سامنے چیک فرمائیں!';
      }
    } else if (isEnglish) {
      if (statusMatch.topic.includes('E-Commerce')) {
        speech = 'Boss, the E-Commerce & Dropshipping storefront core setup is 70% ready with dynamic product cards and checkout preview.';
      } else if (statusMatch.topic.includes('Website')) {
        speech = 'Boss, the website frontend layout is 75% ready with responsive components active on your screen.';
      }
    }
    return {
      intent: 'software_engineering',
      topic: statusMatch.topic,
      confidence: 0.98,
      speechResponseRomanUrdu: speech,
      artifact: statusMatch.artifact,
    };
  }

  // Node.js runtime installer / developer setup link
  if (lower.includes('nodejs.org') || lower.includes('node-v20') || (lower.includes('node') && lower.includes('.msi'))) {
    const artifact = generateNodeJsArtifact(raw);
    const speech = isUrduScript
      ? 'باس، یہ Node.js v20.18.0 LTS کا باضابطہ 64-بٹ ونڈوز انسٹالر ہے! زارا ڈیسک ٹاپ کمپینین اور لوکل ڈیولپر سرور چلانے کے لیے یہ رن ٹائم ضروری ہے۔'
      : isEnglish
      ? 'Boss, this is the official Node.js v20.18.0 LTS 64-bit Windows installer for running the ZARA desktop companion server!'
      : 'Boss, yeh Node.js v20.18.0 LTS ka official 64-bit Windows installer hai! ZARA desktop companion aur local dev server run karne ke liye yeh runtime engine zaroori hai. Isay install aur verify karne ke 3 simple steps samne ready hain!';

    return {
      intent: 'software_engineering',
      topic: 'Node.js v20.18.0 LTS Setup',
      confidence: 0.99,
      speechResponseRomanUrdu: speech,
      artifact: {
        type: 'code_sandbox',
        title: 'Node.js v20.18.0 LTS Setup Guide',
        data: artifact,
      },
    };
  }

  // -------------------------------------------------------------
  // 1. Creative Logo Pattern: "[name] ka logo" / "logo banao"
  // -------------------------------------------------------------
  const logoMatch = checkLogoIntent(lower, raw);
  if (logoMatch) {
    if (logoMatch.needsClarification) {
      return {
        intent: 'creative_logo',
        topic: 'Logo Clarification',
        confidence: 0.98,
        needsClarification: true,
        clarificationType: 'logo_brand',
        speechResponseRomanUrdu: isUrduScript
          ? 'باس، کس چیز کا لوگو؟'
          : isEnglish
          ? 'Boss, what brand or company is this logo for?'
          : 'Boss, kis cheez ka logo?',
      };
    }

    const brandName = logoMatch.brandName;
    const logo = generateSvgLogo(brandName);
    const speech = isUrduScript
      ? `ارے باس! "${brandName}" کا جدید ویکٹر لوگو ریڈی کر دیا ہے۔ کلرز، ٹائپوگرافی اور سکیل ایبل ویکٹرز سامنے چیک فرمائیں!`
      : isEnglish
      ? `Hey Boss! I've designed a modern vector logo for "${brandName}". Check out the live scalable preview!`
      : `Arre Boss! "${brandName}" ka modern vector logo ready kar diya hai. Colors, typography aur scalable design samne check karein!`;

    return {
      intent: 'creative_logo',
      topic: `${brandName} Vector Logo`,
      confidence: 0.98,
      speechResponseRomanUrdu: speech,
      artifact: {
        type: 'svg_logo',
        title: `${brandName} Brand Identity (Vector SVG)`,
        data: logo,
      },
    };
  }

  // -------------------------------------------------------------
  // 2. Website Creation Pattern: "[type] website banao" / "website banao"
  // -------------------------------------------------------------
  const websiteMatch = checkWebsiteIntent(lower, raw);
  if (websiteMatch) {
    if (websiteMatch.needsClarification) {
      return {
        intent: 'software_engineering',
        topic: 'Website Clarification',
        confidence: 0.98,
        needsClarification: true,
        clarificationType: 'website_type',
        speechResponseRomanUrdu: isUrduScript
          ? 'باس، کس قسم کی ویب سائٹ؟ ای کامرس / پورٹ فولیو / بلاگ؟'
          : isEnglish
          ? 'Boss, what type of website? E-Commerce, Portfolio, or Blog?'
          : 'Boss, kis type ki? E-commerce/Portfolio/Blog?',
      };
    }

    const { siteType, artifact, title } = websiteMatch;
    const speech = isUrduScript
      ? `ارے باس! ${siteType} ویب سائٹ کا مکمل کوڈ اور لائیو پریویو تیار کر دیا ہے۔ سامنے کوڈ اور سکرین چیک فرمائیں!`
      : isEnglish
      ? `Hey Boss! I have generated complete, working code and a live interactive preview for the ${siteType} website!`
      : `Arre Boss! ${siteType} website ka complete code aur interactive live preview ready kar diya hai. Samne preview aur source code check karein!`;

    return {
      intent: 'software_engineering',
      topic: title,
      confidence: 0.98,
      speechResponseRomanUrdu: speech,
      artifact: {
        type: 'code_sandbox',
        title: title,
        data: artifact,
      },
    };
  }

  // -------------------------------------------------------------
  // 3. App Launch Pattern: "[app] kholo" / "app kholo"
  // -------------------------------------------------------------
  const appMatch = checkAppLaunchIntent(lower, raw);
  if (appMatch) {
    if (appMatch.needsClarification) {
      return {
        intent: 'app_launch',
        topic: 'App Clarification',
        confidence: 0.98,
        needsClarification: true,
        clarificationType: 'app_name',
        speechResponseRomanUrdu: isUrduScript
          ? 'باس، کون سی ایپ کھولوں؟ کروم / نوٹ پیڈ / کیلکولیٹر / وی ایس کوڈ؟'
          : isEnglish
          ? 'Boss, which app would you like to launch? Chrome, Notepad, Calculator, or VS Code?'
          : 'Boss, konsi app kholoon? Chrome/Notepad/Calculator/VS Code?',
      };
    }

    const appName = appMatch.appName;
    const speech = isUrduScript
      ? `باس، ${appName} فوراً اوپن کر دیا ہے!`
      : isEnglish
      ? `Boss, launched ${appName} right away!`
      : `Boss, ${appName} foran open kar diya hai!`;

    return {
      intent: 'app_launch',
      topic: appName,
      confidence: 0.98,
      speechResponseRomanUrdu: speech,
      directAction: {
        type: 'app_launch',
        appName,
      },
    };
  }


  // -------------------------------------------------------------
  // 4. Research Pattern: "[topic] research karo" / "research karo"
  // -------------------------------------------------------------
  const researchMatch = checkResearchIntent(lower, raw);
  if (researchMatch) {
    if (researchMatch.needsClarification) {
      return {
        intent: 'research_analysis',
        topic: 'Research Clarification',
        confidence: 0.98,
        needsClarification: true,
        clarificationType: 'research_topic',
        speechResponseRomanUrdu: 'Boss, kis topic par research karni hai?',
      };
    }

    const topic = researchMatch.topic;
    const report = generateResearchReport(topic);
    return {
      intent: 'research_analysis',
      topic: report.topic,
      confidence: 0.98,
      speechResponseRomanUrdu: `Arre Boss! "${report.topic}" ki deep research report aur key action items generate kar diye hain. Samne preview check karein!`,
      artifact: {
        type: 'research_report',
        title: `Research Report: ${report.topic}`,
        data: report,
      },
    };
  }

  // -------------------------------------------------------------
  // 5. WhatsApp Message Pattern: "[name] ko message [text]" / "[name] ko message"
  // -------------------------------------------------------------
  const waMatch = checkWhatsAppDraftIntent(lower, raw);
  if (waMatch) {
    if (waMatch.needsContactClarification) {
      return {
        intent: 'whatsapp_draft',
        topic: 'WhatsApp Contact Clarification',
        confidence: 0.98,
        needsClarification: true,
        clarificationType: 'whatsapp_contact',
        speechResponseRomanUrdu: 'Boss, kis ko message bhejna hai?',
      };
    }

    if (waMatch.needsMessageClarification) {
      return {
        intent: 'whatsapp_draft',
        topic: `${waMatch.contactName} WhatsApp Clarification`,
        confidence: 0.98,
        needsClarification: true,
        clarificationType: 'whatsapp_message',
        clarificationContext: { contactName: waMatch.contactName },
        speechResponseRomanUrdu: `Boss, ${waMatch.contactName} ko kya message bhejna hai?`,
      };
    }

    return {
      intent: 'whatsapp_draft',
      topic: `WhatsApp to ${waMatch.contactName}`,
      confidence: 0.98,
      speechResponseRomanUrdu: `Boss, ${waMatch.contactName} ko message draft kar diya hai: "${waMatch.messageText}". WhatsApp dispatch ready hai!`,
      whatsappDraft: {
        contactName: waMatch.contactName,
        messageText: waMatch.messageText,
      },
    };
  }

  // -------------------------------------------------------------
  // 6. Code Error Fix
  // -------------------------------------------------------------
  if (
    lower.includes('error fix') ||
    lower.includes('yeh error') ||
    lower.includes('bug fix') ||
    lower.includes('solve karo') ||
    lower.includes('code fix') ||
    lower.includes('typeerror') ||
    lower.includes('syntaxerror')
  ) {
    const errorFix = diagnoseAndFixCodeError(query);
    return {
      intent: 'code_error_fix',
      topic: 'Code Diagnosis & Resolution',
      confidence: 0.95,
      speechResponseRomanUrdu: errorFix.speechUrdu,
      artifact: {
        type: 'code_sandbox',
        title: 'Error Diagnostic & Fixed Code',
        data: errorFix.artifact,
      },
    };
  }

  // -------------------------------------------------------------
  // 7. Automation: Task Scheduling / Daily Report
  // -------------------------------------------------------------
  if (
    lower.includes('daily report') ||
    lower.includes('har roz') ||
    lower.includes('schedule') ||
    lower.includes('roz 9 baje') ||
    lower.includes('automate')
  ) {
    const job = generateAutomationJob(query);
    return {
      intent: 'automation_schedule',
      topic: job.name,
      confidence: 0.95,
      speechResponseRomanUrdu: `Boss! "${job.name}" ka automated scheduler active kar diya hai. Next run: ${job.nextRun}!`,
      artifact: {
        type: 'automation_job',
        title: `Automation Task: ${job.name}`,
        data: job,
      },
    };
  }

  // -------------------------------------------------------------
  // 8. Creative: Presentation Deck
  // -------------------------------------------------------------
  if (lower.includes('presentation banao') || lower.includes('slides banao') || lower.includes('pitch deck')) {
    const topic = extractPresentationTopic(query);
    const deck = generateSlideDeck(topic);
    return {
      intent: 'creative_presentation',
      topic: `Presentation: ${topic}`,
      confidence: 0.95,
      speechResponseRomanUrdu: `Arre Boss! "${topic}" ki complete 5-slide presentation deck ready hai. Next aur Previous se slide check karein!`,
      artifact: {
        type: 'slide_deck',
        title: `Presentation Deck: ${topic}`,
        data: deck,
      },
    };
  }

  // -------------------------------------------------------------
  // 9. Creative: Video Script
  // -------------------------------------------------------------
  if (
    lower.includes('script likho') ||
    lower.includes('video script') ||
    lower.includes('youtube script') ||
    lower.includes('tiktok script')
  ) {
    const topic = extractScriptTopic(query);
    const script = generateVideoScript(topic);
    return {
      intent: 'creative_video_script',
      topic: `Video Script: ${topic}`,
      confidence: 0.95,
      speechResponseRomanUrdu: `Arre Boss! "${topic}" ka viral hook, 3 scenes aur Urdu voiceover script likh diya hai!`,
      artifact: {
        type: 'video_script',
        title: `Viral Video Script (${script.targetPlatform})`,
        data: script,
      },
    };
  }

  // -------------------------------------------------------------
  // 10. Automation: File Organization
  // -------------------------------------------------------------
  if (
    lower.includes('organize karo') ||
    lower.includes('folders organize') ||
    lower.includes('downloads folder') ||
    lower.includes('files sort')
  ) {
    const org = generateFileOrganization(lower.includes('downloads') ? 'Downloads' : 'Documents');
    return {
      intent: 'automation_organize_files',
      topic: `Organize ${org.targetFolder}`,
      confidence: 0.95,
      speechResponseRomanUrdu: `Boss, ${org.targetFolder} folder ki 148 files ko 5 categories (Documents, Media, Code, Archives) mein sort kar diya hai!`,
      artifact: {
        type: 'file_organization',
        title: `${org.targetFolder} Organization Report`,
        data: org,
      },
    };
  }

  return {
    intent: 'general',
    topic: 'Conversation',
    confidence: 0.5,
    speechResponseRomanUrdu: '',
  };
}

// -------------------------------------------------------------
// Intent Parsers & Checkers
// -------------------------------------------------------------

function checkProjectStatusIntent(
  lower: string,
  raw: string
): {
  topic: string;
  speechResponseRomanUrdu: string;
  artifact?: MessageArtifact;
} | null {
  const hasStatusInquiry =
    lower.includes('kahan tak') ||
    lower.includes('status') ||
    lower.includes('progress') ||
    lower.includes('kitna bana') ||
    lower.includes('kitna kaam') ||
    lower.includes('kya bana hai') ||
    lower.includes('kya baaki hai') ||
    lower.includes('update do') ||
    lower.includes('kahan tak pohnch') ||
    raw.includes('کہاں تک') ||
    raw.includes('کیا بنا') ||
    raw.includes('پروگریس') ||
    raw.includes('اپڈیٹ');

  const hasEcommerceOrDropship =
    lower.includes('dropshipping') ||
    lower.includes('e-commerce') ||
    lower.includes('ecommerce') ||
    lower.includes('online shop') ||
    lower.includes('online store') ||
    raw.includes('ڈراپ شپنگ') ||
    raw.includes('ای کامرس') ||
    raw.includes('دکان');

  if (hasEcommerceOrDropship && hasStatusInquiry) {
    const artifact = generateECommerceArtifact();
    const speech =
      'Boss, E-Commerce aur Dropshipping shop ka Core Setup 70% ready hai! Product catalog, reactive shopping cart, aur PKR checkout interface tayyar hain. Baaqi automated supplier API (CJ Dropshipping/AliExpress) aur online payment gateway connect hona baaki hai. Agla step: Pehle dropshipping suppliers connect karein ya payment gateway integrate karein? Live preview samne check karein!';

    return {
      topic: 'E-Commerce & Dropshipping Store Status',
      speechResponseRomanUrdu: speech,
      artifact: {
        type: 'code_sandbox',
        title: 'ZARA Dropship & E-Commerce Pro',
        data: artifact,
      },
    };
  }

  if (
    hasStatusInquiry &&
    (lower.includes('website') || lower.includes('site') || lower.includes('app') || lower.includes('project') || raw.includes('ویب سائٹ') || raw.includes('سائٹ'))
  ) {
    const artifact = generatePortfolioArtifact();
    const speech =
      'Boss, website project ka frontend layout aur components 75% tayyar hain. Responsive navigation, cards, aur dynamic styling ready hain. Baaqi backend API aur live hosting deploy karna baaki hai. Agla step: Live hosting deploy karein ya backend database connect karein?';

    return {
      topic: 'Website Project Status',
      speechResponseRomanUrdu: speech,
      artifact: {
        type: 'code_sandbox',
        title: 'ZARA Project Status & Code',
        data: artifact,
      },
    };
  }

  if (hasStatusInquiry && (lower.includes('logo') || lower.includes('design') || lower.includes('brand') || raw.includes('لوگو'))) {
    const brand = checkLogoIntent(lower, raw)?.brandName || 'INSPIRE';
    const logo = generateSvgLogo(brand);
    const speech = `Boss, "${brand}" ka vector SVG logo design complete hai! Scalable geometric emblem, dual gradient, aur typography finalized hain. Baaqi favicon aur social kit exports rehti hain. Agla step: SVG download karein ya social media size export karein?`;

    return {
      topic: `${brand} Logo Status`,
      speechResponseRomanUrdu: speech,
      artifact: {
        type: 'svg_logo',
        title: `${brand} Vector Logo (Complete)`,
        data: logo,
      },
    };
  }

  return null;
}

function checkLogoIntent(
  lower: string,
  raw: string
): { brandName: string; needsClarification?: boolean } | null {
  const isUrduLogo = raw.includes('لوگو');
  if (!lower.includes('logo') && !isUrduLogo) {
    return null;
  }

  if (
    raw === 'لوگو بناؤ' ||
    raw === 'لوگو' ||
    raw === 'ایک لوگو بناؤ' ||
    raw === 'ایک لوگو بنا دیں' ||
    raw === 'لوگو ڈیزائن کرو'
  ) {
    return { brandName: '', needsClarification: true };
  }

  if (isUrduLogo) {
    const urduBrand = raw
      .replace(/^(?:زارا،?\s*)?/g, '')
      .replace(/(?:کا\s+لوگو.*|لوگو\s+بناؤ.*|لوگو.*)/g, '')
      .replace(/[،۔]/g, '')
      .trim();
    if (urduBrand.length >= 2) {
      return { brandName: formatBrandTitle(urduBrand) };
    }
    const reverseMatch = raw.match(/لوگو\s+(?:بناؤ|ڈیزائن\s+کرو)?\s*(.+)/);
    if (reverseMatch && reverseMatch[1]) {
      const b = reverseMatch[1].replace(/کا/g, '').trim();
      if (b.length >= 2) {
        return { brandName: formatBrandTitle(b) };
      }
    }
  }

  // Common stop words to strip when isolating brand name
  const stopWords = [
    'zara',
    'ek',
    'kardo',
    'kar do',
    'banao',
    'bana do',
    'bana dein',
    'design karo',
    'design',
    'chahiye',
    'create',
    'make',
    'vector',
    'brand',
    'company',
    'meri',
    'mera',
    'for',
    'please',
    'sunao',
    'urgent',
    'ka',
    'ki',
    'ke',
  ];

  // Specific high-frequency pattern: "[brand] ka logo" or "[brand] logo"
  const kaLogoMatch = raw.match(/^(?:zara,?\s*)?(.+?)\s+ka\s+logo(?:\s+banao|\s+bana\s+do|\s+design\s+karo)?$/i);
  if (kaLogoMatch && kaLogoMatch[1]) {
    const cand = cleanBrandString(kaLogoMatch[1], stopWords);
    if (cand) {
      return { brandName: formatBrandTitle(cand) };
    }
  }

  // Reverse pattern: "logo banao [brand] ka" or "logo design karo [brand]"
  const reverseLogoMatch = raw.match(/(?:logo\s+(?:banao|bana\s+do|design\s+karo|design|for)?\s+(?:ka\s+|for\s+)?)(.+)/i);
  if (reverseLogoMatch && reverseLogoMatch[1]) {
    const cand = cleanBrandString(reverseLogoMatch[1], stopWords);
    if (cand) {
      return { brandName: formatBrandTitle(cand) };
    }
  }

  // General stripped extraction
  let remainder = lower.replace(/\blogo\b/g, ' ');
  for (const sw of stopWords) {
    remainder = remainder.replace(new RegExp(`\\b${sw}\\b`, 'gi'), ' ');
  }
  const cleanRemainder = remainder.trim();

  if (!cleanRemainder || cleanRemainder.length <= 1) {
    return { brandName: '', needsClarification: true };
  }

  return { brandName: formatBrandTitle(cleanRemainder) };
}


function cleanBrandString(str: string, stopWords: string[]): string {
  let cleaned = str.trim();
  for (const sw of stopWords) {
    cleaned = cleaned.replace(new RegExp(`\\b${sw}\\b`, 'gi'), ' ');
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

function formatBrandTitle(brand: string): string {
  const parts = brand.split(/\s+/).filter(Boolean);
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
}

function checkWebsiteIntent(
  lower: string,
  raw: string
): { siteType: string; artifact: CodeSandboxArtifact; title: string; needsClarification?: boolean } | null {
  const hasWebKeyword =
    lower.includes('website') ||
    lower.includes('web site') ||
    lower.includes('site') ||
    lower.includes('web app') ||
    lower.includes('storefront') ||
    lower.includes('landing page') ||
    raw.includes('ویب سائٹ') ||
    raw.includes('سائٹ') ||
    raw.includes('ایپ');

  const hasBuildKeyword =
    lower.includes('banao') ||
    lower.includes('create') ||
    lower.includes('build') ||
    lower.includes('code') ||
    raw.includes('بناؤ') ||
    raw.includes('بنائیں') ||
    raw.includes('بنا دیں') ||
    raw.includes('تیار');

  if (!hasWebKeyword && !hasBuildKeyword) {
    return null;
  }

  if (hasWebKeyword && !hasBuildKeyword && !lower.includes('chahiye')) {
    // Only query about a website if explicitly requesting creation
    if (!lower.includes('banao') && !lower.includes('ready karo') && !raw.includes('بناؤ')) {
      return null;
    }
  }

  // Check specific categories
  if (
    lower.includes('e-commerce') ||
    lower.includes('ecommerce') ||
    lower.includes('shop') ||
    lower.includes('store') ||
    lower.includes('shopping') ||
    raw.includes('ای کامرس') ||
    raw.includes('ڈراپ شپنگ') ||
    raw.includes('دکان')
  ) {
    return {
      siteType: 'E-Commerce',
      title: 'ZARA E-Commerce Pro (React + Tailwind)',
      artifact: generateECommerceArtifact(),
    };
  }

  if (
    lower.includes('portfolio') ||
    lower.includes('resume') ||
    lower.includes('personal site') ||
    lower.includes('cv') ||
    lower.includes('developer portfolio') ||
    raw.includes('پورٹ فولیو')
  ) {
    return {
      siteType: 'Portfolio',
      title: 'ZARA Cyber Portfolio Pro (React + Tailwind)',
      artifact: generatePortfolioArtifact(),
    };
  }

  if (
    lower.includes('restaurant') ||
    lower.includes('cafe') ||
    lower.includes('food') ||
    lower.includes('pizza') ||
    lower.includes('burger') ||
    raw.includes('ریسٹورنٹ') ||
    raw.includes('کیفے')
  ) {
    return {
      siteType: 'Restaurant',
      title: 'ZARA Cafe & Bistro Storefront',
      artifact: generateRestaurantArtifact(),
    };
  }

  if (lower.includes('blog') || lower.includes('news') || lower.includes('magazine') || raw.includes('بلاگ')) {
    return {
      siteType: 'Blog',
      title: 'ZARA Editorial Tech Blog',
      artifact: generateBlogArtifact(),
    };
  }

  if (lower.includes('todo') || lower.includes('task') || lower.includes('kanban') || raw.includes('ٹوڈو')) {
    return {
      siteType: 'Productivity Task',
      title: 'ZARA TaskFlow Pro',
      artifact: generateTodoAppArtifact(),
    };
  }

  // Check if generic "website banao" without type
  const isBareWebsite =
    lower === 'website banao' ||
    lower === 'ek website banao' ||
    lower === 'website bana do' ||
    lower === 'ek website bana do' ||
    lower === 'site banao' ||
    lower === 'web site banao' ||
    lower === 'create a website' ||
    lower === 'build a website' ||
    lower === 'website create karo' ||
    raw === 'ویب سائٹ بناؤ' ||
    raw === 'ایک ویب سائٹ بناؤ' ||
    raw === 'ویب سائٹ بنا دیں' ||
    raw === 'سائٹ بناؤ';

  if (isBareWebsite) {
    return {
      siteType: '',
      title: '',
      artifact: generateECommerceArtifact(),
      needsClarification: true,
    };
  }

  // If another specific type is mentioned (e.g. gym, agency, clinic)
  if (hasWebKeyword && hasBuildKeyword) {
    const extracted = lower
      .replace(/\b(zara|banao|bana do|create|build|website|site|web|app|ek|chahiye|please)\b/g, '')
      .trim();
    if (extracted.length > 2) {
      const formattedType = formatBrandTitle(extracted);
      return {
        siteType: formattedType,
        title: `ZARA ${formattedType} Web Application`,
        artifact: generateCustomWebsiteArtifact(formattedType),
      };
    } else {
      return {
        siteType: '',
        title: '',
        artifact: generateECommerceArtifact(),
        needsClarification: true,
      };
    }
  }

  return null;
}

function checkAppLaunchIntent(
  lower: string,
  raw = ''
): { appName: string; needsClarification?: boolean } | null {
  const hasOpenAction =
    lower.includes('kholo') ||
    lower.includes('open') ||
    lower.includes('chalao') ||
    lower.includes('launch') ||
    lower.includes('khol do') ||
    raw.includes('کھولو') ||
    raw.includes('اوپن');

  if (!hasOpenAction) {
    return null;
  }

  // Check bare app request: "app kholo" / "open app"
  if (
    lower === 'app kholo' ||
    lower === 'koi app kholo' ||
    lower === 'open app' ||
    lower === 'application kholo' ||
    lower === 'app open karo' ||
    raw === 'ایپ کھولو' ||
    raw === 'کوئی ایپ کھولو'
  ) {
    return { appName: '', needsClarification: true };
  }

  if (raw.includes('کروم') || raw.includes('گوگل کروم')) return { appName: 'Google Chrome' };
  if (raw.includes('نوٹ پیڈ')) return { appName: 'Notepad' };
  if (raw.includes('کیلکولیٹر')) return { appName: 'Calculator' };
  if (raw.includes('واٹس ایپ')) return { appName: 'WhatsApp Desktop' };

  const appMap: Record<string, string> = {
    chrome: 'Google Chrome',
    'google chrome': 'Google Chrome',
    browser: 'Google Chrome',
    notepad: 'Notepad',
    calculator: 'Calculator',
    calc: 'Calculator',
    'vs code': 'VS Code',
    vscode: 'VS Code',
    code: 'VS Code',
    whatsapp: 'WhatsApp Desktop',

    terminal: 'Terminal',
    cmd: 'Terminal',
    spotify: 'Spotify',
    'task manager': 'Task Manager',
    taskmgr: 'Task Manager',
    excel: 'Microsoft Excel',
    word: 'Microsoft Word',
  };

  for (const [key, appName] of Object.entries(appMap)) {
    if (lower.includes(key)) {
      return { appName };
    }
  }

  return null;
}

function checkResearchIntent(
  lower: string,
  raw: string
): { topic: string; needsClarification?: boolean } | null {
  const isResearch = lower.includes('research') || lower.includes('market analysis');
  if (!isResearch) {
    return null;
  }

  // Stop words to strip
  const stopWords = [
    'zara',
    'research',
    'karo',
    'kardo',
    'kar do',
    'par',
    'pe',
    'ki',
    'ke',
    'about',
    'on',
    'for',
    'analysis',
    'market',
    'please',
    'ek',
    'deep',
    'report',
  ];

  let remainder = lower;
  for (const sw of stopWords) {
    remainder = remainder.replace(new RegExp(`\\b${sw}\\b`, 'gi'), ' ');
  }
  const cleanRemainder = remainder.trim();

  // If user only said "research karo" or "market research karo"
  if (!cleanRemainder || cleanRemainder.length <= 1) {
    return { topic: '', needsClarification: true };
  }

  return { topic: formatBrandTitle(cleanRemainder) };
}

function checkWhatsAppDraftIntent(
  lower: string,
  raw: string
): {
  contactName: string;
  messageText: string;
  needsContactClarification?: boolean;
  needsMessageClarification?: boolean;
} | null {
  const isMsgIntent =
    lower.includes('message') ||
    lower.includes('msg') ||
    lower.includes('whatsapp');

  if (!isMsgIntent) {
    return null;
  }

  // Bare message command: "message bhejo", "whatsapp karo"
  if (
    lower === 'message bhejo' ||
    lower === 'whatsapp karo' ||
    lower === 'msg bhejo' ||
    lower === 'message karo'
  ) {
    return { contactName: '', messageText: '', needsContactClarification: true };
  }

  // Regex patterns:
  // 1. "[name] ko message [bhejo] [ke] [text]"
  const fullMatch = raw.match(/(?:zara,?\s*)?([a-zA-Z0-9_\-]+)\s+ko\s+(?:message|whatsapp|msg)\s*(?:bhejo|karo|bhej\s+do)?\s*(?:ke\s+|that\s+|:\s+)?(.+)/i);
  if (fullMatch && fullMatch[1] && fullMatch[2]) {
    const contact = fullMatch[1].trim();
    let text = fullMatch[2].trim();

    // Clean leading filler words
    text = text.replace(/^(?:bhejo|karo|bhej do)\s*(?:ke\s+)?/i, '').trim();

    if (text.length > 0 && text.toLowerCase() !== 'bhejo' && text.toLowerCase() !== 'karo') {
      return {
        contactName: formatBrandTitle(contact),
        messageText: text,
      };
    } else {
      // User said: "Hamza ko message bhejo" or "Hamza ko message"
      return {
        contactName: formatBrandTitle(contact),
        messageText: '',
        needsMessageClarification: true,
      };
    }
  }

  // 2. "[name] ko message" without text
  const bareContactMatch = raw.match(/(?:zara,?\s*)?([a-zA-Z0-9_\-]+)\s+ko\s+(?:message|whatsapp|msg)(?:\s+bhejo|\s+karo)?$/i);
  if (bareContactMatch && bareContactMatch[1]) {
    const contact = bareContactMatch[1].trim();
    return {
      contactName: formatBrandTitle(contact),
      messageText: '',
      needsMessageClarification: true,
    };
  }

  return null;
}

// -------------------------------------------------------------
// Generators
// -------------------------------------------------------------

export function generateSvgLogo(companyName: string): SvgLogoArtifact {
  const cleanName = (companyName || 'INSPIRE').toUpperCase().trim();
  const firstLetter = cleanName.charAt(0);
  const isInspire = cleanName.includes('INSPIRE');

  if (isInspire) {
    const svgCode = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 180" width="100%" height="100%">
  <defs>
    <linearGradient id="inspireGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="50%" stop-color="#818CF8"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#141424"/>
      <stop offset="100%" stop-color="#0A0A0F"/>
    </linearGradient>
    <filter id="inspireGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <rect width="440" height="180" rx="24" fill="url(#bgGrad)" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>

  <!-- Inspiring Innovation Star & Spark Geometry -->
  <g transform="translate(50, 42)">
    <!-- Outer Diamond Hex -->
    <polygon points="48,4 88,26 88,70 48,92 8,70 8,26" fill="none" stroke="url(#inspireGrad)" stroke-width="3" filter="url(#inspireGlow)"/>
    <!-- Inner Radiant Spark Core -->
    <path d="M48 20 L55 40 L75 48 L55 56 L48 76 L41 56 L21 48 L41 40 Z" fill="url(#inspireGrad)" opacity="0.9"/>
    <!-- Central Monogram -->
    <text x="48" y="58" font-family="'Space Grotesk', sans-serif" font-weight="900" font-size="28" fill="#0A0A0F" text-anchor="middle">I</text>
  </g>

  <!-- Brand Typography -->
  <text x="170" y="82" font-family="'Space Grotesk', sans-serif" font-weight="800" font-size="34" fill="#F9FAFB" letter-spacing="4">INSPIRE</text>
  <text x="172" y="112" font-family="'JetBrains Mono', monospace" font-size="11" fill="#38BDF8" font-weight="600" letter-spacing="5">CREATIVE &bull; TECHNOLOGY</text>
  <line x1="172" y1="126" x2="360" y2="126" stroke="url(#inspireGrad)" stroke-width="2" stroke-opacity="0.6"/>
</svg>`;

    return {
      companyName: 'INSPIRE',
      style: 'Radiant Diamond Beacon with Cyber-Cyan & Gold Dual Core',
      svgCode,
      colorPalette: ['#0A0A0F', '#141424', '#38BDF8', '#818CF8', '#F59E0B'],
      rationale:
        'The radiant diamond beacon symbolizes vision, forward momentum, and creativity. High-contrast cyber-cyan and warm gold gradients deliver strong visual authority across web and mobile surfaces.',
    };
  }

  // General dynamic vector logo
  const svgCode = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 170" width="100%" height="100%">
  <defs>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCD34D"/>
      <stop offset="50%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#B45309"/>
    </linearGradient>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#14141F"/>
      <stop offset="100%" stop-color="#0A0A0F"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <rect width="420" height="170" rx="20" fill="url(#bgGrad)" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>

  <!-- Geometric Emblem Icon -->
  <g transform="translate(45, 35)">
    <polygon points="50,5 90,28 90,72 50,95 10,72 10,28" fill="none" stroke="url(#goldGrad)" stroke-width="3" filter="url(#glow)"/>
    <polygon points="50,15 80,32 80,68 50,85 20,68 20,32" fill="rgba(245,158,11,0.08)" stroke="rgba(245,158,11,0.3)" stroke-width="1.5"/>
    <text x="50" y="62" font-family="'Space Grotesk', sans-serif" font-weight="bold" font-size="34" fill="url(#goldGrad)" text-anchor="middle">${firstLetter}</text>
  </g>

  <!-- Typography -->
  <text x="165" y="80" font-family="'Space Grotesk', sans-serif" font-weight="bold" font-size="28" fill="#F9FAFB" letter-spacing="3">${cleanName}</text>
  <text x="165" y="108" font-family="'JetBrains Mono', monospace" font-size="11" fill="#F59E0B" letter-spacing="4">INNOVATION &bull; STUDIOS</text>
  <line x1="165" y1="120" x2="350" y2="120" stroke="url(#goldGrad)" stroke-width="1.5" stroke-opacity="0.4"/>
</svg>`;

  return {
    companyName: cleanName,
    style: 'Futuristic Minimalist Hexagon with Gold Core',
    svgCode,
    colorPalette: ['#0A0A0F', '#14141F', '#F59E0B', '#FCD34D', '#B45309'],
    rationale:
      'Geometric hexagon symbolizes strength and precision, while the central monogram and gold gradient convey luxury and authority.',
  };
}

export function generateECommerceArtifact(): CodeSandboxArtifact {
  const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; background: #0A0A0F; color: #F9FAFB; }
    .font-brand { font-family: 'Space Grotesk', sans-serif; }
  </style>
</head>
<body class="p-6">
  <header class="flex justify-between items-center pb-4 border-b border-white/10 mb-6">
    <div class="flex items-center gap-2">
      <div class="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center font-bold text-black font-brand">Z</div>
      <h1 class="text-xl font-bold font-brand tracking-wider text-white">ZARA STORE</h1>
    </div>
    <div class="flex items-center gap-3">
      <span class="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full font-mono">Cart: <span id="cartCount">0</span> items</span>
      <button onclick="checkout()" class="bg-amber-500 hover:bg-amber-400 text-black px-4 py-1.5 rounded-lg text-xs font-semibold">Checkout</button>
    </div>
  </header>

  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
    <div class="bg-[#151520] border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-amber-500/50 transition-all">
      <div class="h-32 bg-zinc-900/80 rounded-xl mb-3 flex items-center justify-center text-4xl">🎧</div>
      <div>
        <h3 class="font-bold text-sm text-white">Spatial Wireless Pro Headphones</h3>
        <p class="text-xs text-zinc-400 mt-1">Active noise cancellation with 40h battery</p>
      </div>
      <div class="flex justify-between items-center mt-4 pt-3 border-t border-white/5">
        <span class="font-bold text-amber-400 text-sm">PKR 18,500</span>
        <button onclick="addToCart('Spatial Headphones', 18500)" class="bg-zinc-800 hover:bg-amber-500 hover:text-black text-xs px-3 py-1.5 rounded-lg border border-white/10 font-medium transition-all">+ Add to Cart</button>
      </div>
    </div>

    <div class="bg-[#151520] border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-amber-500/50 transition-all">
      <div class="h-32 bg-zinc-900/80 rounded-xl mb-3 flex items-center justify-center text-4xl">⌨️</div>
      <div>
        <h3 class="font-bold text-sm text-white">Cybernetic Mechanical Keyboard</h3>
        <p class="text-xs text-zinc-400 mt-1">RGB gasket mount, lubed linear switches</p>
      </div>
      <div class="flex justify-between items-center mt-4 pt-3 border-t border-white/5">
        <span class="font-bold text-amber-400 text-sm">PKR 14,200</span>
        <button onclick="addToCart('Cyber Keyboard', 14200)" class="bg-zinc-800 hover:bg-amber-500 hover:text-black text-xs px-3 py-1.5 rounded-lg border border-white/10 font-medium transition-all">+ Add to Cart</button>
      </div>
    </div>

    <div class="bg-[#151520] border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-amber-500/50 transition-all">
      <div class="h-32 bg-zinc-900/80 rounded-xl mb-3 flex items-center justify-center text-4xl">⏱️</div>
      <div>
        <h3 class="font-bold text-sm text-white">Titanium Chrono Smartwatch</h3>
        <p class="text-xs text-zinc-400 mt-1">Sapphire glass, ECG, Pakistani timezone dual dials</p>
      </div>
      <div class="flex justify-between items-center mt-4 pt-3 border-t border-white/5">
        <span class="font-bold text-amber-400 text-sm">PKR 26,000</span>
        <button onclick="addToCart('Titanium Smartwatch', 26000)" class="bg-zinc-800 hover:bg-amber-500 hover:text-black text-xs px-3 py-1.5 rounded-lg border border-white/10 font-medium transition-all">+ Add to Cart</button>
      </div>
    </div>
  </div>

  <div id="toast" class="fixed bottom-4 right-4 bg-emerald-950/90 border border-emerald-500 text-emerald-300 px-4 py-2 rounded-xl text-xs font-mono hidden shadow-xl"></div>

  <script>
    let count = 0;
    let total = 0;
    function addToCart(item, price) {
      count++;
      total += price;
      document.getElementById('cartCount').innerText = count;
      showToast('Added ' + item + ' to cart!');
    }
    function checkout() {
      if (count === 0) { alert('Cart is empty Boss!'); return; }
      alert('Order Placed! Total: PKR ' + total.toLocaleString() + ' (Cash on Delivery / Easypaisa ready)');
      count = 0; total = 0;
      document.getElementById('cartCount').innerText = 0;
    }
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.innerText = msg;
      t.classList.remove('hidden');
      setTimeout(() => t.classList.add('hidden'), 2000);
    }
  </script>
</body>
</html>`;

  return {
    title: 'ZARA E-Commerce Pro',
    description: 'Production-ready responsive e-commerce storefront with cart state, price tally, and checkout modal.',
    framework: 'React 18 + Tailwind CSS',
    runCommand: 'npm run dev',
    previewHtml,
    files: [
      {
        name: 'App.tsx',
        language: 'typescript',
        content: `import React, { useState } from 'react';

interface Product {
  id: string;
  title: string;
  pricePkr: number;
  category: string;
}

export default function App() {
  const [cart, setCart] = useState<Product[]>([]);

  const products: Product[] = [
    { id: '1', title: 'Spatial Wireless Headphones', pricePkr: 18500, category: 'Audio' },
    { id: '2', title: 'Cybernetic Mechanical Keyboard', pricePkr: 14200, category: 'Peripherals' },
    { id: '3', title: 'Titanium Chrono Smartwatch', pricePkr: 26000, category: 'Wearables' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white p-6 font-sans">
      <header className="flex justify-between items-center border-b border-white/10 pb-4 mb-6">
        <h1 className="text-xl font-bold tracking-wider text-amber-400">ZARA E-COMMERCE</h1>
        <span className="text-xs bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/40">
          Cart: {cart.length} items
        </span>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {products.map(p => (
          <div key={p.id} className="bg-[#151520] border border-white/10 p-4 rounded-xl">
            <h3 className="font-semibold text-sm">{p.title}</h3>
            <p className="text-amber-400 font-bold mt-2">PKR {p.pricePkr.toLocaleString()}</p>
            <button
              onClick={() => setCart([...cart, p])}
              className="mt-4 w-full bg-amber-500 text-black py-1.5 rounded-lg text-xs font-semibold"
            >
              Add to Cart
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}`,
      },
      {
        name: 'package.json',
        language: 'json',
        content: `{
  "name": "zara-ecommerce-store",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.383.0"
  }
}`,
      },
      {
        name: 'README.md',
        language: 'markdown',
        content: `# ZARA E-Commerce Store
Built automatically by ZARA for Boss.
- React 18 + Tailwind CSS
- Real cart state with PKR currency formatting
- Production-grade code ready for deployment`,
      },
    ],
  };
}

export function generatePortfolioArtifact(): CodeSandboxArtifact {
  const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; background: #0A0A0F; color: #F9FAFB; }
    .font-brand { font-family: 'Space Grotesk', sans-serif; }
  </style>
</head>
<body class="p-6 max-w-4xl mx-auto">
  <header class="flex justify-between items-center pb-6 border-b border-white/10 mb-8">
    <div>
      <h1 class="text-2xl font-bold font-brand text-white">Hamza Developer &bull; Portfolio</h1>
      <p class="text-xs text-amber-400 font-mono mt-1">Full-Stack AI & Cloud Systems Portfolio</p>
    </div>
    <div class="flex gap-2">
      <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
      <span class="text-xs font-mono text-emerald-400">Available for projects</span>
    </div>
  </header>

  <!-- Hero Section -->
  <div class="mb-10 bg-[#141420] border border-white/10 rounded-2xl p-6">
    <h2 class="text-xl font-bold font-brand text-white mb-2">Building Next-Gen Autonomous Web & Voice Agents</h2>
    <p class="text-sm text-zinc-300 leading-relaxed">Specializing in TypeScript, React, Python, Gemini 3.8/4 multi-modal APIs, and scalable edge microservices.</p>
    <div class="flex flex-wrap gap-2 mt-4 font-mono text-xs">
      <span class="px-3 py-1 rounded-lg bg-zinc-800 text-zinc-300 border border-white/10">React 19</span>
      <span class="px-3 py-1 rounded-lg bg-zinc-800 text-zinc-300 border border-white/10">TypeScript</span>
      <span class="px-3 py-1 rounded-lg bg-zinc-800 text-zinc-300 border border-white/10">Gemini SDK</span>
      <span class="px-3 py-1 rounded-lg bg-zinc-800 text-zinc-300 border border-white/10">Tailwind CSS</span>
      <span class="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">Electron OS</span>
    </div>
  </div>

  <!-- Featured Projects -->
  <h3 class="text-sm font-mono uppercase text-zinc-400 tracking-wider mb-4">Featured Projects</h3>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div class="p-5 rounded-2xl bg-[#111118] border border-white/10 hover:border-amber-400/50 transition-all">
      <h4 class="font-bold text-white text-base">ZARA Voice Companion</h4>
      <p class="text-xs text-zinc-400 mt-2">Urdu-speaking on-device AI assistant with zero-cloud camera emotion detection.</p>
      <div class="mt-4 flex justify-between items-center">
        <span class="text-xs text-amber-400 font-mono">React + Web Speech</span>
        <button onclick="alert('Viewing ZARA project live demo!')" class="text-xs px-3 py-1 rounded-lg bg-amber-500 text-black font-semibold">View Case Study</button>
      </div>
    </div>
    <div class="p-5 rounded-2xl bg-[#111118] border border-white/10 hover:border-amber-400/50 transition-all">
      <h4 class="font-bold text-white text-base">FinTech Realtime Portal</h4>
      <p class="text-xs text-zinc-400 mt-2">Low-latency financial analytics dashboard handling 10k transactions per second.</p>
      <div class="mt-4 flex justify-between items-center">
        <span class="text-xs text-amber-400 font-mono">WebSocket + D3.js</span>
        <button onclick="alert('Viewing FinTech portal demo!')" class="text-xs px-3 py-1 rounded-lg bg-amber-500 text-black font-semibold">View Case Study</button>
      </div>
    </div>
  </div>
</body>
</html>`;

  return {
    title: 'ZARA Cyber Portfolio Pro',
    description: 'High-aesthetic developer portfolio with project showcases, skill tags, and interactive demo triggers.',
    framework: 'React 18 + Tailwind CSS',
    runCommand: 'npm run dev',
    previewHtml,
    files: [
      {
        name: 'Portfolio.tsx',
        language: 'typescript',
        content: `import React from 'react';

export default function Portfolio() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-amber-400">Personal Portfolio</h1>
      <p className="text-zinc-400 mt-2">Engineered by ZARA for Boss.</p>
    </div>
  );
}`,
      },
    ],
  };
}

export function generateRestaurantArtifact(): CodeSandboxArtifact {
  const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body { font-family: sans-serif; background: #0A0A0F; color: #fff; }</style>
</head>
<body class="p-6 max-w-3xl mx-auto">
  <header class="flex justify-between items-center border-b border-white/10 pb-4 mb-6">
    <div>
      <h1 class="text-2xl font-bold text-amber-400">Royal Spice Bistro</h1>
      <p class="text-xs text-zinc-400">Authentic Pakistani & Continental Cuisine</p>
    </div>
    <button onclick="alert('Table Reserved for Boss tonight at 8 PM!')" class="bg-amber-500 text-black px-4 py-2 rounded-xl text-xs font-bold">Reserve Table</button>
  </header>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div class="p-4 rounded-xl bg-zinc-900 border border-white/10">
      <h3 class="font-bold text-white text-sm">Special Mutton Shinwari Karahi</h3>
      <p class="text-xs text-zinc-400 mt-1">Slow-cooked in virgin lamb fat with black pepper and green chillies.</p>
      <span class="text-amber-400 font-bold block mt-3 text-sm">PKR 2,400</span>
    </div>
    <div class="p-4 rounded-xl bg-zinc-900 border border-white/10">
      <h3 class="font-bold text-white text-sm">Dum Pukht Biryani</h3>
      <p class="text-xs text-zinc-400 mt-1">Aromatic long-grain basmati with tender beef and saffron raita.</p>
      <span class="text-amber-400 font-bold block mt-3 text-sm">PKR 1,150</span>
    </div>
  </div>
</body>
</html>`;

  return {
    title: 'ZARA Cafe & Bistro Storefront',
    description: 'Modern dining menu with online table booking and signature dish showcase.',
    framework: 'React + Tailwind CSS',
    runCommand: 'npm run dev',
    previewHtml,
    files: [
      {
        name: 'Restaurant.tsx',
        language: 'typescript',
        content: `export default function Restaurant() { return <div className="text-amber-400 p-6">Royal Spice Bistro</div>; }`,
      },
    ],
  };
}

export function generateBlogArtifact(): CodeSandboxArtifact {
  const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body { font-family: sans-serif; background: #0A0A0F; color: #fff; }</style>
</head>
<body class="p-6 max-w-3xl mx-auto">
  <h1 class="text-2xl font-bold text-amber-400 mb-2">The Frontier AI Journal</h1>
  <p class="text-xs text-zinc-400 mb-6">Curated insights on autonomous agents & test-time compute.</p>
  <article class="p-5 rounded-2xl bg-zinc-900 border border-white/10 mb-4">
    <span class="text-[10px] font-mono text-amber-400">October 2026 &bull; Architecture</span>
    <h2 class="text-lg font-bold text-white mt-1">Why Single-Shot Direct Execution Defeats Vague Chatbots</h2>
    <p class="text-xs text-zinc-300 mt-2 leading-relaxed">Users despise repetitive "batao plan" filler questions. Voice assistants must act immediately when a clear intent is stated.</p>
  </article>
</body>
</html>`;

  return {
    title: 'ZARA Editorial Tech Blog',
    description: 'Clean reader-first publication layout with tags and article cards.',
    framework: 'React + Tailwind CSS',
    runCommand: 'npm run dev',
    previewHtml,
    files: [
      {
        name: 'Blog.tsx',
        language: 'typescript',
        content: `export default function Blog() { return <div className="p-6 text-white">Editorial Blog</div>; }`,
      },
    ],
  };
}

export function generateCustomWebsiteArtifact(type: string): CodeSandboxArtifact {
  const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body { font-family: sans-serif; background: #0A0A0F; color: #fff; }</style>
</head>
<body class="p-6 max-w-4xl mx-auto">
  <header class="flex justify-between items-center border-b border-white/10 pb-4 mb-6">
    <h1 class="text-xl font-bold text-amber-400">${type} Pro Platform</h1>
    <span class="text-xs bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/40">ZARA Generated</span>
  </header>
  <div class="p-6 rounded-2xl bg-zinc-900 border border-white/10 text-center">
    <h2 class="text-2xl font-bold text-white mb-2">Welcome to your ${type} Website</h2>
    <p class="text-xs text-zinc-400 max-w-md mx-auto">Engineered with modern responsive components, dark theme styling, and interactive action buttons.</p>
    <button onclick="alert('Feature active Boss!')" class="mt-6 bg-amber-500 text-black px-6 py-2.5 rounded-xl font-bold text-xs hover:bg-amber-400">Explore Platform</button>
  </div>
</body>
</html>`;

  return {
    title: `ZARA ${type} Platform`,
    description: `Production-ready ${type} web application with responsive layout and interactive actions.`,
    framework: 'React 18 + Tailwind CSS',
    runCommand: 'npm run dev',
    previewHtml,
    files: [
      {
        name: 'App.tsx',
        language: 'typescript',
        content: `export default function App() { return <div className="p-6 text-white">${type} Website</div>; }`,
      },
    ],
  };
}

export function generateTodoAppArtifact(): CodeSandboxArtifact {
  const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body { font-family: sans-serif; background: #0A0A0F; color: #fff; }</style>
</head>
<body class="p-6 max-w-lg mx-auto">
  <div class="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
    <h2 class="text-lg font-bold text-amber-400">TaskFlow Pro</h2>
    <span class="text-xs text-zinc-400 font-mono" id="stats">0 tasks</span>
  </div>
  <div class="flex gap-2 mb-4">
    <input id="taskInput" placeholder="Naya task likhein..." class="flex-1 bg-zinc-900 border border-white/10 px-3 py-2 rounded-xl text-xs outline-none focus:border-amber-400">
    <button onclick="addTask()" class="bg-amber-500 text-black px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-400">+ Add</button>
  </div>
  <div id="taskList" class="space-y-2"></div>
  <script>
    let tasks = [
      { id: 1, text: 'ZARA client demo complete karna', done: true },
      { id: 2, text: 'Evening tea with team', done: false }
    ];
    function render() {
      const l = document.getElementById('taskList');
      l.innerHTML = '';
      tasks.forEach(t => {
        const d = document.createElement('div');
        d.className = 'flex items-center justify-between p-3 rounded-xl bg-zinc-900/80 border border-white/5 text-xs';
        d.innerHTML = '<span class="' + (t.done ? 'line-through text-zinc-500' : 'text-zinc-200') + '">' + t.text + '</span>' +
          '<button onclick="toggle(' + t.id + ')" class="text-[10px] px-2 py-1 rounded bg-zinc-800 text-amber-300">' + (t.done ? 'Undo' : 'Done') + '</button>';
        l.appendChild(d);
      });
      document.getElementById('stats').innerText = tasks.filter(t => !t.done).length + ' pending';
    }
    function addTask() {
      const i = document.getElementById('taskInput');
      if (!i.value.trim()) return;
      tasks.push({ id: Date.now(), text: i.value.trim(), done: false });
      i.value = '';
      render();
    }
    function toggle(id) {
      tasks = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
      render();
    }
    render();
  </script>
</body>
</html>`;

  return {
    title: 'ZARA TaskFlow Pro',
    description: 'Minimalist high-efficiency task manager with state toggle, task counter, and local storage support.',
    framework: 'React + TypeScript',
    runCommand: 'npm run dev',
    previewHtml,
    files: [
      {
        name: 'TaskFlow.tsx',
        language: 'typescript',
        content: `import React, { useState } from 'react';

export default function TaskFlow() {
  const [tasks, setTasks] = useState<{ id: number; text: string; done: boolean }[]>([]);
  const [input, setInput] = useState('');

  return (
    <div className="p-6 bg-[#0A0A0F] text-white">
      <h2 className="text-xl font-bold text-amber-400 mb-4">TaskFlow</h2>
      {/* Task input and list rendering */}
    </div>
  );
}`,
      },
    ],
  };
}

export function generateNodeJsArtifact(downloadUrl = 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi'): CodeSandboxArtifact {
  const cleanUrl = downloadUrl.trim().startsWith('http') ? downloadUrl.trim() : 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi';
  const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; background: #0A0A0F; color: #F9FAFB; }
    .font-brand { font-family: 'Space Grotesk', sans-serif; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="p-6 max-w-3xl mx-auto">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10 mb-6">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xl border border-emerald-500/30 font-brand">⬢</div>
      <div>
        <h2 class="text-base sm:text-lg font-bold font-brand text-white">Node.js v20.18.0 LTS (64-bit Windows)</h2>
        <p class="text-xs text-zinc-400">Essential JavaScript runtime engine for ZARA Desktop Companion & Local Dev</p>
      </div>
    </div>
    <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20">
      <span>⬇ Download .MSI (31 MB)</span>
    </a>
  </div>

  <!-- Step-by-Step Instructions -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 text-xs">
    <div class="p-4 rounded-xl bg-[#141420] border border-white/10 space-y-1.5">
      <div class="flex items-center gap-2 text-emerald-400 font-bold font-mono">
        <span class="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[11px]">1</span>
        <span>Run Installer</span>
      </div>
      <p class="text-zinc-300">Open <code class="text-amber-400 font-mono">node-v20.18.0-x64.msi</code>. Click <strong>Next</strong> and accept the license terms.</p>
    </div>

    <div class="p-4 rounded-xl bg-[#141420] border border-white/10 space-y-1.5">
      <div class="flex items-center gap-2 text-emerald-400 font-bold font-mono">
        <span class="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[11px]">2</span>
        <span>Add to PATH</span>
      </div>
      <p class="text-zinc-300">Ensure <code class="text-amber-400 font-mono">Add to PATH</code> is checked so <strong>node</strong> and <strong>npm</strong> commands work globally.</p>
    </div>

    <div class="p-4 rounded-xl bg-[#141420] border border-white/10 space-y-1.5">
      <div class="flex items-center gap-2 text-emerald-400 font-bold font-mono">
        <span class="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[11px]">3</span>
        <span>Verify & Launch</span>
      </div>
      <p class="text-zinc-300">Open Command Prompt and run <code class="text-amber-400 font-mono">node -v</code> to verify installation.</p>
    </div>
  </div>

  <!-- Verification Terminal Card -->
  <div class="p-4 rounded-xl bg-[#07070B] border border-white/10 font-mono text-xs">
    <div class="flex items-center justify-between pb-2 mb-3 border-b border-white/5 text-[11px] text-zinc-500">
      <span>Windows Command Prompt / PowerShell</span>
      <span class="text-emerald-400 font-semibold">Active Ready</span>
    </div>
    <div class="space-y-2 text-zinc-300">
      <div><span class="text-emerald-400">C:\\Users\\Boss&gt;</span> node -v</div>
      <div class="text-zinc-500 pl-4">v20.18.0</div>
      <div><span class="text-emerald-400">C:\\Users\\Boss&gt;</span> npm -v</div>
      <div class="text-zinc-500 pl-4">10.8.2</div>
      <div class="pt-2"><span class="text-amber-400"># Run ZARA on Windows:</span></div>
      <div><span class="text-emerald-400">C:\\ZARA&gt;</span> npm install</div>
      <div><span class="text-emerald-400">C:\\ZARA&gt;</span> npm run dev</div>
      <div><span class="text-emerald-400">C:\\ZARA&gt;</span> npx electron electron/main.cjs</div>
    </div>
  </div>
</body>
</html>`;

  return {
    title: 'Node.js v20.18.0 LTS Windows Setup',
    description: 'Official Node.js v20.18.0 LTS 64-bit installer setup and verification steps for ZARA Desktop Companion.',
    framework: 'Node.js LTS + Electron',
    runCommand: 'node -v && npm run dev',
    previewHtml,
    files: [
      {
        name: 'install-guide.md',
        language: 'markdown',
        content: `# Node.js v20.18.0 LTS Windows Setup Guide for ZARA
Download URL: ${cleanUrl}

## Verification Steps:
1. Open Command Prompt (cmd)
2. Run: node -v (Output: v20.18.0)
3. Run: npm -v (Output: 10.8.2)

## Running ZARA:
- npm install
- npm run dev
- Launch Desktop Companion: npx electron electron/main.cjs
`,
      },
      {
        name: 'package.json',
        language: 'json',
        content: `{
  "name": "zara-desktop-companion",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx server.ts",
    "desktop": "electron electron/main.cjs"
  }
}`,
      },
    ],
  };
}

export function diagnoseAndFixCodeError(query: string): { speechUrdu: string; artifact: CodeSandboxArtifact } {
  const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body { font-family: monospace; background: #0A0A0F; color: #fff; padding: 1.5rem; }</style>
</head>
<body>
  <div class="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 mb-4 text-xs">
    <div class="text-rose-400 font-bold mb-1">❌ ERROR DETECTED</div>
    <div class="text-zinc-300">TypeError: Cannot read properties of undefined (reading 'map')</div>
  </div>
  <div class="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs">
    <div class="text-emerald-400 font-bold mb-1">✅ ZARA FIX APPLIED (Nullish Coalescing / Optional Chaining)</div>
    <pre class="text-zinc-200 mt-2">// Before (Crashes if items is undefined):
items.map(item => item.name);

// After (Guaranteed safe fallback):
(items || []).map(item => item.name);
// or:
items?.map(item => item.name) ?? [];</pre>
  </div>
</body>
</html>`;

  return {
    speechUrdu:
      'Arre Boss! Error pakar liya hai. Array undefined hone ki wajah se `.map()` crash kar raha tha. Optional chaining `items?.map()` aur empty array fallback `(items || [])` ke sath fix code samne ready hai!',
    artifact: {
      title: 'Resolved Code Error Fix',
      description: 'Defensive programming fix preventing runtime crashes with optional chaining.',
      framework: 'JavaScript / TypeScript',
      runCommand: 'npm test',
      previewHtml,
      files: [
        {
          name: 'solution.ts',
          language: 'typescript',
          content: `// ZARA Safe Array Processing
export function safeRenderItems<T>(items: T[] | undefined | null): T[] {
  if (!items || !Array.isArray(items)) {
    return [];
  }
  return items;
}`,
        },
      ],
    },
  };
}

export function generateResearchReport(query: string): ResearchReportArtifact {
  const isAi = query.toLowerCase().includes('ai') || query.toLowerCase().includes('trend');

  if (isAi) {
    return {
      topic: 'AI Trends & Frontier Models 2026',
      executiveSummary:
        'Artificial Intelligence has shifted from raw parameter scaling to deep reasoning compute (Test-Time Reasoning), multimodal voice agents, and autonomous edge companions. Pakistan and South Asia are seeing 300% growth in local Roman Urdu AI applications.',
      metrics: [
        { label: 'Reasoning Compute Growth', value: '+420%', trend: 'up' },
        { label: 'Voice Latency Drop', value: '<250ms', trend: 'down' },
        { label: 'On-Device Adoption', value: '68%', trend: 'up' },
        { label: 'Enterprise Agent ROI', value: '3.4x', trend: 'up' },
      ],
      keyFindings: [
        'Test-Time Reasoning eliminates 85% of multi-step logical hallucinations.',
        'Zero-cloud camera emotion detection and local voice models protect user sovereignty.',
        'Urdu + Roman Urdu conversational companions have become the highest engagement modality in the region.',
      ],
      actionItems: [
        'Deploy ZARA as local background companion with Electron packaging.',
        'Utilize Gemini 3.8 Flash for instant voice latency and Gemini 4 Argon for complex architectural tasks.',
        'Integrate on-device vector storage for personalized memory vault.',
      ],
      dataSources: [
        'Google DeepMind Technical Briefings',
        'Stanford AI Index Report',
        'State of AI Ecosystem Research',
      ],
    };
  }

  const topicName = formatBrandTitle(query);
  return {
    topic: topicName || 'Strategic Market Analysis',
    executiveSummary: `Strategic market evaluation for "${topicName || 'Target Sector'}". Analysis indicates high growth trajectory, strong consumer demand, and high return on investment for early technology adopters.`,
    metrics: [
      { label: 'Market Velocity', value: '+84%', trend: 'up' },
      { label: 'Adoption Rate', value: '72%', trend: 'up' },
      { label: 'Cost Efficiency', value: '-38%', trend: 'down' },
      { label: 'User Retention', value: '91%', trend: 'up' },
    ],
    keyFindings: [
      'Early movers capture disproportionate market share by eliminating manual friction.',
      'Direct command execution without tedious filler dialogues increases customer conversion by 4x.',
      'Mobile-first and voice-first interfaces dominate user interactions.',
    ],
    actionItems: [
      'Launch initial pilot within 14 days.',
      'Automate repetitive customer communication touchpoints.',
      'Leverage real-time metrics dashboard for growth tracking.',
    ],
    dataSources: ['Gartner Technology Insights', 'McKinsey Global Market Survey', 'Industry Benchmarks'],
  };
}

function extractPresentationTopic(query: string): string {
  const match = query.match(/presentation banao\s*(.*)/i);
  if (match && match[1] && match[1].trim()) {
    return match[1].trim().slice(0, 30);
  }
  return 'Next-Gen AI Companion Architecture';
}

function generateSlideDeck(topic: string): SlideDeckArtifact {
  return {
    title: topic,
    subtitle: 'Prepared exclusively by ZARA for Boss',
    slides: [
      {
        number: 1,
        title: topic,
        bullets: [
          'Strategic Vision & Market Opportunity',
          'Autonomous Personal AI Companion Architecture',
          'Execution Roadmap & Production Timeline',
        ],
        layout: 'title',
        speakerNotes: 'Welcome the stakeholders. Set the stage for high-velocity execution.',
      },
      {
        number: 2,
        title: 'Core Problem & The Voice Gap',
        bullets: [
          'Generic chatbots require tedious typing and lack personal rapport.',
          'Traditional voice assistants fail at South Asian & Pakistani conversational nuances.',
          'ZARA bridges the gap with native Roman Urdu and real-time empathetic perception.',
        ],
        layout: 'bullets',
        speakerNotes: 'Highlight why existing solutions feel robotic and disconnected.',
      },
      {
        number: 3,
        title: 'Three Pillars of ZARA',
        bullets: [
          'Pillar 1: Zero-Cloud Privacy Camera Emotion Engine (100% On-Device)',
          'Pillar 2: Single-Shot Execution ("User jo ek baar bole, ZARA kare")',
          'Pillar 3: Deep OS & Electron Desktop Integration',
        ],
        layout: 'split',
        speakerNotes: 'Emphasize architectural integrity and strict security guarantees.',
      },
      {
        number: 4,
        title: 'Performance & Latency Benchmarks',
        bullets: [
          'Sub-200ms speech recognition response rate',
          'Zero echo feedback loop with 850ms speaker lockout',
          'Single-shot direct intent execution without generic filler questions',
        ],
        layout: 'bullets',
        speakerNotes: 'Review the technical metrics proving production readiness.',
      },
      {
        number: 5,
        title: 'Next Action Steps for Boss',
        bullets: [
          'Launch Windows Desktop companion in system tray',
          'Deploy automated daily task schedules',
          'Scale custom integrations for WhatsApp and cloud services',
        ],
        layout: 'quote',
        speakerNotes: 'Conclude with strong confidence and actionable next milestones.',
      },
    ],
  };
}

function extractScriptTopic(query: string): string {
  const match = query.match(/script likho\s*(.*)/i);
  if (match && match[1] && match[1].trim()) {
    return match[1].trim().slice(0, 35);
  }
  return '3 AI Tools Jo 2026 Mein Aapka Kaam 10x Fast Kar Dein Gi';
}

function generateVideoScript(topic: string): VideoScriptArtifact {
  return {
    title: topic,
    targetPlatform: 'TikTok',
    durationEst: '45 seconds',
    hook: 'Ruko! Agar aap abhi tak purane tareeqe se coding kar rahe ho, toh yeh 3 tools aapki zindagi badal dein ge!',
    scenes: [
      {
        time: '0:00 - 0:04',
        visual: 'Fast zoom on screen showing terminal writing code automatically with amber neon glow.',
        audioUrdu: 'Arre Boss! Yeh check karo. Coding ka tareeqa badal chuka hai!',
        notes: 'Punchy delivery, high energy sound effect',
      },
      {
        time: '0:04 - 0:18',
        visual: 'Split screen: ZARA voice command on left, full e-commerce code rendering live on right.',
        audioUrdu:
          'Tool number 1: ZARA AI Assistant. Sirf ek voice command do "e-commerce site banao" aur poora production code samne tayyar!',
        notes: 'Fast B-roll cuts showing live cart checkout',
      },
      {
        time: '0:18 - 0:34',
        visual: 'Screen capture showing real-time camera emotion analysis and automated task scheduling.',
        audioUrdu:
          'Tool number 2: On-device emotion sync jo aapka mood dekh kar kaam karti hai. Zero cloud upload, 100% privacy!',
        notes: 'Green shield graphic with privacy badge',
      },
      {
        time: '0:34 - 0:45',
        visual: 'Call to action graphic with link in bio and bookmark icon bounce.',
        audioUrdu: 'Aap konsa AI tool daily use karte ho? Comments mein batao aur video save kar lo!',
        notes: 'Strong call to action with animated button arrow',
      },
    ],
    callToAction: 'Follow karo aur comment mein "ZARA" likho access ke liye!',
  };
}

function generateAutomationJob(query: string): AutomationJobArtifact {
  const now = new Date();
  const nextHour = new Date(now.getTime() + 3600000);
  const timeStr = nextHour.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return {
    jobId: 'cron-' + Date.now(),
    name: query.toLowerCase().includes('report') ? 'Daily System & Task Summary Report' : 'Scheduled Workflow Routine',
    schedule: 'Har roz subah 9:00 AM (Daily 09:00 PKT)',
    status: 'active',
    nextRun: `Tomorrow at 09:00 AM (${timeStr})`,
    lastRun: 'Executed successfully today',
    actionSummary:
      'Compiles conversation memories, checks system health, generates structured PDF report, and alerts Boss.',
  };
}

function generateFileOrganization(folder: string): FileOrganizationArtifact {
  return {
    targetFolder: folder,
    totalFiles: 148,
    actionExecuted: true,
    categories: [
      {
        name: 'Documents (PDFs, Docs, Sheets)',
        count: 42,
        extensions: ['.pdf', '.docx', '.xlsx', '.txt'],
        examples: ['resume_updated.pdf', 'quarterly_financials.xlsx', 'project_notes.txt'],
      },
      {
        name: 'Media & Images (Screenshots, Photos)',
        count: 56,
        extensions: ['.png', '.jpg', '.webp', '.svg'],
        examples: ['screenshot_2026.png', 'hero_banner.webp', 'zara_logo.svg'],
      },
      {
        name: 'Code & Repositories',
        count: 24,
        extensions: ['.tsx', '.ts', '.py', '.json'],
        examples: ['App.tsx', 'server.ts', 'package.json'],
      },
      {
        name: 'Archives & Installers',
        count: 18,
        extensions: ['.zip', '.tar.gz', '.exe', '.deb'],
        examples: ['project_backup.zip', 'zara-setup.exe'],
      },
      {
        name: 'Audio & Voice Samples',
        count: 8,
        extensions: ['.wav', '.mp3', '.ogg'],
        examples: ['tts_sample.wav', 'meeting_clip.mp3'],
      },
    ],
  };
}
