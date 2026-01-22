// Types for admin components

export interface KnowledgeItem {
  row_id: string;
  topic: string;
  title: string;
  content: string;
  keywords?: string[];
  priority?: number;
  version?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

export interface KnowledgeFormData {
  topic: string;
  title: string;
  content: string;
  keywords: string[];
  priority: number;
}

export interface KnowledgeEditorProps {
  item: KnowledgeItem | null;
  topics: string[];
  onSave: (data: KnowledgeFormData) => Promise<void>;
  onCancel: () => void;
}

export interface KnowledgeItemProps {
  item: KnowledgeItem;
  onEdit: (item: KnowledgeItem) => void;
  onDelete: (item: KnowledgeItem) => void;
  onViewHistory: (item: KnowledgeItem) => void;
}

export interface KnowledgeExportData {
  _exportVersion: number;
  exported_at: string;
  topic_filter: string | null;
  item_count: number;
  items: Array<{
    topic: string;
    title: string;
    content: string;
    keywords: string[];
    priority: number;
  }>;
}

export interface KnowledgeImportItem {
  topic: string;
  title: string;
  content: string;
  keywords?: string[];
  priority?: number;
}

export interface ParseResult {
  valid: boolean;
  error?: string;
  items?: KnowledgeImportItem[];
  totalCount?: number;
  validCount?: number;
  errorCount?: number;
  errors?: string[];
  hasMoreErrors?: boolean;
}

export interface ImportResults {
  created: number;
  updated: number;
  errors?: string[];
}

export interface ExportKnowledgeDialogProps {
  items: KnowledgeItem[];
  selectedTopic: string | null;
  trigger: React.ReactNode;
}

export interface ImportKnowledgeDialogProps {
  topics: string[];
  onImport: (items: KnowledgeImportItem[]) => Promise<ImportResults>;
  trigger: React.ReactNode;
}

export interface TopicBadgeProps {
  topic: string;
}

export const VALID_TOPICS = [
  'overview', 'prompts', 'variables', 'templates', 'json_schemas',
  'actions', 'files', 'confluence', 'cascade', 'library',
  'troubleshooting', 'database', 'edge_functions', 'api'
] as const;

export type ValidTopic = typeof VALID_TOPICS[number];

export const TOPIC_COLORS: Record<string, string> = {
  overview: 'bg-blue-500/10 text-blue-600',
  prompts: 'bg-purple-500/10 text-purple-600',
  variables: 'bg-green-500/10 text-green-600',
  templates: 'bg-amber-500/10 text-amber-600',
  json_schemas: 'bg-pink-500/10 text-pink-600',
  actions: 'bg-red-500/10 text-red-600',
  files: 'bg-cyan-500/10 text-cyan-600',
  confluence: 'bg-indigo-500/10 text-indigo-600',
  cascade: 'bg-orange-500/10 text-orange-600',
  library: 'bg-teal-500/10 text-teal-600',
  troubleshooting: 'bg-rose-500/10 text-rose-600',
  database: 'bg-emerald-500/10 text-emerald-600',
  edge_functions: 'bg-sky-500/10 text-sky-600',
  api: 'bg-lime-500/10 text-lime-600'
};
