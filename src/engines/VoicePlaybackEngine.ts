type AmplitudeCallback = (amplitude: number[]) => void;
type EndCallback = () => void;

class VoicePlaybackEngine {
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private animFrameId: number | null = null;
  private isSpeaking = false;
  private onAmplitudeUpdate: AmplitudeCallback | null = null;
  private onPlaybackEnd: EndCallback | null = null;

  public setCallbacks(onAmp: AmplitudeCallback, onEnd: EndCallback) {
    this.onAmplitudeUpdate = onAmp;
    this.onPlaybackEnd = onEnd;
  }

  public play(
    text: string,
    base64Audio?: string | null,
    voiceSpeed = 1.0,
    volume = 1.0,
    language: 'roman_urdu' | 'english' | 'urdu' = 'roman_urdu'
  ) {
    this.stop();
    this.isSpeaking = true;
    this.startSyntheticAmplitudeSimulation();

    // If real base64 WAV audio from Gemini TTS was provided
    if (base64Audio) {
      try {
        const audioSrc = `data:audio/wav;base64,${base64Audio}`;
        this.currentAudio = new Audio(audioSrc);
        this.currentAudio.playbackRate = voiceSpeed;
        this.currentAudio.volume = volume;

        this.currentAudio.onended = () => {
          this.cleanup();
          if (this.onPlaybackEnd) this.onPlaybackEnd();
        };

        this.currentAudio.onerror = () => {
          console.warn('Audio playback failed, falling back to speech synthesis');
          this.playWithSpeechSynthesis(text, voiceSpeed, volume, language);
        };

        this.currentAudio.play().catch(() => {
          this.playWithSpeechSynthesis(text, voiceSpeed, volume, language);
        });
        return;
      } catch (err) {
        console.warn('Failed to load audio element, using SpeechSynthesis', err);
      }
    }

    this.playWithSpeechSynthesis(text, voiceSpeed, volume, language);
  }

  private playWithSpeechSynthesis(
    text: string,
    voiceSpeed = 1.0,
    volume = 1.0,
    language: 'roman_urdu' | 'english' | 'urdu' = 'roman_urdu'
  ) {
    if (!('speechSynthesis' in window)) {
      setTimeout(() => {
        this.cleanup();
        if (this.onPlaybackEnd) this.onPlaybackEnd();
      }, 2500);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance = utterance;

    utterance.rate = voiceSpeed;
    utterance.volume = volume;
    utterance.pitch = 1.05; // Slightly warmer female pitch for ZARA

    const voices = window.speechSynthesis.getVoices();
    let naturalVoice: SpeechSynthesisVoice | undefined;

    if (language === 'english') {
      // Pick best natural English female voice
      naturalVoice =
        voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Jenny') || v.name.includes('Aria') || v.name.includes('Samantha'))) ||
        voices.find((v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ||
        voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Zira') || v.name.includes('Neerja'))) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        voices[0];
    } else {
      // Pick best available natural voice (Urdu / South Asian friendly cadence)
      naturalVoice =
        voices.find((v) => v.lang.toLowerCase() === 'ur-pk' || v.lang.toLowerCase() === 'ur_pk') ||
        voices.find((v) => v.lang.toLowerCase().startsWith('ur') && (v.name.includes('Natural') || v.name.includes('Online'))) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('ur')) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('hi') && (v.name.includes('Natural') || v.name.includes('Swara'))) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('hi')) ||
        voices.find((v) => v.name.toLowerCase().includes('fatima') || v.name.toLowerCase().includes('gul')) ||
        voices.find((v) => v.name.toLowerCase().includes('kore') || v.name.toLowerCase().includes('natural')) ||
        voices.find((v) => v.lang.includes('en-IN') && (v.name.includes('Neerja') || v.name.includes('Female'))) ||
        voices.find((v) => v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('female')) ||
        voices[0];
    }

    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    utterance.onend = () => {
      this.cleanup();
      if (this.onPlaybackEnd) this.onPlaybackEnd();
    };

    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e);
      this.cleanup();
      if (this.onPlaybackEnd) this.onPlaybackEnd();
    };

    window.speechSynthesis.speak(utterance);
  }

  public stop() {
    this.isSpeaking = false;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.currentUtterance = null;
    this.cleanup();
  }

  private cleanup() {
    this.isSpeaking = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.onAmplitudeUpdate) {
      this.onAmplitudeUpdate([0.08, 0.1, 0.08, 0.12, 0.09, 0.07, 0.08]);
    }
  }

  private startSyntheticAmplitudeSimulation() {
    const updateWave = () => {
      if (!this.isSpeaking) return;

      const bars = 7;
      const amps: number[] = [];
      const time = Date.now() * 0.008;

      for (let i = 0; i < bars; i++) {
        // Natural speech rhythm with modulated waves
        const wave = Math.sin(time + i * 0.8) * 0.4 + 0.5;
        const jitter = Math.random() * 0.3;
        amps.push(Math.min(1.0, Math.max(0.1, (wave + jitter) * 0.9)));
      }

      if (this.onAmplitudeUpdate) {
        this.onAmplitudeUpdate(amps);
      }

      this.animFrameId = requestAnimationFrame(updateWave);
    };

    this.animFrameId = requestAnimationFrame(updateWave);
  }
}

export const voicePlaybackEngine = new VoicePlaybackEngine();
