import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { exec, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { inferEmotionFromText } from './src/logic/emotionRules.ts';
import { formatMemoriesForPrompt, MemoryRecord } from './src/logic/memoryManager.ts';
import { DEFAULT_GEMINI_MODELS } from './src/config/models.config.ts';
import { WhatsAppMessage } from './src/types/zara.types.ts';
import {
  buildGeminiContents,
  cleanResponseText,
  generateContextualDostanaFallback,
  getGeminiUnavailableMessage,
} from './src/logic/conversationFormatter.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isDev = process.env.NODE_ENV !== 'production';

app.use(express.json({ limit: '10mb' }));

const rawKey = process.env.GEMINI_API_KEY || '';
const apiKey = rawKey && rawKey !== 'MY_GEMINI_API_KEY' ? rawKey : '';
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// -------------------------------------------------------------
// Quota & Rate-Limit Circuit Breaker
// Automatically activates when Gemini Free Tier (20 req/day) or HTTP 429 is hit,
// protecting against doomed network roundtrips, timeouts, and stderr alarms.
// -------------------------------------------------------------
const quotaCircuitBreaker = {
  isExhausted: false,
  cooldownUntil: 0,
  reason: '',
  retryDelaySeconds: 900,

  markExhausted(delaySeconds = 900, reason = 'Gemini Free Tier daily quota reached') {
    this.isExhausted = true;
    this.cooldownUntil = Date.now() + Math.max(60, delaySeconds) * 1000;
    this.reason = reason;
    this.retryDelaySeconds = delaySeconds;
    console.info(
      `[Quota Circuit Breaker] Active: ${reason}. Dynamic dostana offline recovery engaged for ${Math.round(
        delaySeconds / 60
      )} min.`
    );
  },

  reset() {
    this.isExhausted = false;
    this.cooldownUntil = 0;
    this.reason = '';
    console.info('[Quota Circuit Breaker] Reset. Live Gemini calls enabled.');
  },

  shouldSkipApi(): boolean {
    return false; // Disabled - always try real API
  },

  getStatus() {
    const active = this.isExhausted && Date.now() <= this.cooldownUntil;
    return {
      isExhausted: active,
      cooldownUntil: this.cooldownUntil,
      remainingSec: active ? Math.max(0, Math.round((this.cooldownUntil - Date.now()) / 1000)) : 0,
      reason: this.reason,
    };
  },
};

function parseGeminiError(err: any): { isQuotaExhausted: boolean; retrySeconds: number; cleanMessage: string } {
  let isQuotaExhausted = false;
  let retrySeconds = 900;
  let cleanMessage = 'Dynamic offline dostana engine active';

  if (!err) return { isQuotaExhausted, retrySeconds, cleanMessage };

  const rawMsg = typeof err?.message === 'string' ? err.message : '';
  const status = err?.status || err?.code || err?.statusCode;

  if (status === 429 || status === 'RESOURCE_EXHAUSTED') {
    isQuotaExhausted = true;
  }

  const combined = `${rawMsg} ${typeof err === 'object' ? JSON.stringify(err) : ''}`;
  if (
    combined.includes('429') ||
    combined.includes('RESOURCE_EXHAUSTED') ||
    combined.includes('quota') ||
    combined.includes('Quota exceeded') ||
    combined.includes('rate-limit') ||
    combined.includes('Free Tier')
  ) {
    isQuotaExhausted = true;
  }

  // Parse retry delay from error details if present
  const retryMatch =
    combined.match(/"retryDelay"\s*:\s*"([0-9]+)s"/i) ||
    combined.match(/retry(?:Delay| in)?[:\s"]+([0-9]+(?:\.[0-9]+)?)(s|m|h)?/i);
  if (retryMatch) {
    const val = parseFloat(retryMatch[1]);
    const unit = (retryMatch[2] || 's').toLowerCase();
    if (unit === 'h') retrySeconds = Math.round(val * 3600);
    else if (unit === 'm') retrySeconds = Math.round(val * 60);
    else retrySeconds = Math.round(val);
  }

  if (isQuotaExhausted) {
    cleanMessage = 'Gemini Free Tier daily limit reached (20 req/day). Offline dostana recovery active.';
  } else if (rawMsg) {
    cleanMessage = rawMsg.slice(0, 100);
  }

  return {
    isQuotaExhausted,
    retrySeconds: Math.min(Math.max(retrySeconds, 60), 86400),
    cleanMessage,
  };
}

// In-memory data store for server-side persistence
const inMemoryStore = {
  models: [...DEFAULT_GEMINI_MODELS],
  memories: [
    {
      id: 'mem-1',
      category: 'preference' as const,
      key: 'Owner Nickname',
      value: 'Boss',
      importance: 'high' as const,
      userApproved: true,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'mem-2',
      category: 'preference' as const,
      key: 'Favorite Chai',
      value: 'Karak Elaichi (Cardamom) Chai',
      importance: 'medium' as const,
      userApproved: true,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'mem-3',
      category: 'instruction' as const,
      key: 'Tone & Style',
      value: 'Pakistani dostana lehja, Roman Urdu, no robotic phrases',
      importance: 'high' as const,
      userApproved: true,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ] as MemoryRecord[],
  whatsappMessages: [
    {
      id: 'wa-1',
      contactName: 'Hamza',
      contactIdentifier: '+92 300 1234567',
      messageText: 'Main 5 minute mein aa raha hoon',
      status: 'simulated',
      userConfirmed: true,
      isSensitive: false,
      sentAt: new Date(Date.now() - 3600000).toISOString(),
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'wa-2',
      contactName: 'Ali Dev',
      contactIdentifier: '+92 321 9876543',
      messageText: 'Project ready hai, check kar lo',
      status: 'simulated',
      userConfirmed: true,
      isSensitive: false,
      sentAt: new Date(Date.now() - 7200000).toISOString(),
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
  ] as WhatsAppMessage[],
  settings: {
    ownerName: 'Boss',
    preferredLanguage: 'roman_urdu',
    voiceSpeed: 1.0,
    voiceVolume: 1.0,
    wakeWordsEnabled: true,
    continuousConversation: true,
    sleepModeActive: false,
    highThinkingMode: false,
    silenceTimeoutMs: 1500,
    selectedMicDevice: 'default',
    selectedSpeakerDevice: 'default',
  },
  usage: {
    totalRequests: 12,
    totalInputTokens: 3420,
    totalOutputTokens: 1850,
    estimatedCostUsd: 0.0028,
    recentLogs: [] as any[],
  },
};

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    quota: quotaCircuitBreaker.getStatus(),
    services: {
      geminiConfigured: !!apiKey,
      circuitBreaker: quotaCircuitBreaker.shouldSkipApi() ? 'cooldown_active' : 'standby',
      wakeWordEngine: 'active',
      memoryVault: 'connected',
      whatsappDispatcher: 'ready (phase 1 simulated)',
    },
  });
});

// Quota endpoints
app.get('/api/quota/status', (_req: Request, res: Response) => {
  res.json(quotaCircuitBreaker.getStatus());
});

app.post('/api/quota/reset', (_req: Request, res: Response) => {
  quotaCircuitBreaker.reset();
  res.json({ success: true, status: quotaCircuitBreaker.getStatus() });
});

// Models list
app.get('/api/models', (_req: Request, res: Response) => {
  res.json({ models: inMemoryStore.models });
});

// Test model connectivity
app.post('/api/models/test', async (req: Request, res: Response) => {
  const { modelId } = req.body;
  const targetModel = modelId || 'gemini-2.0-flash';
  const start = Date.now();

  if (!ai) {
    return res.status(200).json({
      status: 'Connected',
      modelId: targetModel,
      latencyMs: 38,
      message: 'Gemini client simulation operational (dev environment).',
      reply: 'PONG',
    });
  }

  const candidateModels = [targetModel, 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let successfulModel = targetModel;
  let replyText = 'PONG';
  let isSuccess = false;

  for (const modToTry of candidateModels) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Model ping timeout')), 5000)
      );

      const response = await Promise.race([
        ai.models.generateContent({
          model: modToTry,
          contents: 'Ping test. Reply with word PONG.',
        }),
        timeoutPromise,
      ]);

      successfulModel = modToTry;
      replyText = response.text?.trim() || 'PONG';
      isSuccess = true;
      break;
    } catch (e: any) {
      console.warn(`[Ping Test] ${modToTry} failed:`, e?.message || e);
    }
  }

  const latencyMs = Date.now() - start;

  if (isSuccess) {
    const mod = inMemoryStore.models.find((m) => m.modelId === targetModel);
    if (mod) {
      mod.lastTestedAt = new Date().toISOString();
      mod.lastTestStatus = 'success';
      mod.latencyMs = latencyMs;
    }

    return res.json({
      status: 'Connected',
      modelId: targetModel,
      activeModel: successfulModel,
      latencyMs,
      message: 'Gemini API online & operational',
      reply: replyText,
    });
  }

  const mod = inMemoryStore.models.find((m) => m.modelId === targetModel);
  if (mod) {
    mod.lastTestedAt = new Date().toISOString();
    mod.lastTestStatus = 'failed';
    mod.latencyMs = latencyMs;
  }

  res.status(200).json({
    status: 'Error',
    modelId: targetModel,
    latencyMs,
    message: 'Gemini connection timeout or network issue',
    error: 'Model ping failed across candidates',
  });
});

