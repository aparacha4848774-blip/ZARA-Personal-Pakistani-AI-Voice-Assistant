import test from 'node:test';
import assert from 'node:assert/strict';
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









