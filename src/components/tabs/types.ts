// Types for the tabs components

import type { Database } from '@/integrations/supabase/types';

// Database row types
export type ConversationRow = Database['public']['Tables']['q_assistants']['Row'];
export type ConversationFile = Database['public']['Tables']['q_assistant_files']['Row'];
export type PromptRow = Database['public']['Tables']['q_prompts']['Row'];

// Tool defaults from q_assistant_tool_defaults
export interface ToolDefaults {
  code_interpreter_enabled?: boolean | null;
  file_search_enabled?: boolean | null;
  function_calling_enabled?: boolean | null;
}

// Model data from hooks
export interface ModelData {
  row_id: string;
  model_id: string | null;
  model_name: string | null;
  provider?: string | null;
  context_window?: number | null;
  max_output_tokens?: number | null;
  supports_temperature?: boolean | null;
  supports_reasoning_effort?: boolean | null;
  supported_settings?: string[] | null;
  supported_tools?: string[] | null;
}

// Settings from useSettings hook
export interface AppSettings {
  default_model?: { value: string };
  def_assistant_instructions?: string;
  [key: string]: unknown;
}

// ConversationTab props
export interface ConversationTabProps {
  promptRowId: string;
  selectedItemData?: Partial<PromptRow> | null;
}

// SettingRow component props
export interface SettingRowProps {
  field: string;
  value: string;
  setValue: (value: string) => void;
  onSave: (value: string | null) => void;
  type?: 'input' | 'slider' | 'switch';
  min?: number;
  max?: number;
  step?: number;
}

// Setting info from model capabilities config
export interface SettingInfo {
  label: string;
  description?: string;
  details?: string;
  docUrl?: string;
}

// Slider debounce refs type
export type SliderDebounceRefs = Record<string, ReturnType<typeof setTimeout> | undefined>;

// Thread strategy options
export type ThreadStrategy = 'parent' | 'isolated';

// File upload event type
export interface FileUploadEvent extends React.ChangeEvent<HTMLInputElement> {
  target: HTMLInputElement & { files: FileList | null };
}
