// @ts-nocheck
// Hook for managing user-defined prompt variables
// Force single React instance by using the canonical React import
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { validateVariableName } from '@/utils/variableResolver';
import { trackEvent } from '@/lib/posthog';

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

  // Listen for variable updates from processVariableAssignments
  useEffect(() => {
    const handleVariablesUpdated = (event) => {
      if (event.detail?.promptRowId === promptRowId) {
        fetchVariables();
      }
    };
    
    window.addEventListener('q:prompt-variables-updated', handleVariablesUpdated);
    return () => {
      window.removeEventListener('q:prompt-variables-updated', handleVariablesUpdated);
    };
  }, [promptRowId, fetchVariables]);

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
        .maybeSingle();

      if (error) throw error;
      
      setVariables(prev => [...prev, data]);
      toast.success('Variable added', {
        source: 'usePromptVariables.addVariable',
        details: JSON.stringify({ promptRowId, variableName: name, variableRowId: data?.row_id }, null, 2),
      });
      
      // Track variable added
      trackEvent('variable_added', {
        prompt_id: promptRowId,
        variable_name: name,
      });
      
      return data;
    } catch (error) {
      console.error('Error adding variable:', error);
      if (error.code === '23505') {
        toast.error('A variable with this name already exists', {
          source: 'usePromptVariables.addVariable',
          errorCode: 'DUPLICATE_VARIABLE',
          details: JSON.stringify({ promptRowId, variableName: name }, null, 2),
        });
      } else {
        toast.error('Failed to add variable', {
          source: 'usePromptVariables.addVariable',
          errorCode: error?.code || 'ADD_VARIABLE_ERROR',
          details: JSON.stringify({ promptRowId, variableName: name, error: error?.message, stack: error?.stack }, null, 2),
        });
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
      toast.error('Failed to update variable', {
        source: 'usePromptVariables.updateVariable',
        errorCode: error?.code || 'UPDATE_VARIABLE_ERROR',
        details: JSON.stringify({ rowId, updates, error: error?.message, stack: error?.stack }, null, 2),
      });
      return false;
    }
  }, []);

  /**
   * Set a variable's value by name (for use by processVariableAssignments callback)
   */
  const setVariableValue = useCallback(async (variableName, value) => {
    if (!promptRowId) return false;
    
    // Re-fetch to get fresh state and find the variable
    const { data: freshVar, error: fetchError } = await supabase
      .from(import.meta.env.VITE_PROMPT_VARIABLES_TBL)
      .select('row_id')
      .eq('prompt_row_id', promptRowId)
      .eq('variable_name', variableName)
      .maybeSingle();
      
    if (fetchError || !freshVar) {
      console.warn(`Variable "${variableName}" not found for prompt ${promptRowId}`);
      return false;
    }
    
    return updateVariable(freshVar.row_id, { variable_value: value });
  }, [promptRowId, updateVariable]);

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
      toast.success('Variable deleted', {
        source: 'usePromptVariables.deleteVariable',
        details: JSON.stringify({ rowId }, null, 2),
      });
      return true;
    } catch (error) {
      console.error('Error deleting variable:', error);
      toast.error('Failed to delete variable', {
        source: 'usePromptVariables.deleteVariable',
        errorCode: error?.code || 'DELETE_VARIABLE_ERROR',
        details: JSON.stringify({ rowId, error: error?.message, stack: error?.stack }, null, 2),
      });
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
    setVariableValue,
    deleteVariable,
    refreshVariables: fetchVariables,
    getVariablesMap,
  };
};

export default usePromptVariables;
