import { create } from 'zustand';
import { EmotionType, EMOTIONS, EmotionInfo } from '../logic/emotionRules.ts';
import { ConfidenceLevel } from '../types/zara.types.ts';
import {
  UserFaceEmotion,
  USER_EMOTIONS,
  mapUserEmotionToZara,
} from '../logic/cameraEmotionMapper.ts';

export interface EmotionHistoryItem {
  id: string;
  emotion: EmotionType;
  intensity: number;
  confidence: ConfidenceLevel;
  timestamp: string;
  source?: 'chat' | 'camera' | 'voice' | 'manual';
}

export interface CameraEmotionState {
  isActive: boolean;
  detectedEmotion: UserFaceEmotion | null;
  confidence: number; // 0 - 100
  lastDetectedAt: string | null;
  privacyMode: boolean; // Always true: zero persistence, strictly client-side
  facingMode: 'user' | 'environment';
  isSimulated: boolean;
}

interface EmotionStoreState {
  currentEmotion: EmotionType;
  intensity: number; // 0 - 100
  confidenceLevel: ConfidenceLevel;
  styleDescription: string;
  empathyLevel: number; // 0 - 100
  history: EmotionHistoryItem[];
  camera: CameraEmotionState;

  setEmotion: (
    emotion: EmotionType,
    intensity?: number,
    confidence?: ConfidenceLevel,
    source?: 'chat' | 'camera' | 'voice' | 'manual'
  ) => void;
  updateIntensity: (intensity: number) => void;
  setEmpathyLevel: (level: number) => void;
  getEmotionInfo: () => EmotionInfo;

  // Camera emotion actions
  setCameraActive: (active: boolean) => void;
  setCameraFacingMode: (mode: 'user' | 'environment') => void;
  setCameraSimulated: (simulated: boolean) => void;
  updateCameraDetectedEmotion: (emotion: UserFaceEmotion, confidence: number) => void;
  syncZaraToUserEmotion: (userEmotion: UserFaceEmotion, confidence?: number) => void;
}

export const useEmotionStore = create<EmotionStoreState>((set, get) => ({
  currentEmotion: 'Confident',
  intensity: 75,
  confidenceLevel: 'high',
  styleDescription: 'Clear, steady & poised',
  empathyLevel: 90,
  history: [
    {
      id: 'em-1',
      emotion: 'Confident',
      intensity: 75,
      confidence: 'high',
      timestamp: new Date().toISOString(),
      source: 'manual',
    },
  ],
  camera: {
    isActive: false,
    detectedEmotion: null,
    confidence: 0,
    lastDetectedAt: null,
    privacyMode: true,
    facingMode: 'user',
    isSimulated: false,
  },

  setEmotion: (emotion, intensity, confidence, source = 'manual') => {
    const current = get();
    const newIntensity = intensity !== undefined ? intensity : current.intensity;
    const newConfidence = confidence !== undefined ? confidence : current.confidenceLevel;
    const info = EMOTIONS[emotion] || EMOTIONS.Confident;

    set((state) => ({
      currentEmotion: emotion,
      intensity: newIntensity,
      confidenceLevel: newConfidence,
      styleDescription: info.defaultStyle,
      history: [
        {
          id: 'em-' + Date.now(),
          emotion,
          intensity: newIntensity,
          confidence: newConfidence,
          timestamp: new Date().toISOString(),
          source,
        },
        ...state.history.slice(0, 19),
      ],
    }));
  },

  updateIntensity: (intensity: number) =>
    set({ intensity: Math.max(0, Math.min(100, intensity)) }),

  setEmpathyLevel: (level: number) =>
    set({ empathyLevel: Math.max(0, Math.min(100, level)) }),

  getEmotionInfo: () => {
    const current = get().currentEmotion;
    return EMOTIONS[current] || EMOTIONS.Confident;
  },

  setCameraActive: (active: boolean) =>
    set((state) => ({
      camera: {
        ...state.camera,
        isActive: active,
      },
    })),

  setCameraFacingMode: (mode: 'user' | 'environment') =>
    set((state) => ({
      camera: {
        ...state.camera,
        facingMode: mode,
      },
    })),

  setCameraSimulated: (simulated: boolean) =>
    set((state) => ({
      camera: {
        ...state.camera,
        isSimulated: simulated,
      },
    })),

  updateCameraDetectedEmotion: (emotion: UserFaceEmotion, confidence: number) => {
    set((state) => ({
      camera: {
        ...state.camera,
        detectedEmotion: emotion,
        confidence,
        lastDetectedAt: new Date().toISOString(),
      },
    }));
    // Automatically sync ZARA's reaction
    get().syncZaraToUserEmotion(emotion, confidence);
  },

  syncZaraToUserEmotion: (userEmotion: UserFaceEmotion, confidence = 85) => {
    const reaction = mapUserEmotionToZara(userEmotion);
    const confLevel: ConfidenceLevel = confidence >= 80 ? 'high' : confidence >= 60 ? 'medium' : 'low';

    get().setEmotion(reaction.zaraEmotion, reaction.intensity, confLevel, 'camera');
    get().setEmpathyLevel(reaction.empathy);
  },
}));
