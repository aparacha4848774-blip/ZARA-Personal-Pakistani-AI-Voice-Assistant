import { create } from 'zustand';
import { ZaraState } from '../types/zara.types.ts';

interface ZaraStoreState {
  state: ZaraState;
  previousState: ZaraState;
  activeRoute: string;
  isMuted: boolean;
  isWakeWordEnabled: boolean;
  highThinkingEnabled: boolean;
  isAudioPlaying: boolean;
  audioAmplitude: number[];
  errorMessage: string | null;
  wakeWordTriggerCount: number;

  setState: (state: ZaraState) => void;
  setActiveRoute: (route: string) => void;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  toggleWakeWord: () => void;
  toggleHighThinking: () => void;
  setHighThinking: (enabled: boolean) => void;
  setAudioPlaying: (playing: boolean) => void;
  setAudioAmplitude: (amplitude: number[]) => void;
  setError: (msg: string | null) => void;
  triggerWakeWord: (phrase?: string) => void;
  interruptSpeaking: () => void;
}

export const useZaraStore = create<ZaraStoreState>((set, get) => ({
  state: 'STANDBY',
  previousState: 'STANDBY',
  activeRoute: 'home',
  isMuted: false,
  isWakeWordEnabled: true,
  highThinkingEnabled: false,
  isAudioPlaying: false,
  audioAmplitude: [0.1, 0.15, 0.1, 0.2, 0.15, 0.1, 0.1],
  errorMessage: null,
  wakeWordTriggerCount: 0,

  setState: (newState: ZaraState) => {
    const current = get().state;
    if (current === newState) return;
    set({ previousState: current, state: newState });
  },

  setActiveRoute: (route: string) => set({ activeRoute: route }),

  toggleMute: () => {
    const isMuted = !get().isMuted;
    set((state) => ({
      isMuted,
      state: isMuted ? 'MUTED' : state.previousState === 'MUTED' ? 'STANDBY' : state.previousState,
    }));
  },

  setMuted: (muted: boolean) => {
    set((state) => ({
      isMuted: muted,
      state: muted ? 'MUTED' : 'STANDBY',
    }));
  },

  toggleWakeWord: () => set((state) => ({ isWakeWordEnabled: !state.isWakeWordEnabled })),

  toggleHighThinking: () => set((state) => ({ highThinkingEnabled: !state.highThinkingEnabled })),

  setHighThinking: (enabled: boolean) => set({ highThinkingEnabled: enabled }),

  setAudioPlaying: (playing: boolean) => set({ isAudioPlaying: playing }),

  setAudioAmplitude: (amplitude: number[]) => set({ audioAmplitude: amplitude }),

  setError: (msg: string | null) =>
    set({
      errorMessage: msg,
      state: msg ? 'ERROR' : 'STANDBY',
    }),

  triggerWakeWord: (_phrase?: string) => {
    const { isMuted } = get();
    if (isMuted) return;

    set((state) => ({
      state: 'WAKE_WORD_DETECTED',
      wakeWordTriggerCount: state.wakeWordTriggerCount + 1,
    }));

    // Auto transition to LISTENING after visual burst
    setTimeout(() => {
      const current = get().state;
      if (current === 'WAKE_WORD_DETECTED') {
        set({ state: 'LISTENING' });
      }
    }, 1100);
  },

  interruptSpeaking: () => {
    const current = get().state;
    if (current === 'SPEAKING') {
      set({ state: 'INTERRUPTED', isAudioPlaying: false });
      setTimeout(() => {
        set({ state: 'LISTENING' });
      }, 400);
    }
  },
}));
