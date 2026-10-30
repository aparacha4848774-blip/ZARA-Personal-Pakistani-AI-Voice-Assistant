import { create } from 'zustand';
import { Message } from '../types/zara.types.ts';
import { EmotionType } from '../logic/emotionRules.ts';
import { apiFetch } from '../utils/apiClient.ts';

const ACTIVE_CONVERSATION_KEY = 'zara-active-conversation-id';
function getSavedConversationId(): string {
  if (typeof window === 'undefined') return 'session-default';
  try {
    return window.localStorage.getItem(ACTIVE_CONVERSATION_KEY) || 'session-default';
  } catch {
    return 'session-default';
  }
}

interface ConversationStoreState {
  messages: Message[];
  activeConversationId: string;
  isProcessing: boolean;
  transcriptDraft: string;

  addMessage: (msg: Omit<Message, 'id' | 'createdAt'>) => Message;
  setProcessing: (isProcessing: boolean) => void;
  setTranscriptDraft: (text: string) => void;
  clearHistory: () => void;
  loadInitialMessages: () => Promise<void>;
}

const initialConversationId = getSavedConversationId();

export const useConversationStore = create<ConversationStoreState>((set, get) => ({
  messages: [
    {
      id: 'init-1',
      conversationId: initialConversationId,
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
  activeConversationId: initialConversationId,
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

    void apiFetch('/api/conversations/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newMessage.id,
        conversationId: newMessage.conversationId,
        role: newMessage.role,
        content: newMessage.content,
        language: newMessage.language,
        modelUsed: newMessage.modelUsed,
      }),
    }).then((response) => {
      if (!response.ok) console.warn('Conversation history was not persisted:', response.status);
    }).catch((error) => console.warn('Conversation history persistence failed:', error));

    return newMessage;
  },

  setProcessing: (isProcessing: boolean) => set({ isProcessing }),

  setTranscriptDraft: (transcriptDraft: string) => set({ transcriptDraft }),

  clearHistory: () => {
    const conversationId = 'session-' + Date.now();
    try { window.localStorage.setItem(ACTIVE_CONVERSATION_KEY, conversationId); } catch { /* local persistence is optional */ }
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
