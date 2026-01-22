import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { trackEvent, trackException } from '@/lib/posthog';

interface ParentData {
  row_id: string;
  [key: string]: unknown;
}

interface SelectedItemData {
  row_id: string;
  admin_prompt_result?: string;
  user_prompt_result?: string;
  input_admin_prompt?: string;
  input_user_prompt?: string;
  [key: string]: unknown;
}

interface CascadeUpdateData {
  prompt_id: string;
  sourceField: string;
  startChar: number;
  endChar: number;
}

interface UseCascadeUpdateReturn {
  handleCascade: (fieldName: string, selectedItemData: SelectedItemData | null) => Promise<void>;
}

export const useCascadeUpdate = (
  isPopup: boolean,
  parentData: ParentData | null,
  cascadeField: string | null,
  refreshSelectedItemData?: (rowId: string) => Promise<void>
): UseCascadeUpdateReturn => {
  const handleCascade = useCallback(async (fieldName: string, selectedItemData: SelectedItemData | null) => {
    if (isPopup && parentData && cascadeField) {
      try {
        const fieldContent = selectedItemData?.[fieldName] as string || '';
        let sourceField: string;

        switch (fieldName) {
          case 'admin_prompt_result':
            sourceField = 'admin_prompt_result';
            break;
          case 'user_prompt_result':
            sourceField = 'user_prompt_result';
            break;
          case 'input_admin_prompt':
            sourceField = 'input_admin_prompt';
            break;
          case 'input_user_prompt':
            sourceField = 'input_user_prompt';
            break;
          default:
            sourceField = cascadeField;
        }

        const updateData: CascadeUpdateData = {
          prompt_id: selectedItemData?.row_id || '',
          sourceField: sourceField,
          startChar: 0,
          endChar: fieldContent.length
        };

        const { error } = await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .update({ [`src_${cascadeField}`]: updateData })
          .eq('row_id', parentData.row_id)
          .select();

        if (error) throw error;
        
        const { error: contentUpdateError } = await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .update({ [cascadeField]: fieldContent })
          .eq('row_id', parentData.row_id);

        if (contentUpdateError) throw contentUpdateError;

        toast.success('Cascade information and content updated successfully');
        trackEvent('cascade_updated', { field_name: fieldName, cascade_field: cascadeField });

        if (refreshSelectedItemData) {
          await refreshSelectedItemData(parentData.row_id);
        }
      } catch (error) {
        console.error('Error updating cascade information:', error);
        toast.error(`Failed to update cascade information: ${(error as Error).message}`);
        trackException(error as Error, { context: 'useCascadeUpdate', field_name: fieldName });
      }
    }
  }, [isPopup, parentData, cascadeField, refreshSelectedItemData]);

  return { handleCascade };
};
