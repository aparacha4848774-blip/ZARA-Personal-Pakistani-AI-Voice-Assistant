import { EmotionType } from '../logic/emotionRules.ts';

export type ZaraState =
  | 'INITIALIZING'
  | 'STANDBY'
  | 'LISTENING'
  | 'WAKE_WORD_DETECTED'
  | 'PROCESSING'
  | 'SPEAKING'
  | 'INTERRUPTED'
  | 'RECONNECTING'
  | 'MUTED'
  | 'ERROR';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

export type ArtifactType =
  | 'code_sandbox'
  | 'research_report'
  | 'svg_logo'
  | 'slide_deck'
  | 'video_script'
  | 'automation_job'
  | 'file_organization'
  | 'terminal_output';

export interface CodeSandboxFile {
  name: string;
  language: string;
  content: string;
}

export interface CodeSandboxArtifact {
  title: string;
  description: string;
  files: CodeSandboxFile[];
  previewHtml: string;
  framework: string;
  runCommand: string;
}

export interface ResearchReportArtifact {
  topic: string;
  executiveSummary: string;
  metrics: { label: string; value: string; trend?: 'up' | 'down' | 'neutral' }[];
  keyFindings: string[];
  actionItems: string[];
  dataSources: string[];
}

export interface SvgLogoArtifact {
  companyName: string;
  style: string;
  svgCode: string;
  colorPalette: string[];
  rationale: string;
}

export interface SlideDeckArtifact {
  title: string;
  subtitle: string;
  slides: {
    number: number;
    title: string;
    bullets: string[];
    speakerNotes?: string;
    layout?: 'title' | 'split' | 'bullets' | 'quote';
  }[];
}

export interface VideoScriptArtifact {
  title: string;
  targetPlatform: 'YouTube' | 'TikTok' | 'Reels';
  durationEst: string;
  hook: string;
  scenes: {
    time: string;
    visual: string;
    audioUrdu: string;
    notes?: string;
  }[];
  callToAction: string;
}

export interface AutomationJobArtifact {
  jobId: string;
  name: string;
  schedule: string;
  status: 'active' | 'paused' | 'executing' | 'completed';
  nextRun: string;
  lastRun?: string;
  actionSummary: string;
}

export interface FileOrganizationArtifact {
  targetFolder: string;
  totalFiles: number;
  categories: {
    name: string;
    count: number;
    extensions: string[];
    examples: string[];
  }[];
  actionExecuted: boolean;
}

export interface MessageArtifact {
  type: ArtifactType;
  title: string;
  data:
    | CodeSandboxArtifact
    | ResearchReportArtifact
    | SvgLogoArtifact
    | SlideDeckArtifact
    | VideoScriptArtifact
    | AutomationJobArtifact
    | FileOrganizationArtifact
    | any;
}

export interface MessageAttachment {
  id: string;
  name: string;
  type: 'image' | 'document' | 'audio';
  dataUrl?: string;
  sizeBytes?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'zara';
  content: string;
  urduScript?: string;
  language: 'roman_urdu' | 'urdu' | 'english';
  emotion?: EmotionType;
  emotionIntensity?: number;
  confidenceLevel?: ConfidenceLevel;
  modelUsed?: string;
  tokenCount?: number;
  audioUrl?: string;
  isThinking?: boolean;
  thoughts?: string;
  artifact?: MessageArtifact;
  attachments?: MessageAttachment[];
  createdAt: string;
}

export interface ConversationSession {
  id: string;
  startedAt: string;
  endedAt?: string;
  messageCount: number;
  dominantEmotion?: EmotionType;
  summary?: string;
}

export interface MemoryEntry {
  id: string;
  category: 'preference' | 'fact' | 'instruction' | 'contact' | 'task';
  key: string;
  value: string;
  importance: 'high' | 'medium' | 'low';
  userApproved: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface WhatsAppMessage {
  id: string;
  contactName: string;
  contactIdentifier?: string;
  messageText: string;
  status: 'pending' | 'confirmed' | 'sent' | 'simulated' | 'cancelled';
  userConfirmed: boolean;
  isSensitive: boolean;
  sentAt?: string;
  createdAt: string;
}

export interface GeminiModelConfig {
  modelId: string;
  displayName: string;
  capabilities: string[];
  isPrimary: boolean;
  isFallback: boolean;
  taskType: 'chat' | 'voice' | 'multimodal' | 'thinking';
  isEnabled: boolean;
  lastTestedAt?: string;
  lastTestStatus?: 'success' | 'failed' | 'timeout' | 'quota';
  latencyMs?: number;
}

export interface ZaraSettings {
  ownerName: string;
  preferredLanguage: 'roman_urdu' | 'urdu' | 'english';
  voiceSpeed: number;
  voiceVolume: number;
  wakeWordsEnabled: boolean;
  continuousConversation: boolean;
  sleepModeActive: boolean;
  highThinkingMode: boolean;
  silenceTimeoutMs: number;
  selectedMicDevice: string;
  selectedSpeakerDevice: string;
}

export interface ApiUsageStats {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number;
  recentLogs: {
    id: string;
    modelId: string;
    taskType: string;
    tokens: number;
    latencyMs: number;
    status: 'success' | 'error';
    createdAt: string;
  }[];
}
