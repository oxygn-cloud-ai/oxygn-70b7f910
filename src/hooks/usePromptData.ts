import { useCallback } from 'react';
import { toast } from "@/components/ui/sonner";
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Prompt data row structure
 */
export interface PromptDataRow {
  row_id: string;
  prompt_name?: string | null;
  input_admin_prompt?: string | null;
  input_user_prompt?: string | null;
  admin_prompt_result?: string | null;
  user_prompt_result?: string | null;
  output_response?: string | null;
  parent_row_id?: string | null;
  assistant_row_id?: string | null;
  model?: string | null;
  model_on?: boolean | null;
  temperature?: number | null;
  temperature_on?: boolean | null;
  max_tokens?: number | null;
  max_tokens_on?: boolean | null;
  top_p?: number | null;
  top_p_on?: boolean | null;
  frequency_penalty?: number | null;
  frequency_penalty_on?: boolean | null;
  presence_penalty?: number | null;
  presence_penalty_on?: boolean | null;
  response_format?: string | null;
  response_format_on?: boolean | null;
  json_schema?: Record<string, unknown> | null;
  reasoning_effort?: string | null;
  reasoning_effort_on?: boolean | null;
  node_type?: string | null;
  post_action?: string | null;
  post_action_config?: Record<string, unknown> | null;
  is_assistant?: boolean | null;
  thread_mode?: string | null;
  child_thread_strategy?: string | null;
  starred?: boolean | null;
  is_deleted?: boolean | null;
  exclude_from_cascade?: boolean | null;
  exclude_from_export?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface UsePromptDataReturn {
  updateField: (rowId: string, fieldName: string, value: unknown) => Promise<boolean>;
  fetchItemData: (rowId: string) => Promise<PromptDataRow | null>;
}

/**
 * Prompt data helpers with memoized functions to prevent infinite re-renders.
 */
export const usePromptData = (supabase: SupabaseClient | null): UsePromptDataReturn => {
  const updateField = useCallback(async (rowId: string, fieldName: string, value: unknown): Promise<boolean> => {
    if (!supabase || !rowId) return false;

    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ [fieldName]: value })
        .eq("row_id", rowId);

      if (error) throw error;

      toast.success(`${fieldName} saved successfully`, {
        source: 'usePromptData.updateField',
        details: JSON.stringify({ rowId, fieldName, valueLength: String(value)?.length || 0 }, null, 2),
      } as Record<string, unknown>);
      return true;
    } catch (error) {
      const err = error as { message?: string; code?: string; stack?: string };
      console.error("Error updating field:", error);
      toast.error(`Failed to update ${fieldName}: ${err?.message || "Unknown error"}`, {
        source: 'usePromptData.updateField',
        errorCode: err?.code || 'UPDATE_ERROR',
        details: JSON.stringify({ rowId, fieldName, error: err?.message, stack: err?.stack }, null, 2),
      } as Record<string, unknown>);
      return false;
    }
  }, [supabase]);

  const fetchItemData = useCallback(async (rowId: string): Promise<PromptDataRow | null> => {
    if (!supabase || !rowId) return null;

    try {
      const assistantsTbl = import.meta.env.VITE_ASSISTANTS_TBL;
      // Fetch prompt data with related assistant record
      const { data, error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .select(`
          *,
          ${assistantsTbl}!${assistantsTbl}_prompt_row_id_fkey(row_id)
        `)
        .eq("row_id", rowId)
        .maybeSingle();

      // PGRST116 means no rows found - treat as normal
      if (error && error.code !== "PGRST116") throw error;
      
      if (data) {
        // Extract assistant_row_id from the joined data
        const assistantData = data[assistantsTbl] as { row_id?: string } | { row_id?: string }[] | undefined;
        let assistant_row_id = Array.isArray(assistantData) 
          ? assistantData[0]?.row_id 
          : assistantData?.row_id;
        
        // If this is a child prompt, resolve root prompt's assistant_row_id
        // All prompts in a family share the root's assistant for file storage
        if (data.parent_row_id) {
          let currentParentId = data.parent_row_id as string | null;
          
          while (currentParentId) {
            const { data: parentData } = await supabase
              .from(import.meta.env.VITE_PROMPTS_TBL)
              .select(`
                parent_row_id,
                ${assistantsTbl}!${assistantsTbl}_prompt_row_id_fkey(row_id)
              `)
              .eq("row_id", currentParentId)
              .maybeSingle();
            
            if (!parentData) break;
            
            const parentAssistantData = parentData[assistantsTbl] as { row_id?: string } | { row_id?: string }[] | undefined;
            const parentAssistantId = Array.isArray(parentAssistantData) 
              ? parentAssistantData[0]?.row_id 
              : parentAssistantData?.row_id;
            
            // Use the parent's assistant (will keep updating until we reach root)
            if (parentAssistantId) {
              assistant_row_id = parentAssistantId;
            }
            
            // Move up to next parent (null when we reach root)
            currentParentId = parentData.parent_row_id as string | null;
          }
        }
        
        // Remove the nested object and add flat assistant_row_id
        const { [assistantsTbl]: _, ...promptData } = data;
        return { ...promptData, assistant_row_id } as PromptDataRow;
      }
      
      return null;
    } catch (error) {
      const err = error as { message?: string; code?: string; stack?: string };
      console.error("Error fetching item data:", error);
      toast.error(`Failed to fetch prompt data: ${err?.message || "Unknown error"}`, {
        source: 'usePromptData.fetchItemData',
        errorCode: err?.code || 'FETCH_ERROR',
        details: JSON.stringify({ rowId, error: err?.message, stack: err?.stack }, null, 2),
      } as Record<string, unknown>);
      return null;
    }
  }, [supabase]);

  return { updateField, fetchItemData };
};

export default usePromptData;
