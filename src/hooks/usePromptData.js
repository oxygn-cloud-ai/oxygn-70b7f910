import React, { useCallback } from "react";
import { toast } from "@/components/ui/sonner";

/**
 * Prompt data helpers with memoized functions to prevent infinite re-renders.
 */
export const usePromptData = (supabase) => {
  const updateField = useCallback(async (rowId, fieldName, value) => {
    if (!supabase || !rowId) return false;

    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ [fieldName]: value })
        .eq("row_id", rowId);

      if (error) throw error;

      toast.success(`${fieldName} saved successfully`);
      return true;
    } catch (error) {
      console.error("Error updating field:", error);
      toast.error(`Failed to update ${fieldName}: ${error?.message || "Unknown error"}`);
      return false;
    }
  }, [supabase]);

  const fetchItemData = useCallback(async (rowId) => {
    if (!supabase || !rowId) return null;

    try {
      // Fetch prompt data with related assistant record
      const { data, error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .select(`
          *,
          ${import.meta.env.VITE_ASSISTANTS_TBL}!${import.meta.env.VITE_ASSISTANTS_TBL}_prompt_row_id_fkey(row_id)
        `)
        .eq("row_id", rowId)
        .maybeSingle();

      // PGRST116 means no rows found - treat as normal
      if (error && error.code !== "PGRST116") throw error;
      
      if (data) {
        // Extract assistant_row_id from the joined data
        const assistantData = data[import.meta.env.VITE_ASSISTANTS_TBL];
        const assistant_row_id = Array.isArray(assistantData) 
          ? assistantData[0]?.row_id 
          : assistantData?.row_id;
        
        // Remove the nested object and add flat assistant_row_id
        const { [import.meta.env.VITE_ASSISTANTS_TBL]: _, ...promptData } = data;
        return { ...promptData, assistant_row_id };
      }
      
      return null;
    } catch (error) {
      console.error("Error fetching item data:", error);
      toast.error(`Failed to fetch prompt data: ${error?.message || "Unknown error"}`);
      return null;
    }
  }, [supabase]);

  return { updateField, fetchItemData };
};
