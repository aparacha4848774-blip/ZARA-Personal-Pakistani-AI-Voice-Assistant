import { useZaraStore } from '../store/zaraStore.ts';
import { useEmotionStore } from '../store/emotionStore.ts';
import { useConversationStore } from '../store/conversationStore.ts';
import { useSettingsStore } from '../store/settingsStore.ts';
import { speechRecognitionEngine } from './SpeechRecognitionEngine.ts';
import { voicePlaybackEngine } from './VoicePlaybackEngine.ts';
import { detectWakeWord } from '../logic/wakeWordDetector.ts';
import { parseWhatsAppCommand } from '../logic/whatsappParser.ts';
import { parseLaptopAction } from '../logic/laptopControlParser.ts';
import { useLaptopControlStore } from '../store/laptopControlStore.ts';
import {
  TTS_COOLDOWN_MS,
  canEvaluateWakeWord,
  shouldDropEchoTranscript,
} from '../logic/audioEchoLockout.ts';
import { detectAdvancedIntent } from '../logic/worldClassAiEngine.ts';
import { MessageAttachment } from '../types/zara.types.ts';
import { apiFetch } from '../utils/apiClient.ts';
import {
  detectLanguage,
  getClarificationResponse,
  SupportedLanguage,
} from '../logic/languageDetector.ts';


interface PendingClarification {
  type:
    | 'logo_brand'
    | 'website_type'
    | 'research_topic'
    | 'whatsapp_message'
    | 'whatsapp_contact'
    | 'app_name';
  contextData?: any;
}

class ConversationOrchestrator {
  private isInitialized = false;
  private cooldownTimer: any = null;
  private isCooldown = false;
  private pendingClarification: PendingClarification | null = null;

  public initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Connect voice playback engine amplitude and end events
    voicePlaybackEngine.setCallbacks(
      (amps) => {
        useZaraStore.getState().setAudioAmplitude(amps);
      },
      () => {
        // When speech finishes:
        useZaraStore.getState().setAudioPlaying(false);

        // Enter 800ms cooldown period to allow room audio reverberation and speaker tail to dissipate
        this.isCooldown = true;

        if (this.cooldownTimer) {
          clearTimeout(this.cooldownTimer);
        }

        this.cooldownTimer = setTimeout(() => {
          this.isCooldown = false;
          this.cooldownTimer = null;

          // Unlock microphone now that speaker cooldown has elapsed
          speechRecognitionEngine.setLockedOut(false);

          const { isMuted } = useZaraStore.getState();
          const { continuousConversation } = useSettingsStore.getState().settings;

          if (!isMuted && continuousConversation) {
            useZaraStore.getState().setState('LISTENING');
            speechRecognitionEngine.start();
          } else {
            useZaraStore.getState().setState('STANDBY');
          }
        }, TTS_COOLDOWN_MS);
      }
    );

