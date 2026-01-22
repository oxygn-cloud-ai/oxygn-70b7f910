/**
 * Prompt Queries Service
 * Database query operations for prompts
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PromptData } from '@/types';
import { handleSupabaseError } from './errorHandling';

/**
 * Fetch child prompts for a given parent
 * @param supabase - Supabase client instance
 * @param parentId - Parent prompt row ID
 * @returns Array of child prompts ordered by position
 */
export const fetchPrompts = async (
  supabase: SupabaseClient,
  parentId: string | null
): Promise<PromptData[]> => {
  try {
    const query = supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select('*')
      .eq('is_deleted', false)
      .order('position_lex');

    // Handle null parent (top-level prompts)
    if (parentId === null) {
      query.is('parent_row_id', null);
    } else {
      query.eq('parent_row_id', parentId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []) as PromptData[];
  } catch (error) {
    handleSupabaseError(error as Error, 'fetching prompts', { 
      showToast: true, 
      rethrow: false 
    });
    return [];
  }
};

/**
 * Fetch a single prompt by ID
 * @param supabase - Supabase client instance
 * @param promptId - Prompt row ID
 * @returns Prompt data or null if not found
 */
export const fetchPromptById = async (
  supabase: SupabaseClient,
  promptId: string
): Promise<PromptData | null> => {
  try {
    const { data, error } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select('*')
      .eq('row_id', promptId)
      .single();

    if (error) throw error;
    return data as PromptData;
  } catch (error) {
    handleSupabaseError(error as Error, 'fetching prompt', { 
      showToast: true, 
      rethrow: false 
    });
    return null;
  }
};

/**
 * Fetch prompts with owner profile information
 * @param supabase - Supabase client instance
 * @param parentId - Parent prompt row ID (null for top-level)
 * @returns Array of prompts with owner info
 */
export const fetchPromptsWithOwner = async (
  supabase: SupabaseClient,
  parentId: string | null
): Promise<PromptData[]> => {
  try {
    const query = supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select(`
        *,
        owner:profiles!owner_id (
          display_name,
          email,
          avatar_url
        )
      `)
      .eq('is_deleted', false)
      .order('position_lex');

    if (parentId === null) {
      query.is('parent_row_id', null);
    } else {
      query.eq('parent_row_id', parentId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Transform owner data to flat structure
    return (data || []).map((prompt: Record<string, unknown>) => {
      const owner = prompt.owner as Record<string, string> | null;
      return {
        ...prompt,
        owner_display_name: owner?.display_name || null,
        owner_email: owner?.email || null,
        owner_avatar_url: owner?.avatar_url || null,
      };
    }) as PromptData[];
  } catch (error) {
    handleSupabaseError(error as Error, 'fetching prompts with owner', { 
      showToast: true, 
      rethrow: false 
    });
    return [];
  }
};

/**
 * Count child prompts for a parent
 * @param supabase - Supabase client instance
 * @param parentId - Parent prompt row ID
 * @returns Number of child prompts
 */
export const countChildPrompts = async (
  supabase: SupabaseClient,
  parentId: string
): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select('*', { count: 'exact', head: true })
      .eq('parent_row_id', parentId)
      .eq('is_deleted', false);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    handleSupabaseError(error as Error, 'counting child prompts', { 
      showToast: true, 
      rethrow: false 
    });
    return 0;
  }
};
