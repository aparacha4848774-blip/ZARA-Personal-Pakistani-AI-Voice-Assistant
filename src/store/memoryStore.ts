import { create } from 'zustand';
import { MemoryEntry } from '../types/zara.types.ts';
import { apiFetch } from '../utils/apiClient.ts';

interface MemoryStoreState {
  memories: MemoryEntry[];
  isLoading: boolean;
  filterCategory: string;

  setFilterCategory: (cat: string) => void;
  fetchMemories: () => Promise<void>;
  addMemory: (memory: Omit<MemoryEntry, 'id' | 'createdAt'>) => Promise<void>;
  updateMemory: (id: string, updates: Partial<MemoryEntry>) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  approveMemory: (id: string) => Promise<void>;
}

export const useMemoryStore = create<MemoryStoreState>((set, get) => ({
  memories: [
    {
      id: 'mem-1',
      category: 'preference',
      key: 'Owner Name',
      value: 'Boss',
      importance: 'high',
      userApproved: true,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'mem-2',
      category: 'preference',
      key: 'Favorite Beverage',
      value: 'Cardamom Elaichi Karak Chai',
      importance: 'medium',
      userApproved: true,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'mem-3',
      category: 'instruction',
      key: 'Speaking Persona',
      value: 'Pakistani dostana lehja, Roman Urdu, no robotic answers',
      importance: 'high',
      userApproved: true,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ],
  isLoading: false,
  filterCategory: 'all',

  setFilterCategory: (cat: string) => set({ filterCategory: cat }),

  fetchMemories: async () => {
    try {
      set({ isLoading: true });
      const res = await apiFetch('/api/memory');
      if (res.ok) {
        const data = await res.json();
        if (data.memories) {
          set({ memories: data.memories });
        }
      }
    } catch (e) {
      console.warn('Memory fetch error:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  addMemory: async (entry) => {
    const newEntry: MemoryEntry = {
      ...entry,
      id: 'mem-' + Date.now(),
      createdAt: new Date().toISOString(),
    };

    set((state) => ({ memories: [newEntry, ...state.memories] }));

    try {
      await apiFetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch (e) {
      console.warn('Could not persist memory to backend:', e);
    }
  },

  updateMemory: async (id, updates) => {
    set((state) => ({
      memories: state.memories.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    }));

    try {
      await apiFetch(`/api/memory/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch (e) {
      console.warn('Could not update memory on backend:', e);
    }
  },

  deleteMemory: async (id) => {
    set((state) => ({
      memories: state.memories.filter((m) => m.id !== id),
    }));

    try {
      await apiFetch(`/api/memory/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Could not delete memory on backend:', e);
    }
  },

  approveMemory: async (id) => {
    await get().updateMemory(id, { userApproved: true });
  },
}));
