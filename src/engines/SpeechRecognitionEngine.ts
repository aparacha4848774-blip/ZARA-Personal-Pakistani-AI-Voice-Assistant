import { mapSpeechErrorToMessage, SupportedLanguage } from '../logic/languageDetector.ts';

type TranscriptCallback = (transcript: string, isFinal: boolean) => void;
type StatusCallback = (isListening: boolean) => void;
type ErrorCallback = (error: string, friendlyMessage: string) => void;

class SpeechRecognitionEngine {
  private recognition: any = null;
  private isListening = false;
  private shouldKeepListening = false;
  private isLockedOut = false; // Complete microphone lockout during SPEAKING & cooldown
  private silenceTimer: any = null;
  private currentTranscript = '';
  private onTranscript: TranscriptCallback | null = null;
  private onStatus: StatusCallback | null = null;
  private onError: ErrorCallback | null = null;
  private onSilenceTrigger: (() => void) | null = null;
  private silenceTimeoutMs = 1500;
  private restartTimeout: any = null;
  private consecutiveErrors = 0;
  private maxConsecutiveErrors = 4;
  private silenceAlreadySubmitted = false;
  private currentLanguageCode = 'ur-PK';
  private currentAppLanguage: SupportedLanguage = 'roman_urdu';

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Web Speech API is not supported in this browser. Please use Chrome, Edge, or a Web Speech enabled browser.');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.currentLanguageCode;

      this.recognition.onstart = () => {
        if (this.isLockedOut) {
          try {
            this.recognition.abort();
          } catch (e) {
            // ignore
          }
          this.isListening = false;
          if (this.onStatus) this.onStatus(false);
          return;
        }
        this.isListening = true;
        this.consecutiveErrors = 0; // reset error counter on successful start
        this.silenceAlreadySubmitted = false;
        if (this.onStatus) this.onStatus(true);
      };

