import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { validateVariableName } from '@/utils/variableResolver';

/**
 * Hook for managing user-defined prompt variables
 */
export const usePromptVariables = (promptRowId) => {
  const [variables, setVariables] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Fetch variables for the prompt
   */
  const fetchVariables = useCallback(async () => {
    if (!promptRowId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_PROMPT_VARIABLES_TBL)
        .select('*')
        .eq('prompt_row_id', promptRowId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setVariables(data || []);
    } catch (error) {
      console.error('Error fetching variables:', error);
      toast.error('Failed to load variables');
    } finally {
      setIsLoading(false);
    }
  }, [promptRowId]);

  useEffect(() => {
    fetchVariables();
  }, [fetchVariables]);

  /**
   * Add a new variable
   */
  const addVariable = useCallback(async (name, value = '', description = '') => {
    if (!promptRowId) return null;

    // Validate name
    const validation = validateVariableName(name);
    if (!validation.valid) {
      toast.error(validation.error);
      return null;
    }

    // Check for duplicates
    if (variables.some(v => v.variable_name === name)) {
      toast.error('A variable with this name already exists');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_PROMPT_VARIABLES_TBL)
        .insert({
          prompt_row_id: promptRowId,
          variable_name: name,
          variable_value: value,
          variable_description: description,
        })
        .select()
        .single();

      if (error) throw error;
      
      setVariables(prev => [...prev, data]);
      toast.success('Variable added');
      return data;
    } catch (error) {
      console.error('Error adding variable:', error);
      if (error.code === '23505') {
        toast.error('A variable with this name already exists');
      } else {
        toast.error('Failed to add variable');
      }
      return null;
    }
  }, [promptRowId, variables]);

  /**
   * Update a variable
   */
  const updateVariable = useCallback(async (rowId, updates) => {
    try {
      // If updating name, validate it
      if (updates.variable_name) {
        const validation = validateVariableName(updates.variable_name);
        if (!validation.valid) {
          toast.error(validation.error);
          return false;
        }
      }

      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPT_VARIABLES_TBL)
        .update(updates)
        .eq('row_id', rowId);

      if (error) throw error;
      
      setVariables(prev => 
        prev.map(v => v.row_id === rowId ? { ...v, ...updates } : v)
      );
      return true;
    } catch (error) {
      console.error('Error updating variable:', error);
      toast.error('Failed to update variable');
      return false;
    }
  }, []);

  /**
   * Delete a variable
   */
  const deleteVariable = useCallback(async (rowId) => {
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPT_VARIABLES_TBL)
        .delete()
        .eq('row_id', rowId);

      if (error) throw error;
      
      setVariables(prev => prev.filter(v => v.row_id !== rowId));
      toast.success('Variable deleted');
      return true;
    } catch (error) {
      console.error('Error deleting variable:', error);
      toast.error('Failed to delete variable');
      return false;
    }
  }, []);

  /**
   * Get variables as a map for resolution
   */
  const getVariablesMap = useCallback(() => {
    const map = {};
    variables.forEach(v => {
      map[v.variable_name] = v.variable_value || v.default_value || '';
    });
    return map;
  }, [variables]);

  return {
    variables,
    isLoading,
    addVariable,
    updateVariable,
    deleteVariable,
    refreshVariables: fetchVariables,
    getVariablesMap,
  };
};

export default usePromptVariables;
