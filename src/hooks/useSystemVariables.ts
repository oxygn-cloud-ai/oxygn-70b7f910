/**
 * Hook for managing user-editable system variables
 * 
 * Handles reading/writing policy variables from/to the prompt's system_variables JSONB field
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  SYSTEM_VARIABLES, 
  isUserEditableVariable 
} from '@/config/systemVariables';

export type SystemVariablesMap = Record<string, string>;

interface ValidationResult {
  valid: boolean;
  error?: string;
}

interface UseSystemVariablesReturn {
  systemVariables: SystemVariablesMap;
  updateSystemVariable: (varName: string, value: string) => Promise<boolean>;
  clearSystemVariable: (varName: string) => Promise<boolean>;
  updateMultipleVariables: (updates: SystemVariablesMap) => Promise<boolean>;
  getVariableValue: (varName: string) => string;
  isSaving: boolean;
  savingVarName: string | null;
}

export const useSystemVariables = (
  promptRowId: string | null, 
  initialSystemVariables: SystemVariablesMap = {}
): UseSystemVariablesReturn => {
  const [systemVariables, setSystemVariables] = useState<SystemVariablesMap>(initialSystemVariables || {});
  const [isSaving, setIsSaving] = useState(false);
  const [savingVarName, setSavingVarName] = useState<string | null>(null);

  // Sync with initial value when it changes
  useEffect(() => {
    if (initialSystemVariables && typeof initialSystemVariables === 'object') {
      setSystemVariables(initialSystemVariables);
    }
  }, [initialSystemVariables]);

  /**
   * Validate a value for a specific variable
   */
  const validateValue = useCallback((varName: string, value: string): ValidationResult => {
    const def = SYSTEM_VARIABLES[varName as keyof typeof SYSTEM_VARIABLES];
    
    // Check if variable is user-editable
    if (!isUserEditableVariable(varName)) {
      return { valid: false, error: `${varName} is not editable` };
    }

    // For select-type variables, validate against options
    if (def?.inputType === 'select' && def.options) {
      if (value && !def.options.includes(value)) {
        return { valid: false, error: `Invalid value for ${def.label || varName}. Must be one of: ${def.options.join(', ')}` };
      }
    }

    return { valid: true };
  }, []);

  /**
   * Update a single system variable
   */
  const updateSystemVariable = useCallback(async (varName: string, value: string): Promise<boolean> => {
    if (!promptRowId) {
      toast.error('No prompt selected');
      return false;
    }

    // Validate the variable
    const validation = validateValue(varName, value);
    if (!validation.valid) {
      toast.error(validation.error);
      return false;
    }

    setIsSaving(true);
    setSavingVarName(varName);

    try {
      // Build updated variables object
      const updatedVars: SystemVariablesMap = { 
        ...systemVariables, 
        [varName]: value || '' 
      };

      // Save to database
      const { error } = await supabase
        .from('q_prompts')
        .update({ system_variables: updatedVars })
        .eq('row_id', promptRowId);

      if (error) {
        console.error('Failed to save system variable:', error);
        toast.error('Failed to save variable');
        return false;
      }

      // Update local state
      setSystemVariables(updatedVars);
      const def = SYSTEM_VARIABLES[varName as keyof typeof SYSTEM_VARIABLES];
      toast.success(`${def?.label || varName} saved`);
      return true;
    } catch (err) {
      console.error('Error saving system variable:', err);
      toast.error('Failed to save variable');
      return false;
    } finally {
      setIsSaving(false);
      setSavingVarName(null);
    }
  }, [promptRowId, systemVariables, validateValue]);

  /**
   * Clear a system variable (set to empty string)
   */
  const clearSystemVariable = useCallback(async (varName: string): Promise<boolean> => {
    return updateSystemVariable(varName, '');
  }, [updateSystemVariable]);

  /**
   * Get the current value of a system variable
   */
  const getVariableValue = useCallback((varName: string): string => {
    return systemVariables[varName] || '';
  }, [systemVariables]);

  /**
   * Bulk update multiple variables at once
   */
  const updateMultipleVariables = useCallback(async (updates: SystemVariablesMap): Promise<boolean> => {
    if (!promptRowId) {
      toast.error('No prompt selected');
      return false;
    }

    // Validate all updates
    for (const [varName, value] of Object.entries(updates)) {
      const validation = validateValue(varName, value);
      if (!validation.valid) {
        toast.error(validation.error);
        return false;
      }
    }

    setIsSaving(true);

    try {
      // Build updated variables object
      const updatedVars: SystemVariablesMap = { ...systemVariables, ...updates };

      // Save to database
      const { error } = await supabase
        .from('q_prompts')
        .update({ system_variables: updatedVars })
        .eq('row_id', promptRowId);

      if (error) {
        console.error('Failed to save system variables:', error);
        toast.error('Failed to save variables');
        return false;
      }

      // Update local state
      setSystemVariables(updatedVars);
      toast.success('Variables saved');
      return true;
    } catch (err) {
      console.error('Error saving system variables:', err);
      toast.error('Failed to save variables');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [promptRowId, systemVariables, validateValue]);

  return {
    systemVariables,
    updateSystemVariable,
    clearSystemVariable,
    updateMultipleVariables,
    getVariableValue,
    isSaving,
    savingVarName,
  };
};

export default useSystemVariables;
