/**
 * Figma Integration Types
 * TypeScript interfaces for Figma API responses and database records
 */

// ============================================================================
// Figma API Response Types
// ============================================================================

export interface FigmaApiFile {
  key: string;
  name: string;
  thumbnail_url?: string;
  last_modified: string;
  version: string;
}

export interface FigmaApiNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaApiNode[];
}

export interface FigmaApiFileResponse {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  document: FigmaApiNode;
}

// ============================================================================
// Database Record Types
// ============================================================================

export interface FigmaFile {
  row_id: string;
  prompt_row_id: string | null;
  file_key: string;
  file_name: string | null;
  thumbnail_url: string | null;
  last_modified: string | null;
  version: string | null;
  sync_status: string;
  last_synced_at: string | null;
  position: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
}

// ============================================================================
// Edge Function Request/Response Types
// ============================================================================

export type FigmaManagerAction = 
  | 'test-connection'
  | 'list-files'
  | 'get-file'
  | 'get-nodes'
  | 'attach-file'
  | 'detach-file'
  | 'sync-file'
  | 'list-attached'
  | 'add-comment';

export interface FigmaManagerRequest {
  action: FigmaManagerAction;
  fileKey?: string;
  promptRowId?: string;
  rowId?: string;
  nodeIds?: string[];
  comment?: string;
}

export interface FigmaManagerResponse {
  success?: boolean;
  error?: string;
  files?: FigmaFile[];
  file?: FigmaFile;
  nodes?: FigmaNode[];
  connected?: boolean;
}

// ============================================================================
// Hook Return Types
// ============================================================================

export interface UseFigmaFilesReturn {
  files: FigmaFile[];
  isLoading: boolean;
  isSyncing: boolean;
  connectionStatus: 'unknown' | 'connected' | 'disconnected' | 'error';
  error: string | null;
  testConnection: () => Promise<boolean>;
  fetchAttachedFiles: (promptRowId: string) => Promise<void>;
  attachFile: (fileKey: string, promptRowId: string) => Promise<boolean>;
  detachFile: (rowId: string) => Promise<boolean>;
  syncFile: (rowId: string) => Promise<boolean>;
}
