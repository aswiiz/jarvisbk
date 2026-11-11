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
  category?: string;
  recipient?: string;
  filter?: string;
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

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface EmailMessage {
  id: string;
  threadId?: string;
  sender: string;
  recipient: string;
  cc?: string;
  subject: string;
  snippet: string;
  body?: string;
  body_plain: string;
  body_html: string;
  date: string;
  is_unread: boolean;
  is_starred: boolean;
  labels: string[];
  attachments: EmailAttachment[];
  status?: 'inbox' | 'draft' | 'sent';
}

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  is_verified: boolean;
  is_google_connected: boolean;
  google_email?: string;
}
