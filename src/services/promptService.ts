/**
 * Prompt Service
 * Core service for fetching and managing prompts with owner information
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PromptData, PromptTreeNode } from '@/types';
import { buildTree } from '../utils/positionUtils';

/**
 * Owner profile information
 */
interface OwnerInfo {
  display: string;
  avatar: string | null;
}

/**
 * Helper to create a conversation/assistant record for a prompt
 */
const createConversationRecord = async (
  supabase: SupabaseClient, 
  promptRowId: string, 
  promptName?: string
): Promise<string | null> => {
  try {
    const insertData = {
      prompt_row_id: promptRowId,
      name: promptName || 'Conversation',
      status: 'active',
      api_version: 'responses',
      use_global_tool_defaults: true,
    };
    
    const { data: conversation, error: createError } = await supabase
      .from(import.meta.env.VITE_ASSISTANTS_TBL)
      .insert([insertData])
      .select()
      .maybeSingle();

    if (createError) {
      console.error('Failed to create conversation record:', createError);
      return null;
    }

    console.log('Auto-created conversation record:', conversation?.row_id);
    return conversation?.row_id || null;
  } catch (error) {
    console.error('Error in createConversationRecord:', error);
    return null;
  }
};

/**
 * Fetch all prompts with owner information and build tree structure
 * 
 * @param supabase - Supabase client instance
 * @param currentUserId - Optional user ID for filtering (multi-tenant)
 * @returns Tree of prompts with owner information
 */
export const fetchPrompts = async (
  supabase: SupabaseClient, 
  currentUserId: string | null = null
): Promise<PromptTreeNode[]> => {
  try {
    if (!import.meta.env.VITE_PROMPTS_TBL) {
      throw new Error('VITE_PROMPTS_TBL environment variable is not set');
    }

    // Build query with owner_id filter for multi-tenant segregation
    // RLS also enforces this, but we filter client-side for clarity
    let query = supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select(`
        *,
        ${import.meta.env.VITE_ASSISTANTS_TBL}!${import.meta.env.VITE_ASSISTANTS_TBL}_prompt_row_id_fkey(row_id)
      `)
      .eq('is_deleted', false);
    
    // Filter by owner_id if provided (multi-tenant segregation)
    if (currentUserId) {
      query = query.eq('owner_id', currentUserId);
    }
    
    const { data, error } = await query.order('position_lex');

    if (error) throw error;

    // Collect unique owner IDs for all top-level prompts
    const ownerIds = [...new Set(
      (data || [])
        .filter((p: Record<string, unknown>) => !p.parent_row_id && p.owner_id)
        .map((p: Record<string, unknown>) => p.owner_id as string)
    )];

    // Fetch owner profiles from the profiles table
    const ownerProfiles = new Map<string, OwnerInfo>();
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase
        .from(import.meta.env.VITE_PROFILES_TBL || 'profiles')
        .select('id, email, display_name, avatar_url')
        .in('id', ownerIds);
      
      if (profiles) {
        profiles.forEach((profile: { id: string; email?: string; display_name?: string; avatar_url?: string }) => {
          ownerProfiles.set(profile.id, {
            display: profile.display_name || profile.email?.split('@')[0] || profile.id.substring(0, 8),
            avatar: profile.avatar_url || null
          });
        });
      }
    }

    // Find top-level prompts missing assistant records and create them
    const promptsNeedingAssistant = (data || []).filter((prompt: Record<string, unknown>) => {
      const assistantData = prompt[import.meta.env.VITE_ASSISTANTS_TBL];
      const hasAssistant = Array.isArray(assistantData) 
        ? assistantData.length > 0 
        : !!assistantData;
      // Top-level prompts (no parent) that are marked as assistant but have no record
      return !prompt.parent_row_id && prompt.is_assistant && !hasAssistant;
    });

    // Create missing assistant records in parallel
    const createdAssistants = new Map<string, string>();
    if (promptsNeedingAssistant.length > 0) {
      console.log(`Creating ${promptsNeedingAssistant.length} missing assistant records...`);
      const creationPromises = promptsNeedingAssistant.map(async (prompt: Record<string, unknown>) => {
        const newAssistantId = await createConversationRecord(
          supabase, 
          prompt.row_id as string, 
          prompt.prompt_name as string
        );
        if (newAssistantId) {
          createdAssistants.set(prompt.row_id as string, newAssistantId);
        }
      });
      await Promise.all(creationPromises);
    }

    // Add owner display info and extract assistant_row_id
    const promptsWithOwnerInfo = (data || []).map((prompt: Record<string, unknown>) => {
      // Extract assistant_row_id from the joined data or from newly created
      const assistantData = prompt[import.meta.env.VITE_ASSISTANTS_TBL] as 
        | Array<{ row_id?: string }> 
        | { row_id?: string } 
        | null;
      let assistant_row_id = Array.isArray(assistantData) 
        ? assistantData[0]?.row_id 
        : (assistantData as { row_id?: string } | null)?.row_id;
      
      // Use newly created assistant if we just made one
      if (!assistant_row_id && createdAssistants.has(prompt.row_id as string)) {
        assistant_row_id = createdAssistants.get(prompt.row_id as string);
      }
      
      // Remove the nested assistant object
      const { [import.meta.env.VITE_ASSISTANTS_TBL]: _, ...promptData } = prompt;
      
      if (!promptData.parent_row_id && promptData.owner_id) {
        const ownerInfo = ownerProfiles.get(promptData.owner_id as string) || { 
          display: (promptData.owner_id as string).substring(0, 8), 
          avatar: null 
        };
        return {
          ...promptData,
          assistant_row_id,
          showOwner: true,
          ownerDisplay: ownerInfo.display,
          ownerAvatar: ownerInfo.avatar
        };
      }
      return { ...promptData, assistant_row_id };
    });

    return buildTree(promptsWithOwnerInfo as PromptData[]);
  } catch (error) {
    console.error('Error fetching prompts:', error);
    throw error;
  }
};

/**
 * @deprecated Use addPrompt from promptMutations.ts instead.
 * This function is intentionally broken to prevent accidental use.
 * The legacy function was missing owner_id and position_lex which caused RLS failures.
 */
export const addPrompt = async (): Promise<never> => {
  throw new Error(
    'promptService.addPrompt is deprecated. Use addPrompt from promptMutations.ts instead. ' +
    'The legacy function was missing owner_id and position_lex which caused RLS failures.'
  );
};

/**
 * Simple soft-delete for a single prompt (legacy - use promptDeletion.ts for full cascade)
 * 
 * @param supabase - Supabase client instance
 * @param itemId - Prompt row ID to delete
 * @returns True if deletion succeeded
 */
export const deletePrompt = async (
  supabase: SupabaseClient, 
  itemId: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .update({ is_deleted: true })
      .eq('row_id', itemId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting prompt:', error);
    throw error;
  }
};
