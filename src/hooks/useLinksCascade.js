import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSupabase } from './useSupabase';

export const useLinksCascade = () => {
  const [sourceIconId, setSourceIconId] = useState(null);
  const [sourceField, setSourceField] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const supabase = useSupabase();

  useEffect(() => {
    if (location.state) {
      setSourceIconId(location.state.sourceIconId);
      setSourceField(location.state.sourceField);
    } else {
      // If there's no state, we're probably not in the correct context
      toast.error('No source information found. Please try reopening the Links page.');
      navigate('/projects');
    }
  }, [location, navigate]);

  const handleCascade = useCallback(async (activeItem, fieldName, selectedText) => {
    if (!activeItem) {
      toast.error('Unable to cascade: active prompt is missing');
      return;
    }
    if (!sourceIconId) {
      toast.error('Unable to cascade: source icon ID is missing');
      return;
    }
    if (!sourceField) {
      toast.error('Unable to cascade: source field is missing');
      return;
    }
    if (!fieldName) {
      toast.error('Unable to cascade: target field is missing');
      return;
    }
    if (!selectedText) {
      toast.error('Unable to cascade: selected text is missing');
      return;
    }

    const jsonText = JSON.stringify({
      prompt_id: activeItem,
      sourceField: fieldName,
      startChar: 0,
      endChar: selectedText.length
    });

    const sourceColumnMap = {
      input_admin_prompt: 'src_admin_prompt_result',
      input_user_prompt: 'src_user_prompt_result',
      admin_prompt_result: 'src_admin_prompt_result',
      user_prompt_result: 'src_user_prompt_result'
    };

    const sourceColumn = sourceColumnMap[sourceField];

    if (!sourceColumn) {
      toast.error('Invalid source field');
      return;
    }

    try {
      const { error } = await supabase
        .from('prompts')
        .update({ [sourceColumn]: jsonText })
        .eq('row_id', sourceIconId);

      if (error) throw error;

      toast.success('Cascade successful');
      navigate(-1);
    } catch (error) {
      console.error('Error cascading:', error);
      toast.error(`Failed to cascade: ${error.message}`);
    }
  }, [sourceIconId, sourceField, supabase, navigate]);

  return { sourceIconId, sourceField, handleCascade };
};