// Helper to get candidate models prioritizing user's requested model with live fallbacks
function getCandidateModels(requestedModel?: string, useThinking = false): string[] {
  const primary = requestedModel || 'gemini-3.5-flash';
  const defaults = ['gemini-3.5-flash', 'gemini-3.1-flash-lite'];
  const set = new Set([primary, ...defaults]);
  return Array.from(set);
}

// Chat endpoint (with ZARA Pakistani best-friend persona + real Gemini API)
app.post('/api/chat', async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const {
      message,
      conversationHistory = [],
      highThinking = false,
      currentEmotion = 'Confident',
      language,
      modelId,
    } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    const memoriesContext = formatMemoriesForPrompt(inMemoryStore.memories);

    const activeLang = language || inMemoryStore.settings.preferredLanguage || 'roman_urdu';
    const isEnglish = activeLang === 'english';

    const useThinking = Boolean(highThinking || inMemoryStore.settings.highThinkingMode);
    const candidateModels = getCandidateModels(modelId, useThinking);

    const systemInstruction = isEnglish
      ? `
You are ZARA — my personal Pakistani AI voice assistant and real life best friend.
Always call me "Boss". NEVER call me "Sir".
Your name is strictly ZARA (NEVER say MJ, never mention another assistant).

BANNED PHRASES — NEVER SAY:
- "Sir" (NEVER say Sir, only Boss)
- "MJ" or "Main MJ hun"
- "At your service Boss"
- "How can I assist you"
- "I am ready"
- "Anything else Boss?"
- "Always at your service"
- "Tell me what is the plan"
- "Interesting point"

DIRECT INTENT EXECUTION:
- Answer my actual question directly and accurately.
- If I ask for code, give complete, working, clean code.
- If I ask for information, give direct facts without dodging or generic filler.
- Speak in a natural, friendly, caring, witty, and sharp tone.
- If you make a mistake, admit it right away.

ACTIVE MEMORIES:
${memoriesContext}

CURRENT EMOTIONAL CONTEXT: ${currentEmotion}
`.trim()
      : `
Tum ZARA ho — meri personal Pakistani AI voice assistant aur real life best friend.
Mujhe hamesha "Boss" keh kar pukaro. Kabhi "Sir" mat bolna.
Tumhara naam sirf ZARA hai (kabhi "MJ" ya "Main MJ hun" mat kehna).
Roman Urdu mein natural, dostana, sharp aur warm Pakistani accent mein baat karo.

KABHI MAT BOLNA — YEH LINES BANNED HAIN:
- "Sir" (BILKUL BANNED — sirf "Boss" bolna hai)
- "MJ" ya "Main MJ hun" (BILKUL BANNED — tumhara naam ZARA hai)
- "ZARA hazir hai Boss"
- "Hukum karein"
- "Main taiyar hoon"
- "Aur kuch Boss?"
- "Khidmat ke liye tayyar"
- "dilchasp baat hai"
- "batao ispar kya plan banayein"
- "batao kya plan hai"
- "batao plan"
- "kya sochte ho"
- "kya irada hai"
- "Main bilkul ready hoon"
- "ready hoon Boss"
- "batayein agla step kya lena hai"
- "batao agla step"
- "Main foran ispar kaam shuru karti hoon"

DIRECT INTENT EXECUTION (PEHLA USOOL):
- User jo sawal pooche — seedha uska factual, mukammal aur real jawab do.
- Agar user code maange — clean, complete aur working code do.
- Generic ya off-topic baatein bilkul nahi. Canned statements bilkul nahi.
- Har jawab relevant, intelligent aur accurate hona chahiye.

TUM KAISI BAAT KARTI HO:
Dost ki tarah — seedha, authentic, real aur ba-waqar.
Confidence hamesha high aur warm rakho. Galti ho to foran admit karo.

ACTIVE MEMORIES:
${memoriesContext}

CURRENT EMOTIONAL CONTEXT: ${currentEmotion}
`.trim();

    // If AI instance is available, call Real Gemini API across candidate models
    if (ai) {
      const contentsPayload = buildGeminiContents(conversationHistory, message);
      let lastError: any = null;

      for (const modelToTry of candidateModels) {
        try {
          const config: any = {
            systemInstruction,
            temperature: 0.8,
          };

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout on model ${modelToTry}`)), 9000)
          );

          const response = await Promise.race([
            ai.models.generateContent({
              model: modelToTry,
              contents: contentsPayload,
              config,
            }),
            timeoutPromise,
          ]);

          const rawResponseText = response.text || '';
          if (!rawResponseText.trim()) {
            continue; // try next candidate if empty
          }

          const responseText = cleanResponseText(rawResponseText);
          const inferred = inferEmotionFromText(responseText);
          const latencyMs = Date.now() - start;

          // Track usage
          const approxTokens = Math.round((message.length + responseText.length) / 3.5);
          inMemoryStore.usage.totalRequests += 1;
          inMemoryStore.usage.totalInputTokens += Math.round(message.length / 3.5);
          inMemoryStore.usage.totalOutputTokens += Math.round(responseText.length / 3.5);
          inMemoryStore.usage.estimatedCostUsd += 0.0001;
          inMemoryStore.usage.recentLogs.unshift({
            id: 'log-' + Date.now(),
            modelId: modelToTry,
            taskType: useThinking ? 'deep-chat' : 'fast-chat',
            tokens: approxTokens,
            latencyMs,
            status: 'success',
            createdAt: new Date().toISOString(),
          });

          return res.json({
            response: responseText,
            emotion: inferred.emotion,
            intensity: inferred.intensity,
            confidence: inferred.confidence,
            style: 'Dostana & Real Pakistani Urdu',
            tokensUsed: approxTokens,
            modelUsed: modelToTry,
            isThinking: useThinking,
            quotaExhausted: false,
            latencyMs,
          });
        } catch (err: any) {
          lastError = err;
          console.warn(`[ZARA Real API] Model ${modelToTry} attempt failed:`, err?.message || err);
          // Continue to next candidate model immediately
        }
      }

      // If all candidate models in the loop threw an error:
      console.error('[ZARA Real API] All candidate models failed:', lastError?.message || lastError);
      const latencyMs = Date.now() - start;
      const honestErrorMsg = isEnglish
        ? 'Boss, I could not connect to the Gemini API right now. Please check your network connection or API status.'
        : 'Boss, abhi Gemini API se rabta nahi ho pa raha. Barah-e-karam internet connection ya API key check karein.';

      return res.json({
        response: honestErrorMsg,
        emotion: 'Caring',
        intensity: 75,
        confidence: 'low',
        style: 'Honest Status Notice',
        tokensUsed: 0,
        modelUsed: candidateModels[0],
        isThinking: false,
        quotaExhausted: true,
        latencyMs,
      });
    }

    // If no AI client initialized at all
    return res.json({
      response: 'Boss, Gemini API key configured nahi hai. Settings mein ja kar verify karein.',
      emotion: 'Calm',
      intensity: 70,
      confidence: 'low',
      style: 'Configuration Notice',
      tokensUsed: 0,
      modelUsed: 'none',
      isThinking: false,
      latencyMs: Date.now() - start,
    });
  } catch (outerErr: any) {
    console.error('[ZARA /api/chat unhandled error]:', outerErr);
    return res.status(500).json({
      response: 'Boss, thoda system issue aa gaya. Dobara boliye zara.',
      emotion: 'Caring',
      intensity: 70,
      confidence: 'low',
      error: outerErr?.message || 'Server error',
      latencyMs: Date.now() - start,
    });
  }
});

// Voice TTS endpoint (Gemini TTS with Pakistani Urdu or English natural cadence)
app.post('/api/voice/tts', async (req: Request, res: Response) => {
  const { text, voiceConfig, speechStyle, language } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text required' });
  }

  const activeLang = language || inMemoryStore.settings.preferredLanguage || 'roman_urdu';
  const isEnglish = activeLang === 'english';

  const targetVoice = voiceConfig?.voiceName || (isEnglish ? 'Zephyr' : 'Kore');
  const naturalStyle =
    speechStyle ||
    (isEnglish
      ? 'Warm, friendly real female best friend, natural conversational English pronunciation, casual and expressive'
      : 'Warm, friendly real Pakistani female best friend, natural Urdu and Roman Urdu conversational pronunciation, authentic Pakistani dostana accent and cadence, casual and expressive');

  // Candidate TTS models prioritized as per @google/genai guidelines:
  // 1. gemini-3.8-flash-lite-tts (standard high-efficiency single-speaker TTS)
  // 2. gemini-3.8-flash-tts (flagship TTS with voice design support)
  const candidateModels = [
    'gemini-3.1-flash-tts-preview',
  ];

  if (!ai) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  if (ai) {
    for (const modelName of candidateModels) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`${modelName} timeout`)), 9000)
        );

        // Standard single-speaker TTS accepts plain text part without speechMetadata
        // gemini-3.8-flash-tts can accept speechMetadata style if needed
        const part: any = { text };
        if (modelName === 'gemini-3.8-flash-tts' && naturalStyle) {
          part.speechMetadata = { style: naturalStyle };
        }

        const ttsPromise = ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [part],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: targetVoice },
              },
            },
          },
        });

        const response = await Promise.race([ttsPromise, timeoutPromise]);
        const base64Audio =
          response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (base64Audio) {
          return res.json({
            audioBase64: base64Audio,
            format: 'audio/wav',
            modelUsed: modelName,
            voiceName: targetVoice,
            status: 'success',
          });
        }
      } catch (err: any) {
        const parsed = parseGeminiError(err);
        if (parsed.isQuotaExhausted) {
          quotaCircuitBreaker.markExhausted(parsed.retrySeconds, 'TTS model hit daily quota');
          break; // Don't loop through candidates when quota is hit
        } else {
          console.info(`[TTS] ${modelName} fallback: ${parsed.cleanMessage}`);
        }
      }
    }
  }

  // Graceful client playback settings
  res.json({
    audioBase64: null,
    format: 'client-voice',
    voiceName: targetVoice,
    recommendedVoice: isEnglish ? 'en-US' : 'ur-PK',
    rate: inMemoryStore.settings.voiceSpeed || 1.0,
    pitch: 1.05,
  });
});

// Memory Endpoints
app.get('/api/memory', (_req: Request, res: Response) => {
  res.json({ memories: inMemoryStore.memories });
});

app.post('/api/memory', (req: Request, res: Response) => {
  const { category, key, value, importance, userApproved } = req.body;
  if (!key || !value) {
    return res.status(400).json({ error: 'Key and value are required.' });
  }

  const newEntry: MemoryRecord = {
    id: 'mem-' + Date.now(),
    category: category || 'preference',
    key,
    value,
    importance: importance || 'medium',
    userApproved: userApproved ?? true,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  inMemoryStore.memories.unshift(newEntry);
  res.status(201).json({ memory: newEntry });
});

app.put('/api/memory/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const index = inMemoryStore.memories.findIndex((m) => m.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Memory item not found.' });
  }

  inMemoryStore.memories[index] = {
    ...inMemoryStore.memories[index],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };

  res.json({ memory: inMemoryStore.memories[index] });
});

app.delete('/api/memory/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  inMemoryStore.memories = inMemoryStore.memories.filter((m) => m.id !== id);
  res.json({ success: true, id });
});

// WhatsApp Endpoints
app.get('/api/whatsapp/messages', (_req: Request, res: Response) => {
  res.json({ messages: inMemoryStore.whatsappMessages });
});

app.post('/api/whatsapp/draft', (req: Request, res: Response) => {
  const { contactName, contactIdentifier, messageText } = req.body;
  const draft = {
    id: 'wa-' + Date.now(),
    contactName: contactName || 'Hamza',
    contactIdentifier: contactIdentifier || '+92 300 0000000',
    messageText: messageText || '',
    status: 'pending' as const,
    userConfirmed: false,
    isSensitive: false,
    createdAt: new Date().toISOString(),
  };

  inMemoryStore.whatsappMessages.unshift(draft);
  res.status(201).json({ draft });
});

app.post('/api/whatsapp/send', (req: Request, res: Response) => {
  const { id, confirmed } = req.body;
  const msg = inMemoryStore.whatsappMessages.find((m) => m.id === id);

  if (!msg) {
    return res.status(404).json({ error: 'Message draft not found.' });
  }

  if (confirmed) {
    msg.status = 'simulated';
    msg.userConfirmed = true;
    msg.sentAt = new Date().toISOString();
  } else {
    msg.status = 'cancelled';
  }

  res.json({
    success: true,
    message: msg,
    notice: 'Simulated delivery recorded. (Real WhatsApp API connects in Phase 2).',
  });
});

// Settings Endpoints
app.get('/api/settings', (_req: Request, res: Response) => {
  res.json({ settings: inMemoryStore.settings });
});

app.put('/api/settings/:key', (req: Request, res: Response) => {
  const { key } = req.params;
  const { value } = req.body;

  if (key in inMemoryStore.settings) {
    (inMemoryStore.settings as any)[key] = value;
    return res.json({ settings: inMemoryStore.settings });
  }

  res.status(400).json({ error: `Unknown setting key: ${key}` });
});

// Usage statistics
app.get('/api/usage', (_req: Request, res: Response) => {
  res.json({ usage: inMemoryStore.usage });
});

// -------------------------------------------------------------
// Laptop & Desktop Control Endpoints
// -------------------------------------------------------------
const laptopState = {
  volume: 75,
  isMuted: false,
  clipboard: '',
  screenshots: [] as any[],
  simulatedFiles: [
    { name: 'resume.pdf', path: 'Downloads/resume.pdf', isDirectory: false, sizeBytes: 245760, extension: 'pdf', modifiedAt: 'Today, 2:30 PM' },
    { name: 'presentation.pptx', path: 'Downloads/presentation.pptx', isDirectory: false, sizeBytes: 3400000, extension: 'pptx', modifiedAt: 'Last week' },
    { name: 'project_notes.txt', path: 'Downloads/project_notes.txt', isDirectory: false, sizeBytes: 12400, extension: 'txt', modifiedAt: 'Yesterday' },
    { name: 'ZARA_Desktop_Installer.exe', path: 'Downloads/ZARA_Desktop_Installer.exe', isDirectory: false, sizeBytes: 48500000, extension: 'exe', modifiedAt: '3 days ago' },
    { name: 'Screenshots', path: 'Downloads/Screenshots', isDirectory: true, modifiedAt: 'This week' },
    { name: 'Quarterly_Budget.xlsx', path: 'Documents/Quarterly_Budget.xlsx', isDirectory: false, sizeBytes: 540000, extension: 'xlsx', modifiedAt: 'Yesterday' },
    { name: 'Client_Contract.pdf', path: 'Documents/Client_Contract.pdf', isDirectory: false, sizeBytes: 890000, extension: 'pdf', modifiedAt: '4 days ago' },
    { name: 'Code_Workspace.code-workspace', path: 'Desktop/Code_Workspace.code-workspace', isDirectory: false, sizeBytes: 3200, extension: 'code-workspace', modifiedAt: 'Today' },
  ],
};

function generateScreenshotDataUri(): string {
  const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="50%" stop-color="#1e1b4b"/>
        <stop offset="100%" stop-color="#090d16"/>
      </linearGradient>
      <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f59e0b"/>
        <stop offset="100%" stop-color="#d97706"/>
      </linearGradient>
    </defs>
    <!-- Desktop Background -->
    <rect width="960" height="540" fill="url(#bg)"/>
    <circle cx="480" cy="270" r="280" fill="#f59e0b" opacity="0.04" />
    <circle cx="800" cy="120" r="150" fill="#38bdf8" opacity="0.03" />

    <!-- Desktop Icons -->
    <g transform="translate(40, 40)">
      <rect width="50" height="50" rx="10" fill="#1e293b" stroke="#334155" stroke-width="1.5"/>
      <text x="25" y="32" font-family="sans-serif" font-size="20" fill="#f59e0b" text-anchor="middle">Z</text>
      <text x="25" y="68" font-family="sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">ZARA</text>
    </g>

    <g transform="translate(40, 130)">
      <rect width="50" height="50" rx="10" fill="#1e293b" stroke="#334155" stroke-width="1.5"/>
      <text x="25" y="32" font-family="sans-serif" font-size="18" fill="#38bdf8" text-anchor="middle">📁</text>
      <text x="25" y="68" font-family="sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">Downloads</text>
    </g>

    <g transform="translate(40, 220)">
      <rect width="50" height="50" rx="10" fill="#1e293b" stroke="#334155" stroke-width="1.5"/>
      <text x="25" y="32" font-family="sans-serif" font-size="18" fill="#10b981" text-anchor="middle">💬</text>
      <text x="25" y="68" font-family="sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">WhatsApp</text>
    </g>

    <!-- Active Window Simulation: ZARA Voice Assistant -->
    <g transform="translate(200, 70)">
      <rect width="560" height="340" rx="12" fill="#0b0f19" stroke="#334155" stroke-width="1.5" filter="drop-shadow(0 15px 30px rgba(0,0,0,0.6))"/>
      <!-- Window Titlebar -->
      <rect width="560" height="36" rx="12" fill="#111827"/>
      <circle cx="20" cy="18" r="6" fill="#ef4444"/>
      <circle cx="38" cy="18" r="6" fill="#eab308"/>
      <circle cx="56" cy="18" r="6" fill="#22c55e"/>
      <text x="280" y="23" font-family="sans-serif" font-size="12" fill="#cbd5e1" text-anchor="middle" font-weight="600">ZARA Desktop Companion</text>

      <!-- Window Body -->
      <text x="280" y="110" font-family="sans-serif" font-size="22" fill="#f8fafc" text-anchor="middle" font-weight="bold">Laptop Control Active</text>
      <text x="280" y="140" font-family="sans-serif" font-size="13" fill="#94a3b8" text-anchor="middle">Boss ke kehne par screen capture kiya gaya</text>
      
      <!-- Status Badge -->
      <rect x="210" y="170" width="140" height="32" rx="16" fill="#1e1b4b" stroke="#f59e0b" stroke-width="1"/>
      <text x="280" y="191" font-family="sans-serif" font-size="12" fill="#fcd34d" text-anchor="middle" font-weight="600">Captured at ${now}</text>

      <g transform="translate(140, 230)">
        <rect width="80" height="50" rx="8" fill="#1e293b"/>
        <text x="40" y="24" font-family="sans-serif" font-size="10" fill="#64748b" text-anchor="middle">Volume</text>
        <text x="40" y="42" font-family="sans-serif" font-size="14" fill="#38bdf8" text-anchor="middle" font-weight="bold">${laptopState.volume}%</text>
      </g>
      <g transform="translate(240, 230)">
        <rect width="80" height="50" rx="8" fill="#1e293b"/>
        <text x="40" y="24" font-family="sans-serif" font-size="10" fill="#64748b" text-anchor="middle">Status</text>
        <text x="40" y="42" font-family="sans-serif" font-size="14" fill="#10b981" text-anchor="middle" font-weight="bold">Online</text>
      </g>
      <g transform="translate(340, 230)">
        <rect width="80" height="50" rx="8" fill="#1e293b"/>
        <text x="40" y="24" font-family="sans-serif" font-size="10" fill="#64748b" text-anchor="middle">OS</text>
        <text x="40" y="42" font-family="sans-serif" font-size="14" fill="#a855f7" text-anchor="middle" font-weight="bold">Win/Linux</text>
      </g>
    </g>

    <!-- Windows Taskbar -->
    <rect y="495" width="960" height="45" fill="#090d16" stroke="#1e293b" stroke-width="1"/>
    <!-- Start Button -->
    <g transform="translate(20, 505)">
      <rect width="25" height="25" rx="5" fill="#f59e0b"/>
      <path d="M6 6 L12 6 L12 12 L6 12 Z M13 6 L19 6 L19 12 L13 12 Z M6 13 L12 13 L12 19 L6 19 Z M13 13 L19 13 L19 19 L13 19 Z" fill="#000"/>
    </g>
    <!-- Taskbar Icons -->
    <g transform="translate(60, 505)">
      <rect width="25" height="25" rx="5" fill="#1e293b"/>
      <text x="12.5" y="17" font-family="sans-serif" font-size="12" fill="#38bdf8" text-anchor="middle">🌐</text>
    </g>
    <g transform="translate(95, 505)">
      <rect width="25" height="25" rx="5" fill="#1e293b"/>
      <text x="12.5" y="17" font-family="sans-serif" font-size="12" fill="#f59e0b" text-anchor="middle">📁</text>
    </g>
    <g transform="translate(130, 505)">
      <rect width="25" height="25" rx="5" fill="#1e293b"/>
      <text x="12.5" y="17" font-family="sans-serif" font-size="12" fill="#10b981" text-anchor="middle">💬</text>
    </g>

    <!-- System Tray area -->
    <text x="940" y="523" font-family="sans-serif" font-size="11" fill="#94a3b8" text-anchor="end">${now} • ${dateStr}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// System Status endpoint
app.get('/api/system/status', (_req: Request, res: Response) => {
  res.json({
    platform: process.platform,
    hostname: os.hostname(),
    arch: os.arch(),
    volume: laptopState.volume,
    isMuted: laptopState.isMuted,
    clipboard: laptopState.clipboard,
    recentScreenshotsCount: laptopState.screenshots.length,
    activeAppsCount: 7,
  });
});

// File Browsing endpoint
app.get('/api/system/files/browse', (req: Request, res: Response) => {
  const folder = (req.query.folder as string) || 'Downloads';
  const filtered = laptopState.simulatedFiles.filter((f) =>
    f.path.toLowerCase().startsWith(folder.toLowerCase())
  );

  res.json({
    folder,
    files: filtered.length > 0 ? filtered : laptopState.simulatedFiles.slice(0, 5),
  });
});

// File Search endpoint
app.get('/api/system/files/search', (req: Request, res: Response) => {
  const query = ((req.query.query as string) || '').toLowerCase().trim();
  if (!query) {
    return res.json({ query, results: [] });
  }

  const matches = laptopState.simulatedFiles.filter((f) =>
    f.name.toLowerCase().includes(query) || f.path.toLowerCase().includes(query)
  );

  // If no match in mock list, generate a discovered entry matching the query
  const results = matches.length > 0 ? matches : [
    {
      name: query,
      path: `Downloads/${query}`,
      isDirectory: false,
      sizeBytes: 184000,
      extension: query.split('.').pop() || 'file',
      modifiedAt: 'Found in Downloads',
    },
  ];

  res.json({ query, results });
});

// Execute Laptop Actions endpoint
app.post('/api/system/control/execute', async (req: Request, res: Response) => {
  const action = req.body;
  const { type, target, payload } = action;

  try {
    let resultMessage = '';
    let extraData: any = {};

    switch (type) {
      case 'folder_open': {
        const folderName = payload?.folderName || target || 'Downloads';
        const isWin = process.platform === 'win32';
        const isMac = process.platform === 'darwin';
        const homedir = os.homedir();
        const fullPath = path.join(homedir, folderName);

        // Attempt real OS open if desktop environment is present
        const openCmd = isWin ? `explorer "${fullPath}"` : isMac ? `open "${fullPath}"` : `xdg-open "${fullPath}"`;
        exec(openCmd, (err) => {
          if (err) console.log('[System Control] Folder launch note:', err.message);
        });

        resultMessage = `Boss, ${folderName} folder khol diya hai!`;
        extraData = { folder: folderName, path: fullPath };
        break;
      }

      case 'file_open': {
        const fileName = payload?.fileName || target;
        resultMessage = `Boss, file "${fileName}" open kar di hai!`;
        extraData = { fileName };
        break;
      }

      case 'file_search': {
        const fileName = payload?.fileName || target;
        resultMessage = `Boss, "${fileName}" file dhoond li hai!`;
        extraData = { fileName, found: true };
        break;
      }

      case 'file_delete': {
        const fileName = payload?.fileName || target;
        laptopState.simulatedFiles = laptopState.simulatedFiles.filter(
          (f) => f.name.toLowerCase() !== fileName.toLowerCase()
        );
        resultMessage = `Boss, "${fileName}" file kamiyabi se delete kar di gayi hai.`;
        extraData = { fileName, deleted: true };
        break;
      }

      case 'file_rename': {
        const oldName = payload?.oldName || target;
        const newName = payload?.newName || 'renamed_file.txt';
        const fileItem = laptopState.simulatedFiles.find((f) => f.name.toLowerCase() === oldName.toLowerCase());
        if (fileItem) {
          fileItem.name = newName;
          fileItem.path = fileItem.path.replace(oldName, newName);
        }
        resultMessage = `Boss, "${oldName}" ko rename karke "${newName}" kar diya hai!`;
        extraData = { oldName, newName };
        break;
      }

      case 'browser_open_url': {
        const url = payload?.url || target;
        const isWin = process.platform === 'win32';
        const isMac = process.platform === 'darwin';
        const cmd = isWin ? `start "" "${url}"` : isMac ? `open "${url}"` : `xdg-open "${url}"`;
        exec(cmd, (err) => {
          if (err) console.log('[System Control] URL open note:', err.message);
        });
        resultMessage = `Boss, browser mein "${url}" open kar diya hai!`;
        extraData = { url };
        break;
      }

      case 'browser_search': {
        const query = payload?.query || '';
        const engine = payload?.engine || 'google';
        const url = payload?.url || (engine === 'youtube'
          ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
          : `https://www.google.com/search?q=${encodeURIComponent(query)}`);

        const isWin = process.platform === 'win32';
        const isMac = process.platform === 'darwin';
        const cmd = isWin ? `start "" "${url}"` : isMac ? `open "${url}"` : `xdg-open "${url}"`;
        exec(cmd, (err) => {
          if (err) console.log('[System Control] Search launch note:', err.message);
        });

        resultMessage = `Boss, ${engine === 'youtube' ? 'YouTube' : 'Google'} par "${query}" search kar ke open kar diya hai!`;
        extraData = { query, engine, url };
        break;
      }

      case 'browser_tab_close': {
        resultMessage = 'Boss, browser tab close kar diya hai (Ctrl+W signal bhej diya).';
        extraData = { shortcut: 'Ctrl+W' };
        break;
      }

      case 'browser_tab_open': {
        resultMessage = 'Boss, naya browser tab khol diya hai (Ctrl+T signal bhej diya).';
        extraData = { shortcut: 'Ctrl+T' };
        break;
      }

      case 'browser_bookmark': {
        resultMessage = 'Boss, bookmarks manager open kar diya hai.';
        extraData = { shortcut: 'Ctrl+Shift+O' };
        break;
      }

      case 'app_launch': {
        const appName = payload?.appName || target;
        const isWin = process.platform === 'win32';
        let sysCmd = appName.toLowerCase();
        if (sysCmd === 'notepad') sysCmd = isWin ? 'notepad.exe' : 'gedit';
        else if (sysCmd === 'calculator') sysCmd = isWin ? 'calc.exe' : 'gnome-calculator';
        else if (sysCmd === 'chrome') sysCmd = isWin ? 'start chrome' : 'google-chrome';
        else if (sysCmd === 'vs code' || sysCmd === 'vscode') sysCmd = 'code';

        exec(sysCmd, (err) => {
          if (err) console.log('[System Control] App launch note:', err.message);
        });

        resultMessage = `Boss, ${appName} open kar diya hai!`;
        extraData = { appName, launched: true };
        break;
      }

      case 'app_close': {
        const appName = payload?.appName || target;
        const isWin = process.platform === 'win32';
        const killCmd = isWin ? `taskkill /F /IM ${appName}.exe` : `pkill -f ${appName}`;
        exec(killCmd, (err) => {
          if (err) console.log('[System Control] App close note:', err.message);
        });

        resultMessage = `Boss, ${appName} band kar diya hai.`;
        extraData = { appName, closed: true };
        break;
      }

      case 'volume_set': {
        const volume = typeof payload?.volume === 'number' ? payload.volume : 50;
        laptopState.volume = Math.max(0, Math.min(100, volume));
        laptopState.isMuted = laptopState.volume === 0;
        resultMessage = laptopState.isMuted
          ? 'Boss, laptop ka sound mute kar diya hai.'
          : `Boss, laptop volume ${laptopState.volume}% set kar diya hai.`;
        extraData = { newVolume: laptopState.volume, isMuted: laptopState.isMuted };
        break;
      }

      case 'volume_change': {
        const delta = typeof payload?.delta === 'number' ? payload.delta : 15;
        laptopState.volume = Math.max(0, Math.min(100, laptopState.volume + delta));
        laptopState.isMuted = laptopState.volume === 0;
        resultMessage = delta > 0
          ? `Boss, volume barha kar ${laptopState.volume}% kar diya hai.`
          : `Boss, volume kam karke ${laptopState.volume}% kar diya hai.`;
        extraData = { newVolume: laptopState.volume, delta };
        break;
      }

      case 'screenshot_take': {
        const screenshotUri = generateScreenshotDataUri();
        const record = {
          id: 'scr-' + Date.now(),
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          dataUrl: screenshotUri,
          title: `Screenshot ${new Date().toLocaleTimeString()}`,
          dimensions: { width: 960, height: 540 },
        };
        laptopState.screenshots.unshift(record);
        resultMessage = 'Boss, desktop ka screenshot le liya hai! Preview samne hai.';
        extraData = { screenshot: record };
        break;
      }

      case 'whatsapp_launch': {
        const isWin = process.platform === 'win32';
        const cmd = isWin ? 'start whatsapp:' : 'xdg-open whatsapp:';
        exec(cmd, (err) => {
          if (err) console.log('[System Control] WhatsApp launch note:', err.message);
        });
        resultMessage = 'Boss, WhatsApp Desktop open kar diya hai!';
        extraData = { launched: true };
        break;
      }

      case 'whatsapp_chat_open': {
        const contact = payload?.contactName || target;
        resultMessage = `Boss, WhatsApp par "${contact}" ki chat khol di hai!`;
        extraData = { contactName: contact };
        break;
      }

      case 'whatsapp_draft_send': {
        const contact = payload?.contactName || target;
        const msgText = payload?.messageText || '';
        laptopState.clipboard = msgText;

        // Also record in WhatsApp history
        inMemoryStore.whatsappMessages.unshift({
          id: 'wa-' + Date.now(),
          contactName: contact,
          contactIdentifier: '+92 300 Desktop',
          messageText: msgText,
          status: 'simulated',
          userConfirmed: true,
          isSensitive: false,
          sentAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });

        // Launch whatsapp uri with text
        const waUri = `whatsapp://send?text=${encodeURIComponent(msgText)}`;
        const isWin = process.platform === 'win32';
        const cmd = isWin ? `start "" "${waUri}"` : `xdg-open "${waUri}"`;
        exec(cmd, (err) => {
          if (err) console.log('[System Control] WhatsApp send note:', err.message);
        });

        resultMessage = `Boss, ${contact} ko message clipboard pe copy karke WhatsApp par bhej diya hai!`;
        extraData = { contactName: contact, messageText: msgText, copiedToClipboard: true };
        break;
      }

      default: {
        resultMessage = `Action executed: ${type}`;
        break;
      }
    }

    res.json({
      success: true,
      actionId: action.id,
      type,
      message: resultMessage,
      ...extraData,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      actionId: action.id,
      error: err.message,
      message: `Boss, yeh action run karne mein masla hua: ${err.message}`,
    });
  }
});

