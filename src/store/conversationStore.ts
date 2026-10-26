import { create } from 'zustand';
import { Message } from '../types/zara.types.ts';
import { EmotionType } from '../logic/emotionRules.ts';

interface ConversationStoreState {
  messages: Message[];
  activeConversationId: string;
  isProcessing: boolean;
  transcriptDraft: string;

  addMessage: (msg: Omit<Message, 'id' | 'createdAt'>) => Message;
  setProcessing: (isProcessing: boolean) => void;
  setTranscriptDraft: (text: string) => void;
  clearHistory: () => void;
  loadInitialMessages: () => void;
}

export const useConversationStore = create<ConversationStoreState>((set) => ({
  messages: [
    {
      id: 'init-1',
      conversationId: 'session-default',
      role: 'zara',
      content: 'Arre Boss! Kya chal raha hai? Batao!',
      language: 'roman_urdu',
      emotion: 'Happy' as EmotionType,
      emotionIntensity: 85,
      confidenceLevel: 'high',
      modelUsed: 'gemini-2.0-flash',
      createdAt: new Date().toISOString(),
    },
  ],
  activeConversationId: 'session-default',
  isProcessing: false,
  transcriptDraft: '',

  addMessage: (msgData) => {
    const newMessage: Message = {
      ...msgData,
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, newMessage],
    }));

    return newMessage;
  },

  setProcessing: (isProcessing: boolean) => set({ isProcessing }),

  setTranscriptDraft: (transcriptDraft: string) => set({ transcriptDraft }),

  clearHistory: () =>
    set({
      messages: [
        {
          id: 'init-fresh',
          conversationId: 'session-' + Date.now(),
          role: 'zara',
          content: 'Arre Boss! Kya chal raha hai? Batao!',
          language: 'roman_urdu',
          emotion: 'Happy',
          emotionIntensity: 85,
          confidenceLevel: 'high',
          modelUsed: 'gemini-2.0-flash',
          createdAt: new Date().toISOString(),
        },
      ],
    }),

  loadInitialMessages: () => {},
}));
