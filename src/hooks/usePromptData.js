import { toast } from "@/components/ui/sonner";

/**
 * Prompt data helpers.
 *
 * NOTE: This intentionally does NOT use React hooks (useCallback, etc.).
 * We previously hit a runtime "useCallback" dispatcher error which is often
 * caused by React instance mismatches. Keeping this hook-hookless avoids that.
 */
export const usePromptData = (supabase) => {
  const updateField = async (rowId, fieldName, value) => {
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
  };

  const fetchItemData = async (rowId) => {
    if (!supabase || !rowId) return null;

    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .select("*")
        .eq("row_id", rowId)
        .maybeSingle();

      // PGRST116 means no rows found - treat as normal
      if (error && error.code !== "PGRST116") throw error;
      return data ?? null;
    } catch (error) {
      console.error("Error fetching item data:", error);
      toast.error(`Failed to fetch prompt data: ${error?.message || "Unknown error"}`);
      return null;
    }
  };

  return { updateField, fetchItemData };
};
