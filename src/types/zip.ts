export interface ZipFileItem {
  path: string;
  name: string;
  content: string;
  size: number;
  isModified?: boolean;
  isNew?: boolean;
  originalContent?: string;
}

export interface FolderNode {
  name: string;
  path: string;
  isFolder: true;
  children: (FolderNode | FileNode)[];
}

export interface FileNode {
  name: string;
  path: string;
  isFolder: false;
  size: number;
  isModified?: boolean;
}

export type FileTreeNode = FolderNode | FileNode;

export interface DeviceAction {
  type: string;
  action: string;
  seconds?: number;
  time?: string;
  app?: string;
  section?: string;
  query?: string;
  due?: string;
  label?: string;
  requires_confirmation?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  timestamp: string;
  actions?: DeviceAction[];
  isStreaming?: boolean;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
}

export interface EmailMessage {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
  status?: 'inbox' | 'draft' | 'sent';
}