      this.recognition.onresult = (event: any) => {
        // Drop any results received while locked out (e.g. echo of ZARA's own TTS output)
        if (this.isLockedOut) {
          return;
        }

        // Seamless continuous accumulation: preserve all results from 0 to results.length
        // so earlier finalized segments of an utterance are never dropped or truncated
        let fullFinal = '';
        let fullInterim = '';

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res && res[0] && res[0].transcript) {
            if (res.isFinal) {
              fullFinal += ' ' + res[0].transcript;
            } else {
              fullInterim += ' ' + res[0].transcript;
            }
          }
        }

        const transcript = (fullFinal + ' ' + fullInterim).replace(/\s+/g, ' ').trim();

        // Never emit empty transcripts or invent fake speech
        if (!transcript) {
          return;
        }

        this.currentTranscript = transcript;
        this.silenceAlreadySubmitted = false;

        const isOverallFinal = Boolean(fullFinal.trim()) && !fullInterim.trim();

        if (this.onTranscript) {
          this.onTranscript(transcript, isOverallFinal);
        }

        // Reset silence timer on any speech detected
        this.resetSilenceTimer();
      };

      this.recognition.onerror = (event: any) => {
        const errType = event.error;

        if (errType === 'no-speech' || errType === 'aborted') {
          // Normal background silence or deliberate abort; do not increment error limit
          return;
        }

        this.consecutiveErrors += 1;
        const mapped = mapSpeechErrorToMessage(errType, this.currentAppLanguage);

        if (errType === 'not-allowed' || errType === 'permission-denied') {
          this.shouldKeepListening = false; // Stop restart attempts if permission is denied
        }

        console.warn(`[SpeechRecognition] ${errType}:`, mapped.friendlyMessage);
        if (this.onError) this.onError(errType, mapped.friendlyMessage);

        // If hitting repeated rapid errors, pause auto-restarts to prevent loop
        if (this.consecutiveErrors >= this.maxConsecutiveErrors || mapped.isFatal) {
          console.warn('[SpeechRecognition] Fatal or consecutive errors reached. Pausing auto-restart.');
          this.shouldKeepListening = false;
        }
      };


      this.recognition.onend = () => {
        this.isListening = false;
        if (this.onStatus) this.onStatus(false);

        // Auto restart only if continuous listening is enabled, mic is not locked out, and error limit not hit
        if (this.shouldKeepListening && !this.isLockedOut && this.consecutiveErrors < this.maxConsecutiveErrors) {
          if (this.restartTimeout) clearTimeout(this.restartTimeout);
          this.restartTimeout = setTimeout(() => {
            if (this.shouldKeepListening && !this.isLockedOut) {
              try {
                this.recognition.start();
              } catch (e) {
                // ignore rapid restart attempts
              }
            }
          }, 300);
        }
      };
    } catch (err) {
      console.warn('Failed to initialize SpeechRecognition:', err);
    }
  }

  public setCallbacks(
    onTranscript: TranscriptCallback,
    onStatus: StatusCallback,
    onError: ErrorCallback,
    onSilence: () => void
  ) {
    this.onTranscript = onTranscript;
    this.onStatus = onStatus;
    this.onError = onError;
    this.onSilenceTrigger = onSilence;
  }

  public setSilenceTimeout(ms: number) {
    this.silenceTimeoutMs = ms;
  }

  public setLockedOut(locked: boolean) {
    this.isLockedOut = locked;
    if (locked) {
      this.shouldKeepListening = false;
      this.clearSilenceTimer();
      if (this.restartTimeout) clearTimeout(this.restartTimeout);
      this.currentTranscript = '';
      this.silenceAlreadySubmitted = true;
      if (this.recognition && this.isListening) {
        try {
          if (typeof this.recognition.abort === 'function') {
            this.recognition.abort();
          } else {
            this.recognition.stop();
          }
        } catch (e) {
          // ignore
        }
      }
      this.isListening = false;
      if (this.onStatus) this.onStatus(false);
    }
  }

  public getIsLockedOut(): boolean {
    return this.isLockedOut;
  }

  public start() {
    if (this.isLockedOut) {
      return;
    }

    this.shouldKeepListening = true;
    this.consecutiveErrors = 0; // reset on manual user start
    this.silenceAlreadySubmitted = false;

    if (!this.recognition) {
      this.initRecognition();
    }
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
      } catch (e) {
        // already active
      }
    }
  }

  public stop() {
    this.shouldKeepListening = false;
    this.clearSilenceTimer();
    if (this.restartTimeout) clearTimeout(this.restartTimeout);
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
    }
    this.isListening = false;
    this.currentTranscript = '';
    this.silenceAlreadySubmitted = false;
    if (this.onStatus) this.onStatus(false);
  }

  public resetSilenceTimer() {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      // Prevent double firing of silence on the same phrase
      if (this.currentTranscript && this.onSilenceTrigger && !this.isLockedOut && !this.silenceAlreadySubmitted) {
        this.silenceAlreadySubmitted = true;
        this.onSilenceTrigger();
      }
    }, this.silenceTimeoutMs);
  }

  public clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  public setLanguage(lang: 'roman_urdu' | 'english' | 'urdu') {
    this.currentAppLanguage = lang;
    const langCode = lang === 'english' ? 'en-US' : 'ur-PK';
    this.currentLanguageCode = langCode;

    if (this.recognition) {
      this.recognition.lang = langCode;

      // If currently listening, cleanly restart session with the new language
      if (this.isListening && !this.isLockedOut) {
        try {
          this.recognition.abort();
        } catch (e) {
          // ignore
        }
        setTimeout(() => {
          if (this.shouldKeepListening && !this.isLockedOut) {
            try {
              this.recognition.start();
            } catch (e) {
              // ignore
            }
          }
        }, 150);
      }
    }
  }

  public getLanguage(): string {
    return this.recognition?.lang || this.currentLanguageCode;
  }

  public isAvailable(): boolean {
    return Boolean(
      typeof window !== 'undefined' &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    );
  }
}

export const speechRecognitionEngine = new SpeechRecognitionEngine();
