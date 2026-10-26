import { GeminiModelConfig } from '../types/zara.types.ts';

export const DEFAULT_GEMINI_MODELS: GeminiModelConfig[] = [
  {
    modelId: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash (Primary Chat)',
    capabilities: ['text', 'fast-turn', 'reasoning'],
    isPrimary: true,
    isFallback: false,
    taskType: 'chat',
    isEnabled: true,
  },
  {
    modelId: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash (High Thinking Mode)',
    capabilities: ['text', 'deep-reasoning', 'high-thinking'],
    isPrimary: false,
    isFallback: false,
    taskType: 'thinking',
    isEnabled: true,
  },
  {
    modelId: 'gemini-flash-lite-latest',
    displayName: 'Gemini Flash Lite (Ultra-Fast Live)',
    capabilities: ['text', 'ultra-fast', 'low-latency', 'reasoning'],
    isPrimary: false,
    isFallback: true,
    taskType: 'chat',
    isEnabled: true,
  },
  {
    modelId: 'gemini-2.5-flash-preview-tts',
    displayName: 'Gemini 2.5 Flash Preview TTS',
    capabilities: ['audio-speech', 'natural-tts', 'low-latency'],
    isPrimary: true,
    isFallback: false,
    taskType: 'voice',
    isEnabled: true,
  },
  {
    modelId: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash (Fallback)',
    capabilities: ['text', 'ultra-fast', 'fallback'],
    isPrimary: false,
    isFallback: true,
    taskType: 'chat',
    isEnabled: true,
  },
];
