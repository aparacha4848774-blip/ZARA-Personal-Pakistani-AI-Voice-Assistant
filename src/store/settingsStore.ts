import { create } from 'zustand';
import { ZaraSettings } from '../types/zara.types.ts';
import { apiFetch } from '../utils/apiClient.ts';

interface SettingsStoreState {
  settings: ZaraSettings;
  isLoading: boolean;
  updateSetting: <K extends keyof ZaraSettings>(key: K, value: ZaraSettings[K]) => Promise<void>;
  fetchSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStoreState>((set) => ({
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
  isLoading: false,

  fetchSettings: async () => {
    try {
      set({ isLoading: true });
      const res = await apiFetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          set({ settings: data.settings });
        }
      }
    } catch (e) {
      console.warn('Could not fetch settings:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  updateSetting: async (key, value) => {
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    }));

    try {
      await apiFetch(`/api/settings/${String(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
    } catch (e) {
      console.warn('Could not persist setting update:', e);
    }
  },
}));
