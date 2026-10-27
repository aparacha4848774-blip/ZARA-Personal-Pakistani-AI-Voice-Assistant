import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MemoryRecord } from '../logic/memoryManager.ts';
import { WhatsAppMessage, ZaraSettings } from '../types/zara.types.ts';
import { DEFAULT_GEMINI_MODELS } from '../config/models.config.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AutomationHistoryRecord {
  id: string;
  jobId: string;
  name: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  status: 'running' | 'completed' | 'failed';
  resultSummary?: string;
  error?: string;
}

export interface UsageLogRecord {
  id: string;
  modelId: string;
  taskType: string;
  tokens: number;
  latencyMs: number;
  status: 'success' | 'failed' | 'fallback';
  createdAt: string;
}

export interface UsageData {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number;
  recentLogs: UsageLogRecord[];
}

export interface StorageSchema {
  version: number;
  lastUpdated: string;
  settings: ZaraSettings;
  memories: MemoryRecord[];
  whatsappMessages: WhatsAppMessage[];
  automationHistory: AutomationHistoryRecord[];
  usage: UsageData;
}

const DEFAULT_SETTINGS: ZaraSettings = {
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
};

const DEFAULT_MEMORIES: MemoryRecord[] = [
  {
    id: 'mem-1',
    category: 'preference',
    key: 'Owner Nickname',
    value: 'Boss',
    importance: 'high',
    userApproved: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mem-2',
    category: 'preference',
    key: 'Favorite Chai',
    value: 'Karak Elaichi (Cardamom) Chai',
    importance: 'medium',
    userApproved: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mem-3',
    category: 'instruction',
    key: 'Tone & Style',
    value: 'Pakistani dostana lehja, Roman Urdu, no robotic phrases',
    importance: 'high',
    userApproved: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_WHATSAPP: WhatsAppMessage[] = [
  {
    id: 'wa-1',
    contactName: 'Hamza',
    contactIdentifier: '+92 300 1234567',
    messageText: 'Main 5 minute mein aa raha hoon',
    status: 'simulated',
    userConfirmed: true,
    isSensitive: false,
    sentAt: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'wa-2',
    contactName: 'Ali Dev',
    contactIdentifier: '+92 321 9876543',
    messageText: 'Project ready hai, check kar lo',
    status: 'simulated',
    userConfirmed: true,
    isSensitive: false,
    sentAt: new Date(Date.now() - 7200000).toISOString(),
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

export class DurableStorageService {
  private dataDir: string;
  private filePath: string;
  private cache: StorageSchema;
  private saveTimeout: NodeJS.Timeout | null = null;

  private backupFilePath: string;

  constructor(customDir?: string) {
    this.dataDir = customDir || path.resolve(__dirname, '../../data');
    this.filePath = path.join(this.dataDir, 'zara_db.json');
    this.backupFilePath = `${this.filePath}.bak`;
    this.ensureDirectory();
    this.cache = this.loadInitialData();
  }

  private ensureDirectory() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    } catch (err) {
      console.error('[DurableStorage] Could not create data directory:', err);
    }
  }

  private normalizeSchema(parsed: any): StorageSchema {
    return {
      version: parsed.version || 1,
      lastUpdated: parsed.lastUpdated || new Date().toISOString(),
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      memories: Array.isArray(parsed.memories) && parsed.memories.length > 0 ? parsed.memories : [...DEFAULT_MEMORIES],
      whatsappMessages: Array.isArray(parsed.whatsappMessages) ? parsed.whatsappMessages : [...DEFAULT_WHATSAPP],
      automationHistory: Array.isArray(parsed.automationHistory) ? parsed.automationHistory : [],
      usage: {
        totalRequests: parsed.usage?.totalRequests || 0,
        totalInputTokens: parsed.usage?.totalInputTokens || 0,
        totalOutputTokens: parsed.usage?.totalOutputTokens || 0,
        estimatedCostUsd: parsed.usage?.estimatedCostUsd || 0,
        recentLogs: Array.isArray(parsed.usage?.recentLogs) ? parsed.usage.recentLogs : [],
      },
    };
  }

  private loadInitialData(): StorageSchema {
    // 1. Attempt to load primary database file
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return this.normalizeSchema(parsed);
        }
      }
    } catch (err: any) {
      console.warn('[DurableStorage] Primary database file corrupt or unreadable:', err.message);

      // 2. Attempt automatic restoration from .bak backup file
      try {
        if (fs.existsSync(this.backupFilePath)) {
          const bakRaw = fs.readFileSync(this.backupFilePath, 'utf8');
          const bakParsed = JSON.parse(bakRaw);
          if (bakParsed && typeof bakParsed === 'object') {
            console.info('[DurableStorage] Successfully recovered database from backup file:', this.backupFilePath);
            const recovered = this.normalizeSchema(bakParsed);
            this.saveSync(recovered);
            return recovered;
          }
        }
      } catch (bakErr: any) {
        console.warn('[DurableStorage] Backup restoration failed:', bakErr.message);
      }

      // 3. Preserve corrupt file for forensic recovery rather than destroying it
      try {
        const corruptPreservePath = `${this.filePath}.corrupt.${Date.now()}`;
        if (fs.existsSync(this.filePath)) {
          fs.renameSync(this.filePath, corruptPreservePath);
          console.warn('[DurableStorage] Corrupted file preserved at:', corruptPreservePath);
        }
      } catch (preserveErr) {
        // ignore
      }
    }

    const initial: StorageSchema = {
      version: 1,
      lastUpdated: new Date().toISOString(),
      settings: { ...DEFAULT_SETTINGS },
      memories: [...DEFAULT_MEMORIES],
      whatsappMessages: [...DEFAULT_WHATSAPP],
      automationHistory: [],
      usage: {
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        estimatedCostUsd: 0,
        recentLogs: [],
      },
    };

    this.saveSync(initial);
    if (typeof process !== 'undefined' && process.on) {
      process.on('beforeExit', () => this.flushSync());
    }
    return initial;
  }

  /**
   * Safe atomic write using temporary file + rename to prevent data corruption.
   * Collision-safe unique temporary filename + mirrors to .bak on success.
   */
  public saveSync(data?: StorageSchema) {
    const toSave = data || this.cache;
    toSave.lastUpdated = new Date().toISOString();
    this.ensureDirectory();
    const tempPath = `${this.filePath}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      fs.writeFileSync(tempPath, JSON.stringify(toSave, null, 2), 'utf8');
      fs.renameSync(tempPath, this.filePath);

      // Update known-good backup asynchronously/safely
      try {
        fs.copyFileSync(this.filePath, this.backupFilePath);
      } catch {
        // Non-fatal if backup copy fails
      }
    } catch (err) {
      console.error('[DurableStorage] Save error:', err);
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch (cleanErr) {
        // ignore
      }
    }
  }

  /**
   * Explicitly creates a timestamped or custom backup copy of the database.
   */
  public backup(customPath?: string): string {
    this.flushSync();
    const dest = customPath || path.join(this.dataDir, `zara_backup_${Date.now()}.json`);
    fs.copyFileSync(this.filePath, dest);
    return dest;
  }

  /**
   * Restores database state from a verified backup JSON file.
   */
  public restore(sourcePath: string): boolean {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Backup source file not found: ${sourcePath}`);
    }
    const raw = fs.readFileSync(sourcePath, 'utf8');
    const parsed = JSON.parse(raw);
    const normalized = this.normalizeSchema(parsed);
    this.cache = normalized;
    this.saveSync(normalized);
    return true;
  }

  public scheduleSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveSync();
      this.saveTimeout = null;
    }, 150);
  }

  /**
   * Immediately flushes any pending writes to disk synchronously.
   */
  public flushSync() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.saveSync();
  }

  // Settings
  public getSettings(): ZaraSettings {
    return { ...this.cache.settings };
  }

  public updateSetting<K extends keyof ZaraSettings>(key: K, value: ZaraSettings[K]): ZaraSettings {
    this.cache.settings[key] = value;
    this.scheduleSave();
    return { ...this.cache.settings };
  }

  // Memories
  public getMemories(): MemoryRecord[] {
    return [...this.cache.memories];
  }

  public addMemory(memory: Omit<MemoryRecord, 'id' | 'createdAt'>): MemoryRecord {
    const newEntry: MemoryRecord = {
      ...memory,
      id: 'mem-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      createdAt: new Date().toISOString(),
    };
    this.cache.memories.unshift(newEntry);
    this.scheduleSave();
    return newEntry;
  }

  public updateMemory(id: string, updates: Partial<MemoryRecord>): MemoryRecord | null {
    const idx = this.cache.memories.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    this.cache.memories[idx] = {
      ...this.cache.memories[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.scheduleSave();
    return { ...this.cache.memories[idx] };
  }

  public deleteMemory(id: string): boolean {
    const beforeLen = this.cache.memories.length;
    this.cache.memories = this.cache.memories.filter((m) => m.id !== id);
    const deleted = this.cache.memories.length < beforeLen;
    if (deleted) this.scheduleSave();
    return deleted;
  }

  // WhatsApp Messages
  public getWhatsAppMessages(): WhatsAppMessage[] {
    return [...this.cache.whatsappMessages];
  }

  public addWhatsAppMessage(msg: WhatsAppMessage): WhatsAppMessage {
    this.cache.whatsappMessages.unshift(msg);
    this.scheduleSave();
    return msg;
  }

  public updateWhatsAppMessage(id: string, updates: Partial<WhatsAppMessage>): WhatsAppMessage | null {
    const idx = this.cache.whatsappMessages.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    this.cache.whatsappMessages[idx] = {
      ...this.cache.whatsappMessages[idx],
      ...updates,
    };
    this.scheduleSave();
    return { ...this.cache.whatsappMessages[idx] };
  }

  // Automation History
  public getAutomationHistory(): AutomationHistoryRecord[] {
    return [...this.cache.automationHistory];
  }

  public recordAutomationJob(record: AutomationHistoryRecord): AutomationHistoryRecord {
    this.cache.automationHistory.unshift(record);
    if (this.cache.automationHistory.length > 50) {
      this.cache.automationHistory = this.cache.automationHistory.slice(0, 50);
    }
    this.scheduleSave();
    return record;
  }

  // Usage statistics
  public getUsage(): UsageData {
    return { ...this.cache.usage };
  }

  public recordUsage(modelId: string, taskType: string, inputTokens: number, outputTokens: number, latencyMs: number, status: 'success' | 'failed' | 'fallback') {
    const totalTokens = inputTokens + outputTokens;
    this.cache.usage.totalRequests += 1;
    this.cache.usage.totalInputTokens += inputTokens;
    this.cache.usage.totalOutputTokens += outputTokens;
    this.cache.usage.estimatedCostUsd += (inputTokens * 0.00000015) + (outputTokens * 0.0000006);
    this.cache.usage.recentLogs.unshift({
      id: 'log-' + Date.now(),
      modelId,
      taskType,
      tokens: totalTokens,
      latencyMs,
      status,
      createdAt: new Date().toISOString(),
    });
    if (this.cache.usage.recentLogs.length > 50) {
      this.cache.usage.recentLogs = this.cache.usage.recentLogs.slice(0, 50);
    }
    this.scheduleSave();
  }
}

export const durableStorage = new DurableStorageService();
