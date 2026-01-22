// Types for content components

import type { Database } from '@/integrations/supabase/types';
import type { LucideIcon } from 'lucide-react';

// Database row types
export type PromptRow = Database['public']['Tables']['q_prompts']['Row'];
export type ModelRow = Database['public']['Tables']['q_models']['Row'];
export type AssistantRow = Database['public']['Tables']['q_assistants']['Row'];

// ========================
// Dashboard Types
// ========================

export interface ActiveCall {
  id: string;
  model: string;
  promptName?: string;
  startedAt?: string;
  firstTokenAt?: number;
  lastTokenAt?: number;
  tokenCount?: number;
  estimatedInputTokens?: number;
  outputTokens?: number;
  contextWindow?: number;
  thinkingSummary?: string;
  resolvedSettings?: ResolvedSettings;
  resolvedTools?: ResolvedTools;
}

export interface ResolvedSettings {
  temperature?: number;
  max_output_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  reasoning_effort?: string;
  tool_choice?: string;
  seed?: number;
  response_format?: string;
}

export interface ResolvedTools {
  web_search?: boolean;
  confluence?: boolean;
  code_interpreter?: boolean;
  file_search?: boolean;
}

export interface CumulativeStats {
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
}

export interface MetricRowProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  sublabel?: string;
}

export interface SettingRowProps {
  label: string;
  value: string | number;
}

export interface ToolBadgeProps {
  enabled?: boolean;
  icon: LucideIcon;
  label: string;
}

// ========================
// Deleted Items Types
// ========================

export interface DeletedItem {
  row_id: string;
  updated_at?: string | null;
  prompt_name?: string | null;
  template_name?: string | null;
  schema_name?: string | null;
  parent_row_id?: string | null;
  category?: string | null;
  export_type?: string | null;
  _type?: ItemType;
}

export type ItemType = 'prompts' | 'templates' | 'jsonSchemas' | 'exportTemplates';

export interface ItemTypeConfig {
  key: ItemType | 'all';
  label: string;
  icon: LucideIcon;
}

export interface DeletedItemCounts {
  prompts: number;
  templates: number;
  jsonSchemas: number;
  exportTemplates: number;
  total: number;
}

export interface DeletedItemsState {
  prompts: DeletedItem[];
  templates: DeletedItem[];
  jsonSchemas: DeletedItem[];
  exportTemplates: DeletedItem[];
}

export interface DeleteDialogState {
  open: boolean;
  type: ItemType | null;
  rowId: string | null;
  name: string;
}

export interface EmptyTrashDialogState {
  open: boolean;
  type: ItemType | null;
}

export interface DeletedItemRowProps {
  item: DeletedItem;
  type: ItemType;
  onRestore: (type: ItemType, rowId: string) => void;
  onDelete: (type: ItemType, rowId: string, name: string) => void;
}

export interface EmptyStateProps {
  filter: ItemType | 'all';
}

// ========================
// Health Content Types
// ========================

export interface ResourceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'error' | 'unknown';
  message?: string;
  lastChecked?: string;
  responseTime?: number;
  details?: Record<string, unknown>;
}

export interface HealthCheckResult {
  overall: 'healthy' | 'degraded' | 'error' | 'unknown';
  resources: ResourceStatus[];
  timestamp: string;
}

export interface ResourceCardProps {
  resource: ResourceStatus;
  isRefreshing?: boolean;
}

// ========================
// Variables Tab Types
// ========================

export interface StaticVariable {
  name: string;
  description: string;
  category: string;
}

export interface StaticVariableGroup {
  category: string;
  icon: LucideIcon;
  variables: StaticVariable[];
}

export interface EditablePolicyVariable {
  name: string;
  description: string;
  defaultValue: string;
}

export interface AIResponseVariable {
  name: string;
  description: string;
}

export interface UserVariable {
  row_id: string;
  variable_name: string | null;
  variable_value: string | null;
  variable_description?: string | null;
  default_value?: string | null;
}

export interface HierarchyVariable {
  name: string;
  value: string;
  source: 'parent' | 'child' | 'sibling';
  promptName: string;
}

export interface VariablesTabContentProps {
  promptRowId: string;
  parentRowId?: string | null;
  selectedItemData?: Partial<PromptRow> | null;
  onVariableChange?: () => void;
}

// ========================
// Settings Content Types
// ========================

export interface SettingsSectionProps {
  settings?: Record<string, unknown>;
  onSettingChange?: (key: string, value: unknown) => void;
}

export interface SettingsContentProps {
  activeSubItem: string;
  settings?: Record<string, unknown>;
  onSettingChange?: (key: string, value: unknown) => void;
}

export interface SettingsSectionConfig {
  component: React.ComponentType<SettingsSectionProps>;
  icon: LucideIcon;
  title: string;
}

// ========================
// Templates Content Types
// ========================

export interface TemplateData {
  row_id: string;
  schema_name: string;
  schema_description?: string | null;
  json_schema?: unknown;
  system_prompt_template?: string | null;
  model_config?: unknown;
  node_config?: unknown;
  action_config?: unknown;
  child_creation?: unknown;
  sample_output?: unknown;
  category?: string | null;
  is_private?: boolean | null;
}

export interface SourceOption {
  value: string;
  label: string;
  icon: LucideIcon;
}

export interface VariableDefinition {
  name: string;
  description: string;
  type: string;
}

export interface TemplatesContentProps {
  activeSubItem?: string;
  selectedTemplate?: TemplateData | null;
  onTemplateSelect?: (template: TemplateData) => void;
}

// ========================
// Prompts Content Types
// ========================

export interface PromptsContentProps {
  selectedItemId?: string | null;
  selectedItemData?: Partial<PromptRow> | null;
  onUpdateField?: (field: string, value: unknown) => void;
  onRunPrompt?: (promptId: string) => void;
  treeData?: unknown[];
  allPrompts?: Partial<PromptRow>[];
}

export interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  badge?: number;
}

export interface HighlightedTextProps {
  text: string;
  variableDefinitions?: Record<string, VariableDefinition>;
}

export interface LibraryPickerDropdownProps {
  onSelect: (content: string) => void;
  position?: 'top' | 'bottom';
}
