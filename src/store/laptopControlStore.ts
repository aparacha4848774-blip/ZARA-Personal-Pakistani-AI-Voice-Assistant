import { create } from 'zustand';
import {
  LaptopAction,
  FileItem,
  SystemAppInfo,
  ScreenshotRecord,
  ActionConfirmationStatus,
} from '../types/laptopControl.types.ts';

interface LaptopControlState {
  pendingAction: LaptopAction | null;
  confirmationStep: 'idle' | 'awaiting_first' | 'awaiting_double';
  history: LaptopAction[];
  systemVolume: number;
  isMuted: boolean;
  clipboardContent: string;
  appsList: SystemAppInfo[];
  recentScreenshots: ScreenshotRecord[];
  currentDirectory: string;
  filesInCurrentDir: FileItem[];
  searchResults: FileItem[];
  isSearching: boolean;
  isExecuting: boolean;
  lastExecutionMessage: string | null;

  // Actions
  setPendingAction: (action: LaptopAction | null) => void;
  confirmPendingAction: () => Promise<void>;
  cancelPendingAction: (reason?: string) => void;
  executeDirectAction: (action: LaptopAction) => Promise<any>;
  setSystemVolume: (vol: number) => Promise<void>;
  changeSystemVolume: (delta: number) => Promise<void>;
  browseDirectory: (folderName?: string) => Promise<void>;
  searchFiles: (query: string) => Promise<void>;
  takeScreenshot: () => Promise<ScreenshotRecord | null>;
  launchApp: (appName: string) => Promise<boolean>;
  closeApp: (appName: string) => Promise<boolean>;
  openUrl: (url: string) => Promise<boolean>;
  sendWhatsAppDirect: (contact: string, message: string) => Promise<boolean>;
}

