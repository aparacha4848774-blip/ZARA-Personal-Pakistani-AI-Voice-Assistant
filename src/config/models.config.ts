import { GeminiModelConfig } from '../types/zara.types.ts';

export const DEFAULT_GEMINI_MODELS: GeminiModelConfig[] = [
  {
    modelId: 'gemini-3.8-flash',
    displayName: 'Gemini 3.8 Flash (Primary Chat)',
    capabilities: ['text', 'fast-turn', 'reasoning', 'low-latency'],
    isPrimary: true,
    isFallback: false,
    taskType: 'chat',
    isEnabled: true,
  },
  {
    modelId: 'gemini-4-argon',
    displayName: 'Gemini 4 Argon (High Thinking & Reasoning)',
    capabilities: ['text', 'deep-reasoning', 'high-thinking', 'stem'],
    isPrimary: false,
    isFallback: false,
    taskType: 'thinking',
    isEnabled: true,
  },
  {
    modelId: 'gemini-3.1-flash-lite',
    displayName: 'Gemini 3.1 Flash Lite (Ultra-Fast Live)',
    capabilities: ['text', 'ultra-fast', 'low-latency', 'reasoning'],
    isPrimary: false,
    isFallback: true,
    taskType: 'chat',
    isEnabled: true,
  },
  {
    modelId: 'gemini-3.8-flash-lite-tts',
    displayName: 'Gemini 3.8 Flash Lite TTS',
    capabilities: ['audio-speech', 'natural-tts', 'low-latency'],
    isPrimary: true,
    isFallback: false,
    taskType: 'voice',
    isEnabled: true,
  },
  {
    modelId: 'gemini-flash-latest',
    displayName: 'Gemini Flash Latest (Adaptive Fallback)',
    capabilities: ['text', 'ultra-fast', 'fallback'],
    isPrimary: false,
    isFallback: true,
    taskType: 'chat',
    isEnabled: true,
  },
];
