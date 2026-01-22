/**
 * Shared Helper Functions for Action Executors
 * 
 * Consolidates common utilities to prevent duplication across executors.
 */

import { getEnvOrThrow } from '@/utils/safeEnv';
import { TypedSupabaseClient, ModelDefaults, LibraryPrompt } from './types';

// Table references - validated at import time
const SETTINGS_TABLE = getEnvOrThrow('VITE_SETTINGS_TBL');
const MODEL_DEFAULTS_TABLE = getEnvOrThrow('VITE_MODEL_DEFAULTS_TBL');
const LIBRARY_TABLE = getEnvOrThrow('VITE_PROMPT_LIBRARY_TBL');

/**
 * Get nested value from object using dot notation path.
 * Supports array index access (e.g., "items.0.name").
 */
export const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
  if (!path) return obj;
  
  const keys = path.split('.');
  let value: unknown = obj;
  
  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    
    if (Array.isArray(value) && /^\d+$/.test(key)) {
      value = value[parseInt(key, 10)];
    } else if (typeof value === 'object') {
      value = (value as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  
  return value;
};

/**
 * Get default prompt settings from the database
 */
export const getDefaultSettings = async (
  supabase: TypedSupabaseClient
): Promise<Record<string, string>> => {
  const { data } = await supabase
    .from(SETTINGS_TABLE)
    .select('setting_key, setting_value')
    .in('setting_key', ['def_admin_prompt', 'default_user_prompt', 'default_model']);

  const settings: Record<string, string> = {};
  data?.forEach(row => {
    if (row.setting_key && row.setting_value) {
      settings[row.setting_key] = row.setting_value;
    }
  });
  return settings;
};

/**
 * Get model defaults for a specific model
 */
export const getModelDefaults = async (
  supabase: TypedSupabaseClient, 
  modelId: string | null | undefined
): Promise<ModelDefaults> => {
  if (!modelId) return { model_id: null } as ModelDefaults;

  const { data } = await supabase
    .from(MODEL_DEFAULTS_TABLE)
    .select('*')
    .eq('model_id', modelId)
    .maybeSingle();

  if (!data) {
    return { 
      model_id: modelId, 
      model: modelId, 
      model_on: true 
    } as ModelDefaults;
  }

  const defaults: Record<string, unknown> = { 
    model_id: modelId, 
    model: modelId, 
    model_on: true 
  };
  
  const fields = [
    'temperature', 'max_tokens', 'max_completion_tokens', 'top_p', 
    'frequency_penalty', 'presence_penalty', 'reasoning_effort', 
    'stop', 'n', 'stream', 'response_format', 'logit_bias', 
    'o_user', 'seed', 'tool_choice'
  ];

  fields.forEach(field => {
    const onKey = `${field}_on` as keyof typeof data;
    if (data[onKey]) {
      defaults[field] = data[field as keyof typeof data];
      defaults[`${field}_on`] = true;
    }
  });

  return defaults as ModelDefaults;
};

/**
 * Get library prompt content if specified
 */
export const getLibraryPrompt = async (
  supabase: TypedSupabaseClient, 
  libraryPromptId: string | null | undefined
): Promise<LibraryPrompt | null> => {
  if (!libraryPromptId) return null;

  const { data } = await supabase
    .from(LIBRARY_TABLE)
    .select('row_id, name, content, description, category')
    .eq('row_id', libraryPromptId)
    .maybeSingle();

  return data as LibraryPrompt | null;
};