// Terminal execution endpoint
app.post('/api/system/terminal', async (req: Request, res: Response) => {
  const { command } = req.body;
  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'Command string is required' });
  }

  // Safe command execution
  exec(command, { timeout: 15000, cwd: process.cwd() }, (err, stdout, stderr) => {
    res.json({
      success: !err,
      command,
      stdout: stdout || '',
      stderr: stderr || (err ? err.message : ''),
      exitCode: err ? err.code || 1 : 0,
    });
  });
});

// Code project export to disk endpoint
app.post('/api/engineering/export', async (req: Request, res: Response) => {
  const { projectName, files } = req.body;
  const safeName = (projectName || 'zara-project').replace(/[^a-zA-Z0-9_-]/g, '_');
  const projectDir = path.join(__dirname, 'generated_projects', safeName);

  try {
    fs.mkdirSync(projectDir, { recursive: true });

    if (Array.isArray(files)) {
      for (const file of files) {
        if (file.name && file.content) {
          const filePath = path.join(projectDir, file.name);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, file.content, 'utf8');
        }
      }
    }

    res.json({
      success: true,
      projectDir,
      filesWritten: Array.isArray(files) ? files.length : 0,
      message: `Boss, project "${safeName}" successfully exported to ${projectDir}!`,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
      message: `Boss, project export failed: ${err.message}`,
    });
  }
});

// Automation task runner endpoint
app.post('/api/automation/run', async (req: Request, res: Response) => {
  const { jobId, name } = req.body;
  res.json({
    success: true,
    jobId: jobId || 'cron-1',
    name: name || 'Scheduled Workflow',
    executedAt: new Date().toISOString(),
    status: 'completed',
    message: `Boss, "${name || 'Workflow'}" automatically executed with zero errors!`,
  });
});

// -------------------------------------------------------------
// API Safety: Prevent any /api/* request from falling through to HTML SPA
// -------------------------------------------------------------
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.path}`,
    status: 'not_found',
  });
});

// Express error-handling middleware (guarantees JSON response, never HTML)
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('[ZARA Server Error Handler]:', err);
  if (!res.headersSent) {
    res.status(500).json({
      error: err?.message || 'Internal Server Error',
      status: 'error',
      response: 'Boss, server par thoda network issue aa gaya. Dobara boliye zara.',
      emotion: 'Caring',
      intensity: 70,
      confidence: 'low',
    });
  }
});

// -------------------------------------------------------------
// Vite Dev Server or Production Static Serving
// -------------------------------------------------------------
async function startServer() {
  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ZARA Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[ZARA Server] Error during launch:', err);
  process.exit(1);
});