export const useLaptopControlStore = create<LaptopControlState>((set, get) => ({
  pendingAction: null,
  confirmationStep: 'idle',
  history: [],
  systemVolume: 70,
  isMuted: false,
  clipboardContent: '',
  currentDirectory: 'Downloads',
  filesInCurrentDir: [
    { name: 'resume.pdf', path: 'Downloads/resume.pdf', isDirectory: false, sizeBytes: 245000, extension: 'pdf', modifiedAt: 'Today, 2:30 PM' },
    { name: 'project_notes.txt', path: 'Downloads/project_notes.txt', isDirectory: false, sizeBytes: 12000, extension: 'txt', modifiedAt: 'Yesterday' },
    { name: 'ZARA_Desktop_Installer.exe', path: 'Downloads/ZARA_Desktop_Installer.exe', isDirectory: false, sizeBytes: 45000000, extension: 'exe', modifiedAt: '3 days ago' },
    { name: 'Screenshots', path: 'Downloads/Screenshots', isDirectory: true, modifiedAt: 'This week' },
    { name: 'presentation.pptx', path: 'Downloads/presentation.pptx', isDirectory: false, sizeBytes: 3400000, extension: 'pptx', modifiedAt: 'Last week' },
  ],
  searchResults: [],
  isSearching: false,
  isExecuting: false,
  lastExecutionMessage: null,
  appsList: [
    { id: 'app-1', name: 'Notepad', command: 'notepad', category: 'utility', icon: 'FileText', isRunning: false },
    { id: 'app-2', name: 'Calculator', command: 'calc', category: 'utility', icon: 'Calculator', isRunning: false },
    { id: 'app-3', name: 'Google Chrome', command: 'chrome', category: 'browser', icon: 'Globe', isRunning: true },
    { id: 'app-4', name: 'VS Code', command: 'code', category: 'development', icon: 'Code', isRunning: true },
    { id: 'app-5', name: 'Terminal', command: 'cmd', category: 'utility', icon: 'Terminal', isRunning: true },
    { id: 'app-6', name: 'Task Manager', command: 'taskmgr', category: 'utility', icon: 'Activity', isRunning: false },
    { id: 'app-7', name: 'WhatsApp Desktop', command: 'whatsapp', category: 'communication', icon: 'MessageCircle', isRunning: true },
  ],
  recentScreenshots: [],

  setPendingAction: (action: LaptopAction | null) => {
    if (!action) {
      set({ pendingAction: null, confirmationStep: 'idle' });
      return;
    }
    set({
      pendingAction: action,
      confirmationStep: 'awaiting_first',
    });
  },

  confirmPendingAction: async () => {
    const { pendingAction, confirmationStep } = get();
    if (!pendingAction) return;

    // Check if double confirm is required and we are only on first step
    if (pendingAction.requiresDoubleConfirm && confirmationStep === 'awaiting_first') {
      set({
        confirmationStep: 'awaiting_double',
        pendingAction: {
          ...pendingAction,
          status: 'first_confirmed',
        },
      });
      return;
    }

    // Otherwise proceed to execute!
    const actionToRun = {
      ...pendingAction,
      status: 'executing' as ActionConfirmationStatus,
    };
    set({ pendingAction: actionToRun, isExecuting: true });

    try {
      const res = await fetch('/api/system/control/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actionToRun),
      });

      const data = await res.json();
      const completedAction: LaptopAction = {
        ...actionToRun,
        status: data.success ? 'completed' : 'failed',
        result: data.result || data.message,
        executedAt: new Date().toISOString(),
      };

      set((state) => ({
        pendingAction: null,
        confirmationStep: 'idle',
        isExecuting: false,
        history: [completedAction, ...state.history],
        lastExecutionMessage: data.message || 'Action executed successfully',
      }));

      // Update local state based on action type
      if (completedAction.type === 'volume_change' || completedAction.type === 'volume_set') {
        if (typeof data.newVolume === 'number') {
          set({ systemVolume: data.newVolume, isMuted: data.newVolume === 0 });
        }
      } else if (completedAction.type === 'screenshot_take' && data.screenshot) {
        set((state) => ({
          recentScreenshots: [data.screenshot, ...state.recentScreenshots],
        }));
      } else if (completedAction.type === 'folder_open') {
        get().browseDirectory(completedAction.target);
      }
    } catch (err: any) {
      set((state) => ({
        pendingAction: null,
        confirmationStep: 'idle',
        isExecuting: false,
        history: [
          {
            ...actionToRun,
            status: 'failed',
            error: err.message,
            executedAt: new Date().toISOString(),
          },
          ...state.history,
        ],
        lastExecutionMessage: `Error: ${err.message}`,
      }));
    }
  },

  cancelPendingAction: (reason = 'Cancelled by user') => {
    const { pendingAction } = get();
    if (!pendingAction) return;

    const cancelledAction: LaptopAction = {
      ...pendingAction,
      status: 'cancelled',
      executedAt: new Date().toISOString(),
      result: reason,
    };

    set((state) => ({
      pendingAction: null,
      confirmationStep: 'idle',
      history: [cancelledAction, ...state.history],
      lastExecutionMessage: 'Action cancelled.',
    }));
  },

  executeDirectAction: async (action: LaptopAction) => {
    // If it requires double confirmation, prompt confirmation modal instead of running directly
    if (action.requiresDoubleConfirm) {
      get().setPendingAction(action);
      return;
    }

    try {
      set({ isExecuting: true });
      const res = await fetch('/api/system/control/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      const data = await res.json();
      const completed: LaptopAction = {
        ...action,
        status: data.success ? 'completed' : 'failed',
        result: data.result || data.message,
        executedAt: new Date().toISOString(),
      };
      set((state) => ({
        isExecuting: false,
        history: [completed, ...state.history],
        lastExecutionMessage: data.message,
      }));
      return data;
    } catch (e: any) {
      set({ isExecuting: false });
      console.error('Execute direct action error:', e);
    }
  },

  setSystemVolume: async (vol: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(vol)));
    set({ systemVolume: clamped, isMuted: clamped === 0 });
    try {
      await fetch('/api/system/control/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'volume_set',
          target: 'system_volume',
          payload: { volume: clamped },
        }),
      });
    } catch (e) {
      console.warn('Set volume error:', e);
    }
  },

  changeSystemVolume: async (delta: number) => {
    const current = get().systemVolume;
    const next = Math.max(0, Math.min(100, current + delta));
    await get().setSystemVolume(next);
  },

  browseDirectory: async (folderName = 'Downloads') => {
    try {
      const res = await fetch(`/api/system/files/browse?folder=${encodeURIComponent(folderName)}`);
      if (res.ok) {
        const data = await res.json();
        set({
          currentDirectory: data.folder || folderName,
          filesInCurrentDir: data.files || [],
        });
      }
    } catch (e) {
      console.warn('Browse directory error:', e);
    }
  },

  searchFiles: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [], isSearching: false });
      return;
    }
    set({ isSearching: true });
    try {
      const res = await fetch(`/api/system/files/search?query=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        set({ searchResults: data.results || [], isSearching: false });
      }
    } catch (e) {
      set({ isSearching: false });
    }
  },

  takeScreenshot: async () => {
    try {
      const res = await fetch('/api/system/control/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'screenshot_take',
          target: 'desktop_screen',
          payload: {},
        }),
      });
      const data = await res.json();
      if (data.screenshot) {
        set((state) => ({
          recentScreenshots: [data.screenshot, ...state.recentScreenshots],
        }));
        return data.screenshot;
      }
    } catch (e) {
      console.error('Screenshot error:', e);
    }
    return null;
  },

  launchApp: async (appName: string) => {
    try {
      const res = await fetch('/api/system/control/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'app_launch',
          target: appName,
          payload: { appName },
        }),
      });
      const data = await res.json();
      set((state) => ({
        appsList: state.appsList.map((app) =>
          app.name.toLowerCase() === appName.toLowerCase() ? { ...app, isRunning: true } : app
        ),
      }));
      return data.success;
    } catch (e) {
      return false;
    }
  },

  closeApp: async (appName: string) => {
    try {
      const res = await fetch('/api/system/control/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'app_close',
          target: appName,
          payload: { appName },
        }),
      });
      const data = await res.json();
      set((state) => ({
        appsList: state.appsList.map((app) =>
          app.name.toLowerCase() === appName.toLowerCase() ? { ...app, isRunning: false } : app
        ),
      }));
      return data.success;
    } catch (e) {
      return false;
    }
  },

  openUrl: async (url: string) => {
    try {
      const res = await fetch('/api/system/control/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'browser_open_url',
          target: url,
          payload: { url },
        }),
      });
      const data = await res.json();
      return data.success;
    } catch (e) {
      return false;
    }
  },

  sendWhatsAppDirect: async (contact: string, message: string) => {
    try {
      const res = await fetch('/api/system/control/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'whatsapp_draft_send',
          target: contact,
          payload: { contactName: contact, messageText: message },
        }),
      });
      const data = await res.json();
      return data.success;
    } catch (e) {
      return false;
    }
  },
}));
