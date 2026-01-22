import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { validateVariableName } from '@/utils/variableResolver';
import { trackEvent } from '@/lib/posthog';

export interface PromptVariable {
  row_id: string;
  prompt_row_id: string;
  variable_name: string;
  variable_value: string | null;
  variable_description: string | null;
  default_value?: string | null;
  created_at: string | null;
  updated_at?: string | null;
}

interface VariableUpdates {
  variable_name?: string;
  variable_value?: string;
  variable_description?: string;
}

type VariablesMap = Record<string, string>;

interface UsePromptVariablesReturn {
  variables: PromptVariable[];
  isLoading: boolean;
  addVariable: (name: string, value?: string, description?: string) => Promise<PromptVariable | null>;
  updateVariable: (rowId: string, updates: VariableUpdates) => Promise<boolean>;
  setVariableValue: (variableName: string, value: string) => Promise<boolean>;
  deleteVariable: (rowId: string) => Promise<boolean>;
  refreshVariables: () => Promise<void>;
  getVariablesMap: () => VariablesMap;
}

/**
 * Hook for managing user-defined prompt variables
 */
export const usePromptVariables = (promptRowId: string | null): UsePromptVariablesReturn => {
  const [variables, setVariables] = useState<PromptVariable[]>([]);
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
      setVariables((data || []) as PromptVariable[]);
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
    const handleVariablesUpdated = (event: CustomEvent<{ promptRowId?: string }>) => {
      if (event.detail?.promptRowId === promptRowId) {
        fetchVariables();
      }
    };
    
    window.addEventListener('q:prompt-variables-updated', handleVariablesUpdated as EventListener);
    return () => {
      window.removeEventListener('q:prompt-variables-updated', handleVariablesUpdated as EventListener);
    };
  }, [promptRowId, fetchVariables]);

  /**
   * Add a new variable
   */
  const addVariable = useCallback(async (
    name: string,
    value = '',
    description = ''
  ): Promise<PromptVariable | null> => {
    if (!promptRowId) return null;

    // Validate name
    const validation = validateVariableName(name);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid variable name');
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
      
      const newVariable = data as PromptVariable;
      setVariables(prev => [...prev, newVariable]);
      toast.success('Variable added', {
        source: 'usePromptVariables.addVariable',
        details: JSON.stringify({ promptRowId, variableName: name, variableRowId: newVariable?.row_id }, null, 2),
      } as never);
      
      // Track variable added
      trackEvent('variable_added', {
        prompt_id: promptRowId,
        variable_name: name,
      });
      
      return newVariable;
    } catch (error) {
      console.error('Error adding variable:', error);
      const err = error as { code?: string; message?: string; stack?: string };
      if (err.code === '23505') {
        toast.error('A variable with this name already exists', {
          source: 'usePromptVariables.addVariable',
          errorCode: 'DUPLICATE_VARIABLE',
          details: JSON.stringify({ promptRowId, variableName: name }, null, 2),
        } as never);
      } else {
        toast.error('Failed to add variable', {
          source: 'usePromptVariables.addVariable',
          errorCode: err?.code || 'ADD_VARIABLE_ERROR',
          details: JSON.stringify({ promptRowId, variableName: name, error: err?.message, stack: err?.stack }, null, 2),
        } as never);
      }
      return null;
    }
  }, [promptRowId, variables]);

  /**
   * Update a variable
   */
  const updateVariable = useCallback(async (rowId: string, updates: VariableUpdates): Promise<boolean> => {
    try {
      // If updating name, validate it
      if (updates.variable_name) {
        const validation = validateVariableName(updates.variable_name);
        if (!validation.valid) {
          toast.error(validation.error || 'Invalid variable name');
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
      const err = error as { code?: string; message?: string; stack?: string };
      toast.error('Failed to update variable', {
        source: 'usePromptVariables.updateVariable',
        errorCode: err?.code || 'UPDATE_VARIABLE_ERROR',
        details: JSON.stringify({ rowId, updates, error: err?.message, stack: err?.stack }, null, 2),
      } as never);
      return false;
    }
  }, []);

  /**
   * Set a variable's value by name (for use by processVariableAssignments callback)
   */
  const setVariableValue = useCallback(async (variableName: string, value: string): Promise<boolean> => {
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
  const deleteVariable = useCallback(async (rowId: string): Promise<boolean> => {
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
      } as never);
      return true;
    } catch (error) {
      console.error('Error deleting variable:', error);
      const err = error as { code?: string; message?: string; stack?: string };
      toast.error('Failed to delete variable', {
        source: 'usePromptVariables.deleteVariable',
        errorCode: err?.code || 'DELETE_VARIABLE_ERROR',
        details: JSON.stringify({ rowId, error: err?.message, stack: err?.stack }, null, 2),
      } as never);
      return false;
    }
  }, []);

  /**
   * Get variables as a map for resolution
   */
  const getVariablesMap = useCallback((): VariablesMap => {
    const map: VariablesMap = {};
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
