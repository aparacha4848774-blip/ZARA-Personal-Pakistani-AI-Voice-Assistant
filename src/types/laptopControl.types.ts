export type LaptopActionType =
  | 'file_open'
  | 'folder_open'
  | 'file_browse'
  | 'file_search'
  | 'file_delete'
  | 'file_rename'
  | 'browser_open_url'
  | 'browser_search'
  | 'browser_tab_open'
  | 'browser_tab_close'
  | 'browser_bookmark'
  | 'app_launch'
  | 'app_close'
  | 'volume_set'
  | 'volume_change'
  | 'screenshot_take'
  | 'whatsapp_launch'
  | 'whatsapp_chat_open'
  | 'whatsapp_draft_send';

export type ActionConfirmationStatus =
  | 'pending'
  | 'first_confirmed'
  | 'double_confirmed'
  | 'executing'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface LaptopAction {
  id: string;
  type: LaptopActionType;
  title: string;
  target: string;
  payload: Record<string, any>;
  descriptionRomanUrdu: string;
  requiresDoubleConfirm: boolean;
  confirmPrompt: string;
  status: ActionConfirmationStatus;
  result?: any;
  createdAt: string;
  executedAt?: string;
  error?: string;
}

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  sizeBytes?: number;
  extension?: string;
  modifiedAt?: string;
}

export interface SystemAppInfo {
  id: string;
  name: string;
  command: string;
  category: 'utility' | 'browser' | 'development' | 'communication' | 'media';
  icon: string;
  isRunning?: boolean;
}

export interface ScreenshotRecord {
  id: string;
  timestamp: string;
  dataUrl: string;
  title: string;
  dimensions?: { width: number; height: number };
}
