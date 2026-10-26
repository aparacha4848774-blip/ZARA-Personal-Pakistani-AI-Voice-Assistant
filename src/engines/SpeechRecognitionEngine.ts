type TranscriptCallback = (transcript: string, isFinal: boolean) => void;
type StatusCallback = (isListening: boolean) => void;
type ErrorCallback = (error: string) => void;

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

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Web Speech API not natively supported in this browser environment.');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'ur-PK'; // Urdu (Pakistan), accepts mixed Roman Urdu & English

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
        if (this.onStatus) this.onStatus(true);
      };

      this.recognition.onresult = (event: any) => {
        // Drop any results received while locked out (e.g. echo of ZARA's own TTS output)
        if (this.isLockedOut) {
          return;
        }

        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        const transcript = (final || interim).trim();
        this.currentTranscript = transcript;

        if (this.onTranscript && transcript) {
          this.onTranscript(transcript, Boolean(final));
        }

        // Reset silence timer on any speech detected
        this.resetSilenceTimer();
      };

      this.recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          // Normal background pause or manual abort
          return;
        }
        console.warn('SpeechRecognition error:', event.error);
        if (this.onError) this.onError(event.error);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (this.onStatus) this.onStatus(false);

        // Auto restart only if continuous listening is enabled AND mic is not locked out
        if (this.shouldKeepListening && !this.isLockedOut) {
          try {
            this.recognition.start();
          } catch (e) {
            // ignore rapid restart errors
          }
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
      this.currentTranscript = '';
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
      // Prevent listening when speaker lockout is active
      return;
    }

    this.shouldKeepListening = true;
    if (!this.recognition) {
      this.initRecognition();
    }
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
      } catch (e) {
        // already started
      }
    }
  }

  public stop() {
    this.shouldKeepListening = false;
    this.clearSilenceTimer();
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
    }
    this.isListening = false;
  }

  public resetSilenceTimer() {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      if (this.currentTranscript && this.onSilenceTrigger && !this.isLockedOut) {
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

  private currentLanguageCode = 'ur-PK';

  public setLanguage(lang: 'roman_urdu' | 'english' | 'urdu') {
    const langCode = lang === 'english' ? 'en-US' : 'ur-PK';
    this.currentLanguageCode = langCode;
    if (this.recognition) {
      this.recognition.lang = langCode;
      // If currently listening, briefly restart to apply language changes immediately
      if (this.isListening && !this.isLockedOut) {
        try {
          this.recognition.stop();
        } catch (e) {
          // ignore
        }
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
