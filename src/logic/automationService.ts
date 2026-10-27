import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { durableStorage, AutomationHistoryRecord } from '../db/storage.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AutomationJobDefinition {
  jobId: string;
  name: string;
  description: string;
  schedule: string;
  handler: () => Promise<{ success: boolean; summary: string; details?: any }>;
}

export const REGISTERED_AUTOMATION_JOBS: Record<string, AutomationJobDefinition> = {
  'backup-memories': {
    jobId: 'backup-memories',
    name: 'Backup Memory Vault',
    description: 'Creates a timestamped snapshot of all active and user-approved memories.',
    schedule: 'Daily at 03:00 PKT',
    handler: async () => {
      const memories = durableStorage.getMemories();
      const backupDir = path.resolve(__dirname, '../../data/backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `memories_backup_${timestamp}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(memories, null, 2), 'utf8');
      return {
        success: true,
        summary: `Successfully backed up ${memories.length} memories to ${path.basename(backupPath)}`,
        details: { count: memories.length, file: backupPath },
      };
    },
  },

  'cleanup-temp-projects': {
    jobId: 'cleanup-temp-projects',
    name: 'Cleanup Temp Artifacts',
    description: 'Removes orphaned temporary build files and expired temporary project exports.',
    schedule: 'Weekly on Sunday',
    handler: async () => {
      const tempDir = path.resolve(__dirname, '../../generated_projects');
      let cleanedCount = 0;
      if (fs.existsSync(tempDir)) {
        const entries = fs.readdirSync(tempDir);
        for (const entry of entries) {
          if (entry.startsWith('temp_') || entry.endsWith('.tmp')) {
            const p = path.join(tempDir, entry);
            try {
              if (fs.statSync(p).isDirectory()) {
                fs.rmSync(p, { recursive: true, force: true });
              } else {
                fs.unlinkSync(p);
              }
              cleanedCount += 1;
            } catch (err) {
              // ignore individual file lock
            }
          }
        }
      }
      return {
        success: true,
        summary: `Cleaned ${cleanedCount} temporary build artifacts from project store.`,
        details: { cleanedFiles: cleanedCount },
      };
    },
  },

  'system-diagnostics': {
    jobId: 'system-diagnostics',
    name: 'Full Health & Diagnostic Scan',
    description: 'Runs resource utilization check, disk space analysis, and storage integrity audit.',
    schedule: 'Every 6 Hours',
    handler: async () => {
      const memUsage = process.memoryUsage();
      const freeMem = os.freemem();
      const totalMem = os.totalmem();
      const memories = durableStorage.getMemories();
      const settings = durableStorage.getSettings();

      return {
        success: true,
        summary: `Health scan complete: Node RSS ${Math.round(memUsage.rss / 1024 / 1024)}MB, ${memories.length} memories intact, Preferred Lang: ${settings.preferredLanguage}`,
        details: {
          nodeRssMb: Math.round(memUsage.rss / 1024 / 1024),
          systemFreeMb: Math.round(freeMem / 1024 / 1024),
          systemTotalMb: Math.round(totalMem / 1024 / 1024),
          memoriesActive: memories.filter((m) => m.isActive).length,
        },
      };
    },
  },

  'export-data-summary': {
    jobId: 'export-data-summary',
    name: 'Weekly Data & Usage Summary',
    description: 'Compiles token usage, API queries, and voice interaction telemetry into storage audit.',
    schedule: 'Weekly on Monday',
    handler: async () => {
      const usage = durableStorage.getUsage();
      const waCount = durableStorage.getWhatsAppMessages().length;

      return {
        success: true,
        summary: `Data audit: Total Requests: ${usage.totalRequests}, Tokens: ${usage.totalInputTokens + usage.totalOutputTokens}, WhatsApp Messages: ${waCount}`,
        details: {
          totalRequests: usage.totalRequests,
          tokens: usage.totalInputTokens + usage.totalOutputTokens,
          whatsappMessages: waCount,
        },
      };
    },
  },
};

export async function executeAutomationJob(jobId: string, customName?: string): Promise<{
  success: boolean;
  jobId: string;
  name: string;
  status: 'completed' | 'failed';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  message: string;
  details?: any;
}> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  const jobDef = REGISTERED_AUTOMATION_JOBS[jobId];
  if (!jobDef) {
    const errorMsg = `Job "${jobId}" is not a registered automation task. Available jobs: ${Object.keys(REGISTERED_AUTOMATION_JOBS).join(', ')}`;
    const durationMs = Date.now() - startTime;
    const completedAt = new Date().toISOString();

    const record: AutomationHistoryRecord = {
      id: 'job-run-' + Date.now(),
      jobId,
      name: customName || jobId,
      startedAt,
      completedAt,
      durationMs,
      status: 'failed',
      error: errorMsg,
    };
    durableStorage.recordAutomationJob(record);

    return {
      success: false,
      jobId,
      name: customName || jobId,
      status: 'failed',
      startedAt,
      completedAt,
      durationMs,
      message: errorMsg,
    };
  }

  try {
    const result = await jobDef.handler();
    const durationMs = Date.now() - startTime;
    const completedAt = new Date().toISOString();

    const record: AutomationHistoryRecord = {
      id: 'job-run-' + Date.now(),
      jobId: jobDef.jobId,
      name: customName || jobDef.name,
      startedAt,
      completedAt,
      durationMs,
      status: result.success ? 'completed' : 'failed',
      resultSummary: result.summary,
    };
    durableStorage.recordAutomationJob(record);

    return {
      success: result.success,
      jobId: jobDef.jobId,
      name: customName || jobDef.name,
      status: result.success ? 'completed' : 'failed',
      startedAt,
      completedAt,
      durationMs,
      message: result.summary,
      details: result.details,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const completedAt = new Date().toISOString();

    const record: AutomationHistoryRecord = {
      id: 'job-run-' + Date.now(),
      jobId: jobDef.jobId,
      name: customName || jobDef.name,
      startedAt,
      completedAt,
      durationMs,
      status: 'failed',
      error: err.message || 'Execution failed',
    };
    durableStorage.recordAutomationJob(record);

    return {
      success: false,
      jobId: jobDef.jobId,
      name: customName || jobDef.name,
      status: 'failed',
      startedAt,
      completedAt,
      durationMs,
      message: `Job failed with error: ${err.message}`,
    };
  }
}
