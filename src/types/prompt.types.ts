/**
 * Prompt Types
 * Core type definitions for prompts and related data structures
 */

import type { Database } from '@/integrations/supabase/types';

// Extract the base Row type from Supabase types
type PromptRowBase = Database['public']['Tables']['q_prompts']['Row'];

/**
 * Node types for prompts
 */
export type PromptNodeType = 'standard' | 'action' | 'question';

/**
 * Extended prompt data with computed fields
 */
export interface PromptData extends PromptRowBase {
  // Computed/joined fields
  assistant_row_id?: string;
  owner_display_name?: string;
  owner_email?: string;
  owner_avatar_url?: string;
  depth?: number;
}

/**
 * Tree node structure for hierarchical prompts
 */
export interface PromptTreeNode extends PromptData {
  children?: PromptTreeNode[];
  id?: string; // Legacy support
}

/**
 * Variable stored on a prompt
 */
export interface PromptVariable {
  row_id: string;
  name: string;
  value?: string;
  prompt_row_id: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * System variable stored in prompt's system_variables field
 */
export interface SystemVariables {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Action configuration for action nodes
 */
export interface ActionConfig {
  action_id?: string;
  json_path?: string | string[];
  auto_create_variables?: boolean;
  placement?: 'self' | 'parent' | 'topLevel';
  naming_template?: string;
  [key: string]: unknown;
}

/**
 * Model settings for a prompt
 */
export interface ModelSettings {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

/**
 * Options for creating a new prompt
 */
export interface CreatePromptOptions {
  parentId?: string | null;
  position?: 'first' | 'last' | 'after';
  afterId?: string;
  templateId?: string;
  name?: string;
  inheritSettings?: boolean;
}

/**
 * Options for duplicating a prompt
 */
export interface DuplicatePromptOptions {
  includeChildren?: boolean;
  newParentId?: string;
  nameSuffix?: string;
}

/**
 * Result of a prompt run
 */
export interface PromptRunResult {
  success: boolean;
  response?: string;
  usage?: TokenUsage;
  error?: string;
  error_code?: string;
  latency_ms?: number;
}

/**
 * Token usage from AI response
 */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
}

/**
 * Prompt field names that can be updated
 */
export type PromptFieldName = keyof PromptRowBase;

/**
 * Prompt selection state
 */
export interface PromptSelectionState {
  selectedPromptId: string | null;
  selectedPromptData: PromptData | null;
  isLoadingPrompt: boolean;
}

/**
 * Tree operation types
 */
export type TreeOperation = 'add' | 'delete' | 'move' | 'duplicate' | 'update';

/**
 * Callback for tree refresh
 */
export type TreeRefreshCallback = () => Promise<void>;