    // Connect speech recognition callbacks
    speechRecognitionEngine.setCallbacks(
      (transcript, isFinal) => {
        const state = useZaraStore.getState().state;
        const isLockedOut = speechRecognitionEngine.getIsLockedOut();

        // Echo protection: discard any transcript while locked out or in cooldown
        if (shouldDropEchoTranscript(state, isLockedOut, this.isCooldown)) {
          return;
        }

        // If ZARA is speaking and user explicitly barge-in interrupts
        if (state === 'SPEAKING') {
          this.interrupt();
          return;
        }

        // Wake word evaluation: only allowed in genuine allowed states (STANDBY or LISTENING)
        if (canEvaluateWakeWord(state, isLockedOut, this.isCooldown)) {
          if (state === 'STANDBY') {
            const match = detectWakeWord(transcript);
            if (match.detected) {
              useZaraStore.getState().triggerWakeWord(match.phrase);
              if (match.isAssalamGreeting) {
                this.speakReply(
                  'Wa Alaikum Assalam, Boss! Sab khairiyat? Batao kya chal raha hai.',
                  'Happy',
                  90
                );
                return;
              } else if (match.remainderText) {
                // User already spoke query along with wake word
                this.handleUserQuery(match.remainderText);
                return;
              }
            }
          }
        }

        // If actively listening
        if (state === 'LISTENING') {
          useConversationStore.getState().setTranscriptDraft(transcript);
          if (isFinal) {
            this.handleUserQuery(transcript);
          }
        }
      },
      (isListening) => {
        if (!isListening && useZaraStore.getState().state === 'LISTENING' && !this.isCooldown) {
          // Keep state consistent
        }
      },
      (err) => {
        console.warn('Speech engine warning:', err);
      },
      () => {
        // On silence detected
        if (this.isCooldown || speechRecognitionEngine.getIsLockedOut()) {
          return;
        }
        const draft = useConversationStore.getState().transcriptDraft;
        if (draft && draft.trim().length > 1) {
          this.handleUserQuery(draft);
        }
      }
    );
  }

  public interrupt() {
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    this.isCooldown = false;
    voicePlaybackEngine.stop();
    speechRecognitionEngine.setLockedOut(false);
    useZaraStore.getState().interruptSpeaking();
  }

  public async handleUserQuery(query: string, attachments?: MessageAttachment[]) {
    if (!query || !query.trim()) return;

    speechRecognitionEngine.clearSilenceTimer();
    useConversationStore.getState().setTranscriptDraft('');

    const preferred = useSettingsStore.getState().settings.preferredLanguage || 'roman_urdu';
    const detectedLang = detectLanguage(query, preferred);

    // Add user message to conversation history with detected language
    useConversationStore.getState().addMessage({
      conversationId: useConversationStore.getState().activeConversationId,
      role: 'user',
      content: query.trim(),
      language: detectedLang,
      attachments,
    });

    useZaraStore.getState().setState('PROCESSING');

    // -------------------------------------------------------------
    // Clarification Continuation: If ZARA previously asked a targeted question
    // -------------------------------------------------------------
    if (this.pendingClarification) {
      const clar = this.pendingClarification;
      this.pendingClarification = null;

      const trimmedAns = query.trim();

      if (clar.type === 'logo_brand') {
        const brand = trimmedAns.replace(/\s*(?:ka\s+logo|ka|banao|hai)\s*$/i, '').trim();
        await this.executeUserQuery(`${brand} ka logo`, attachments);
        return;
      }

      if (clar.type === 'website_type') {
        await this.executeUserQuery(`${trimmedAns} website banao`, attachments);
        return;
      }

      if (clar.type === 'research_topic') {
        await this.executeUserQuery(`${trimmedAns} research karo`, attachments);
        return;
      }

      if (clar.type === 'whatsapp_message') {
        const contact = clar.contextData?.contactName || 'Hamza';
        await this.executeUserQuery(`${contact} ko message bhejo: ${trimmedAns}`, attachments);
        return;
      }

      if (clar.type === 'whatsapp_contact') {
        const contact = trimmedAns.replace(/\s*(?:ko|ko\s+message)\s*$/i, '').trim();
        this.pendingClarification = {
          type: 'whatsapp_message',
          contextData: { contactName: contact },
        };
        const askMsg =
          detectedLang === 'urdu'
            ? `باس، ${contact} کو کیا پیغام بھیجنا ہے؟`
            : detectedLang === 'english'
            ? `Boss, what message should I send to ${contact}?`
            : `Boss, ${contact} ko kya message bhejna hai?`;
        useConversationStore.getState().addMessage({
          conversationId: useConversationStore.getState().activeConversationId,
          role: 'zara',
          content: askMsg,
          language: detectedLang,
          emotion: 'Curious',
        });
        this.speakReply(askMsg, 'Curious', 85, 'high', 'gemini-3.8-flash', detectedLang);
        return;
      }

      if (clar.type === 'app_name') {
        await this.executeUserQuery(`${trimmedAns} kholo`, attachments);
        return;
      }
    }

    await this.executeUserQuery(query, attachments);
  }


  private async executeUserQuery(query: string, attachments?: MessageAttachment[]) {
    // 0. Check if there is an active pending laptop action awaiting confirmation
    const laptopStore = useLaptopControlStore.getState();
    if (laptopStore.pendingAction) {
      const intentCheck = parseLaptopAction(query);
      if (intentCheck.userConfirmationIntent === 'confirm') {
        const pending = laptopStore.pendingAction;
        const isDouble = pending.requiresDoubleConfirm;
        const isAwaitingSecond = laptopStore.confirmationStep === 'awaiting_double';

        if (isDouble && !isAwaitingSecond) {
          // Advance to double confirmation step
          await laptopStore.confirmPendingAction();
          const secondPrompt = `Boss, pakka na? Yeh sensitive kaam hai: "${pending.title}". Sach mein kar doon?`;
          useConversationStore.getState().addMessage({
            conversationId: useConversationStore.getState().activeConversationId,
            role: 'zara',
            content: secondPrompt,
            language: 'roman_urdu',
            emotion: 'Focused',
          });
          this.speakReply(secondPrompt, 'Focused', 90);
          return;
        } else {
          // Final confirmation & execution
          const desc = pending.descriptionRomanUrdu;
          await laptopStore.confirmPendingAction();
          const doneMsg = `Ho gaya Boss! ${desc} kar diya hai.`;
          useConversationStore.getState().addMessage({
            conversationId: useConversationStore.getState().activeConversationId,
            role: 'zara',
            content: doneMsg,
            language: 'roman_urdu',
            emotion: 'Happy',
          });
          this.speakReply(doneMsg, 'Happy', 85);
          return;
        }
      } else if (intentCheck.userConfirmationIntent === 'cancel') {
        laptopStore.cancelPendingAction('Boss ne mana kar diya');
        const cancelMsg = 'Theek hai Boss, cancel kar diya!';
        useConversationStore.getState().addMessage({
          conversationId: useConversationStore.getState().activeConversationId,
          role: 'zara',
          content: cancelMsg,
          language: 'roman_urdu',
          emotion: 'Calm',
        });
        this.speakReply(cancelMsg, 'Calm', 70);
        return;
      }
    }

    // -------------------------------------------------------------
    // 1. Direct Intent Execution: Advanced Modes (Logo, Website, App, Research, WhatsApp, Automation)
    // -------------------------------------------------------------
    const advanced = detectAdvancedIntent(query);

    // If intent requires clarification (e.g. "logo banao" -> "Boss, kis cheez ka logo?")
    if (advanced.needsClarification && advanced.clarificationType) {
      this.pendingClarification = {
        type: advanced.clarificationType,
        contextData: advanced.clarificationContext,
      };

      useConversationStore.getState().addMessage({
        conversationId: useConversationStore.getState().activeConversationId,
        role: 'zara',
        content: advanced.speechResponseRomanUrdu,
        language: 'roman_urdu',
        emotion: 'Curious',
        emotionIntensity: 85,
        confidenceLevel: 'high',
      });

      this.speakReply(advanced.speechResponseRomanUrdu, 'Curious', 85, 'high');
      return;
    }

    // Direct App Launch ("chrome kholo", "notepad kholo", etc.)
    if (advanced.intent === 'app_launch' && advanced.directAction) {
      const appName = advanced.directAction.appName;
      await useLaptopControlStore.getState().launchApp(appName);

      useConversationStore.getState().addMessage({
        conversationId: useConversationStore.getState().activeConversationId,
        role: 'zara',
        content: advanced.speechResponseRomanUrdu,
        language: 'roman_urdu',
        emotion: 'Confident',
        emotionIntensity: 90,
        confidenceLevel: 'high',
      });

      this.speakReply(advanced.speechResponseRomanUrdu, 'Confident', 90, 'high');
      return;
    }

    // Direct WhatsApp Draft ("[name] ko message [text]")
    if (advanced.intent === 'whatsapp_draft' && advanced.whatsappDraft) {
      const { contactName, messageText } = advanced.whatsappDraft;
      try {
        await apiFetch('/api/whatsapp/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactName,
            messageText,
          }),
        });
      } catch (e) {
        console.warn('WhatsApp draft error:', e);
      }

      useConversationStore.getState().addMessage({
        conversationId: useConversationStore.getState().activeConversationId,
        role: 'zara',
        content: advanced.speechResponseRomanUrdu,
        language: 'roman_urdu',
        emotion: 'Focused',
        emotionIntensity: 88,
        confidenceLevel: 'high',
      });

      this.speakReply(advanced.speechResponseRomanUrdu, 'Focused', 88, 'high');
      return;
    }

    // Artifact Generation (Vector Logo, Website Code Sandbox, Research Report, Slides, Scripts, Automation)
    if (advanced.intent !== 'general' && advanced.artifact) {
      const assignedEmotion =
        advanced.intent === 'software_engineering' || advanced.intent === 'code_error_fix'
          ? 'Focused'
          : advanced.intent === 'creative_logo' || advanced.intent === 'creative_presentation'
          ? 'Confident'
          : advanced.intent === 'research_analysis'
          ? 'Curious'
          : 'Happy';

      useEmotionStore.getState().setEmotion(assignedEmotion, 90, 'high');

      useConversationStore.getState().addMessage({
        conversationId: useConversationStore.getState().activeConversationId,
        role: 'zara',
        content: advanced.speechResponseRomanUrdu,
        language: 'roman_urdu',
        emotion: assignedEmotion,
        emotionIntensity: 90,
        confidenceLevel: 'high',
        artifact: advanced.artifact,
      });

      this.speakReply(advanced.speechResponseRomanUrdu, assignedEmotion, 90, 'high');
      return;
    }

    // -------------------------------------------------------------
    // 2. Laptop & Desktop Control actions (Safe immediate vs Sensitive confirm)
    // -------------------------------------------------------------
    const laptopParsed = parseLaptopAction(query);
    if (laptopParsed.isLaptopAction && laptopParsed.action) {
      const action = laptopParsed.action;

      // Safe immediate execution for non-destructive actions
      const isSafeImmediate =
        action.type === 'app_launch' ||
        action.type === 'folder_open' ||
        action.type === 'screenshot_take' ||
        action.type === 'browser_open_url' ||
        action.type === 'browser_search' ||
        action.type === 'browser_tab_open' ||
        action.type === 'browser_tab_close' ||
        action.type === 'browser_bookmark' ||
        action.type === 'file_search' ||
        action.type === 'volume_change' ||
        action.type === 'volume_set';

      if (isSafeImmediate && !action.requiresDoubleConfirm) {
        await useLaptopControlStore.getState().executeDirectAction(action);
        const replyText =
          action.type === 'app_launch'
            ? `Boss, ${action.target} foran open kar diya hai!`
            : action.type === 'screenshot_take'
            ? 'Boss, desktop ka screenshot le liya hai! Preview samne hai.'
            : action.type === 'folder_open'
            ? `Boss, ${action.target} folder khol diya hai!`
            : action.type === 'file_search'
            ? `Boss, "${action.target}" file search kar li hai!`
            : `Boss, ${action.descriptionRomanUrdu} complete kar diya hai!`;

        useConversationStore.getState().addMessage({
          conversationId: useConversationStore.getState().activeConversationId,
          role: 'zara',
          content: replyText,
          language: 'roman_urdu',
          emotion: 'Confident',
        });

        this.speakReply(replyText, 'Confident', 85);
        return;
      }

      // Sensitive actions require double confirmation modal (e.g. file delete, app close)
      useLaptopControlStore.getState().setPendingAction(action);

      useConversationStore.getState().addMessage({
        conversationId: useConversationStore.getState().activeConversationId,
        role: 'zara',
        content: action.confirmPrompt,
        language: 'roman_urdu',
        emotion: action.requiresDoubleConfirm ? 'Focused' : 'Curious',
      });

      this.speakReply(
        action.confirmPrompt,
        action.requiresDoubleConfirm ? 'Focused' : 'Curious',
        85
      );
      return;
    }

    // -------------------------------------------------------------
    // 3. Fallback WhatsApp Parser
    // -------------------------------------------------------------
    const waCheck = parseWhatsAppCommand(query);
    if (waCheck.isWhatsAppIntent && waCheck.contactName && waCheck.messageText) {
      try {
        await apiFetch('/api/whatsapp/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactName: waCheck.contactName,
            messageText: waCheck.messageText,
          }),
        });
      } catch (e) {
        console.warn('WhatsApp draft error:', e);
      }

      const responseText = `Theek hai Boss, ${waCheck.contactName} ko yeh message draft kar diya hai: "${waCheck.messageText}". WhatsApp dispatch ready hai!`;
      this.speakReply(responseText, 'Focused', 85, 'high', 'gemini-3.8-flash');
      return;
    }

    // -------------------------------------------------------------
    // 4. Standard Chat / Question answering via server
    // -------------------------------------------------------------
    const highThinking = useZaraStore.getState().highThinkingEnabled;
    const currentEmotion = useEmotionStore.getState().currentEmotion;
    const preferredLang = useSettingsStore.getState().settings.preferredLanguage || 'roman_urdu';
    const detectedLang: SupportedLanguage = detectLanguage(query, preferredLang);

    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          conversationHistory: useConversationStore.getState().messages,
          highThinking,
          currentEmotion,
          language: detectedLang,
          modelId: highThinking ? 'gemini-4-argon' : 'gemini-3.8-flash',
        }),
      });

      let data: any = null;
      try {
        const rawText = await res.text();
        try {
          data = JSON.parse(rawText);
        } catch {
          console.warn('[ZARA Orchestrator] Response body was not JSON:', rawText.slice(0, 100));
        }
      } catch (readErr) {
        console.warn('[ZARA Orchestrator] Could not read response stream:', readErr);
      }

      // Replaces old generic canned line with helpful, polite, language-matched clarification
      const replyText =
        data?.response ||
        getClarificationResponse(detectedLang, 'unclear');

      const assignedEmotion = data?.emotion || 'Confident';
      const assignedIntensity = typeof data?.intensity === 'number' ? data.intensity : 80;
      const assignedConfidence = data?.confidence || 'high';
      const assignedModel = data?.modelUsed || 'gemini-3.8-flash';

      // Update emotion safely
      if (data?.emotion) {
        useEmotionStore.getState().setEmotion(data.emotion, assignedIntensity, assignedConfidence);
      }

      // Add ZARA message to history
      useConversationStore.getState().addMessage({
        conversationId: useConversationStore.getState().activeConversationId,
        role: 'zara',
        content: replyText,
        language: detectedLang,
        emotion: assignedEmotion,
        emotionIntensity: assignedIntensity,
        confidenceLevel: assignedConfidence,
        modelUsed: assignedModel,
        tokenCount: data?.tokensUsed || 0,
        isThinking: Boolean(data?.isThinking),
      });

      // Speak response in the user's language
      this.speakReply(replyText, assignedEmotion, assignedIntensity, assignedConfidence, assignedModel, detectedLang);
    } catch (err: any) {
      console.error('Chat processing error:', err);
      const fallbackReply = getClarificationResponse(detectedLang, 'network');
      this.speakReply(fallbackReply, 'Caring', 75, 'low', 'gemini-3.8-flash', detectedLang);
    }
  }

  public speakReply(
    text: string,
    emotion = 'Confident',
    intensity = 80,
    confidence = 'high',
    modelUsed = 'gemini-3.8-flash',
    languageOverride?: SupportedLanguage
  ) {
    const isMuted = useZaraStore.getState().isMuted;
    if (isMuted) {
      useZaraStore.getState().setState('STANDBY');
      return;
    }

    // Strict speaker lockout: disable mic and recognition immediately before TTS playback starts
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    this.isCooldown = false;
    speechRecognitionEngine.setLockedOut(true);

    useZaraStore.getState().setState('SPEAKING');
    useZaraStore.getState().setAudioPlaying(true);

    const { voiceSpeed, voiceVolume, preferredLanguage } = useSettingsStore.getState().settings;
    const targetLang: SupportedLanguage = languageOverride || detectLanguage(text, preferredLanguage);

    const speechStyle =
      targetLang === 'urdu'
        ? 'Warm, friendly real Pakistani female best friend, authentic natural Urdu script pronunciation, fluent Pakistani dostana cadence, clear and expressive'
        : targetLang === 'english'
        ? 'Warm, friendly real female best friend, natural conversational English pronunciation, casual and expressive'
        : 'Warm, friendly real Pakistani female best friend, natural Urdu and Roman Urdu conversational pronunciation, authentic Pakistani dostana accent and cadence, casual and expressive';

    // Request Gemini TTS
    apiFetch('/api/voice/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        emotion,
        language: targetLang,
        voiceConfig: { voiceName: targetLang === 'english' ? 'Zephyr' : 'Kore' },
        speechStyle,
      }),
    })
      .then((r) => r.json())
      .then((ttsData) => {
        voicePlaybackEngine.play(
          text,
          ttsData?.audioBase64,
          voiceSpeed,
          voiceVolume,
          targetLang
        );
      })
      .catch((err) => {
        console.warn('TTS fetch error:', err);
        voicePlaybackEngine.play(
          text,
          null,
          voiceSpeed,
          voiceVolume,
          targetLang
        );
      });
  }

  public setLanguage(lang: 'roman_urdu' | 'english' | 'urdu') {
    useSettingsStore.getState().updateSetting('preferredLanguage', lang);
    speechRecognitionEngine.setLanguage(lang);

    if (lang === 'english') {
      this.speakReply(
        "Switched to English mode, Boss! How's your day going?",
        'Confident',
        85,
        'high',
        'gemini-3.8-flash',
        'english'
      );
    } else if (lang === 'urdu') {
      this.speakReply(
        'اردو موڈ فعال ہو گیا، باس! فرمائیے، کیا کام شروع کریں؟',
        'Confident',
        85,
        'high',
        'gemini-3.8-flash',
        'urdu'
      );
    } else {
      this.speakReply(
        'Roman Urdu mode active ho gaya, Boss! Batao kya chal raha hai?',
        'Confident',
        85,
        'high',
        'gemini-3.8-flash',
        'roman_urdu'
      );
    }
  }


  public startListening() {
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    this.isCooldown = false;
    speechRecognitionEngine.setLockedOut(false);
    useZaraStore.getState().setState('LISTENING');
    speechRecognitionEngine.start();
  }

  public stopListening() {
    speechRecognitionEngine.stop();
    useZaraStore.getState().setState('STANDBY');
  }

  public getIsCooldown(): boolean {
    return this.isCooldown;
  }
}

export const orchestrator = new ConversationOrchestrator();
