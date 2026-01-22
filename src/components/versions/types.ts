// Version control type definitions

export interface VersionInfo {
  row_id: string;
  version_number: number;
  commit_message?: string | null;
  tag_name?: string | null;
  created_at: string;
  is_pinned?: boolean;
  fields_changed?: string[];
}

export interface VersionMetadata {
  version_number: number;
  created_at: string;
  tag_name?: string | null;
}

export interface PromptSnapshot {
  prompt_name?: string;
  input_admin_prompt?: string;
  input_user_prompt?: string;
  note?: string;
  model?: string;
  temperature?: string | number;
  node_type?: string;
  post_action?: string;
  [key: string]: unknown;
}

export interface TextDiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
}

export interface DeepDiffChange {
  path: string;
  type: 'added' | 'removed' | 'modified';
  oldValue?: unknown;
  newValue?: unknown;
}

export interface DiffChange {
  field: string;
  type: 'added' | 'removed' | 'modified';
  textDiff?: TextDiffLine[];
  deepDiff?: DeepDiffChange[];
  oldValue?: unknown;
  newValue?: unknown;
}

export interface PreviewData {
  snapshot: PromptSnapshot;
  metadata: VersionMetadata;
}
