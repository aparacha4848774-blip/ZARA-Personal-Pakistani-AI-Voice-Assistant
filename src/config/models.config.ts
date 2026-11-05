import { GeminiModelConfig } from '../types/zara.types.ts';

// This registry reflects the model actually invoked by the Cloudflare Worker.
// Voice input/output currently use browser speech APIs, not a cloud Gemini TTS model.
export const DEFAULT_GEMINI_MODELS: GeminiModelConfig[] = [
  {
    modelId: '@cf/google/gemma-4-26b-a4b-it',
    displayName: 'Cloudflare Workers AI — Gemma 4 26B A4B',
    capabilities: ['chat', 'multilingual', 'reasoning', 'vision', 'high-thinking'],
    isPrimary: true,
    isFallback: false,
    taskType: 'chat',
    isEnabled: true,
  },
];
