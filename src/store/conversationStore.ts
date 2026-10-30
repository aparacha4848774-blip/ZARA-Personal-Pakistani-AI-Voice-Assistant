import { create } from 'zustand';
import { Message } from '../types/zara.types.ts';
import { EmotionType } from '../logic/emotionRules.ts';
import { apiFetch } from '../utils/apiClient.ts';

interface ConversationStoreState {
  messages: Message[];
  activeConversationId: string;
  isProcessing: boolean;
  transcriptDraft: string;

  addMessage: (msg: Omit<Message, 'id' | 'createdAt'>) => Message;
  setProcessing: (isProcessing: boolean) => void;
  setTranscriptDraft: (text: string) => void;
  clearHistory: () => {
    const conversationId = 'session-' + Date.now();
    set({
      activeConversationId: conversationId,
      messages: [
        {
          id: 'init-fresh',
          conversationId,
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
    });
  },

  loadInitialMessages: async () => {
    const conversationId = get().activeConversationId;
    try {
      const response = await apiFetch(`/api/conversations/${encodeURIComponent(conversationId)}/messages`);
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data.messages) && data.messages.length) {
        set({ messages: data.messages });
      }
    } catch (error) {
      console.warn('Could not restore conversation history:', error);
    }
  },
}));
