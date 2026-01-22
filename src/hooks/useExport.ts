import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent } from '@/lib/posthog';
import { CONTEXT_VARIABLE_KEYS } from '@/config/contextVariables';

// ============================================================================
// Constants
// ============================================================================

export const EXPORT_STEPS = {
  SELECT_PROMPTS: 1,
  SELECT_FIELDS: 2,
  SELECT_TYPE: 3,
  CONFIGURE: 4
} as const;

export const EXPORT_TYPES = {
  CONFLUENCE: 'confluence',
  SPREADSHEET: 'spreadsheet',
  JIRA: 'jira'
} as const;

export const STANDARD_FIELDS = [
  { id: 'output_response', label: 'Output Response', description: 'AI-generated response (includes both output_response and user_prompt_result)' },
  { id: 'input_user_prompt', label: 'User Prompt', description: 'User input prompt' },
  { id: 'input_admin_prompt', label: 'System Prompt', description: 'Admin/system prompt' },
  { id: 'note', label: 'Notes', description: 'Prompt notes' },
  { id: 'prompt_name', label: 'Prompt Name', description: 'Name of the prompt' }
] as const;

// ============================================================================
// Types
// ============================================================================

export type ExportStep = typeof EXPORT_STEPS[keyof typeof EXPORT_STEPS];
export type ExportType = typeof EXPORT_TYPES[keyof typeof EXPORT_TYPES] | null;

export interface StandardField {
  id: string;
  label: string;
  description: string;
}

export interface PromptData {
  row_id: string;
  prompt_name?: string | null;
  input_user_prompt?: string | null;
  input_admin_prompt?: string | null;
  output_response?: string | null;
  user_prompt_result?: string | null;
  note?: string | null;
  exclude_from_export?: boolean | null;
  system_variables?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface VariableData {
  prompt_row_id: string;
  variable_name: string;
  variable_value?: string | null;
  default_value?: string | null;
}

export interface VariablesDataMap {
  [promptRowId: string]: VariableData[];
}

export interface SelectedVariablesMap {
  [promptRowId: string]: string[];
}

export interface ExportDataItem {
  promptId: string;
  row_id: string;
  prompt_name?: string;
  system_variables?: Record<string, unknown>;
  _promptRefMap?: Map<string, PromptData>;
  [key: string]: unknown;
}

export interface TreeNode {
  row_id: string;
  children?: TreeNode[];
  [key: string]: unknown;
}

export interface UseExportReturn {
  // State
  isOpen: boolean;
  currentStep: ExportStep;
  selectedPromptIds: string[];
  selectedFields: string[];
  selectedVariables: SelectedVariablesMap;
  exportType: ExportType;
  promptsData: PromptData[];
  variablesData: VariablesDataMap;
  isLoadingPrompts: boolean;
  isLoadingVariables: boolean;
  canProceed: boolean;
  
  // Actions
  openExport: (preSelectedPromptIds?: string[]) => Promise<void>;
  closeExport: () => void;
  goToStep: (step: ExportStep) => void;
  goNext: () => void;
  goBack: () => void;
  togglePromptSelection: (promptId: string) => void;
  toggleWithDescendants: (node: TreeNode, isCurrentlyAllSelected: boolean) => void;
  selectAllPrompts: (promptIds: string[]) => void;
  clearPromptSelection: () => void;
  toggleFieldSelection: (fieldId: string) => void;
  toggleVariableSelection: (promptId: string, variableName: string) => void;
  setExportType: React.Dispatch<React.SetStateAction<ExportType>>;
  setSelectedFields: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedVariables: React.Dispatch<React.SetStateAction<SelectedVariablesMap>>;
  fetchPromptsData: (promptIds: string[]) => Promise<PromptData[]>;
  fetchVariablesData: (promptIds: string[]) => Promise<VariablesDataMap>;
  getExportData: ExportDataItem[];

  // Constants
  EXPORT_STEPS: typeof EXPORT_STEPS;
  EXPORT_TYPES: typeof EXPORT_TYPES;
  STANDARD_FIELDS: typeof STANDARD_FIELDS;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export const useExport = (): UseExportReturn => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<ExportStep>(EXPORT_STEPS.SELECT_PROMPTS);
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>(['output_response', 'prompt_name']);
  const [selectedVariables, setSelectedVariables] = useState<SelectedVariablesMap>({});
  const [exportType, setExportType] = useState<ExportType>(EXPORT_TYPES.CONFLUENCE);
  const [promptsData, setPromptsData] = useState<PromptData[]>([]);
  const [variablesData, setVariablesData] = useState<VariablesDataMap>({});
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [isLoadingVariables, setIsLoadingVariables] = useState(false);

  // Expand prompt IDs with descendants in tree order (parent first, then children by position)
  const expandPromptIdsWithDescendants = useCallback(async (rootPromptIds: string[] = []): Promise<string[]> => {
    const initial = Array.from(new Set(rootPromptIds.filter(Boolean)));
    if (initial.length === 0) return [];

    const allPromptIds = new Set<string>(initial);
    let frontier = initial;

    while (frontier.length > 0) {
      const { data, error } = await supabase
        .from('q_prompts')
        .select('row_id')
        .in('parent_row_id', frontier)
        .or('is_deleted.is.null,is_deleted.eq.false');

      if (error) throw error;

      const next: string[] = [];
      (data || []).forEach((row) => {
        const id = row.row_id;
        if (id && !allPromptIds.has(id)) {
          allPromptIds.add(id);
          next.push(id);
        }
      });

      frontier = next;
    }

    const { data: allPrompts, error: fetchError } = await supabase
      .from('q_prompts')
      .select('row_id, parent_row_id, position_lex')
      .in('row_id', Array.from(allPromptIds))
      .or('is_deleted.is.null,is_deleted.eq.false');

    if (fetchError) throw fetchError;

    const childrenMap = new Map<string | null, { row_id: string; position_lex: string | null }[]>();
    const promptMap = new Map<string, { row_id: string; parent_row_id: string | null; position_lex: string | null }>();
    
    (allPrompts || []).forEach(p => {
      promptMap.set(p.row_id, p);
      const parentId = p.parent_row_id || null;
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push({ row_id: p.row_id, position_lex: p.position_lex });
    });

    childrenMap.forEach((children) => {
      children.sort((a, b) => (a.position_lex || '').localeCompare(b.position_lex || ''));
    });

    const orderedIds: string[] = [];

    const traverse = (promptId: string): void => {
      orderedIds.push(promptId);
      const children = childrenMap.get(promptId) || [];
      children.forEach(child => traverse(child.row_id));
    };

    initial.forEach(rootId => {
      if (promptMap.has(rootId)) {
        traverse(rootId);
      }
    });

    return orderedIds;
  }, []);

  // Fetch prompt data for selected prompts (excludes prompts with exclude_from_export)
  const fetchPromptsData = useCallback(async (promptIds: string[]): Promise<PromptData[]> => {
    if (!promptIds.length) {
      setPromptsData([]);
      return [];
    }

    setIsLoadingPrompts(true);
    try {
      const { data, error } = await supabase
        .from('q_prompts')
        .select('row_id, prompt_name, input_user_prompt, input_admin_prompt, output_response, user_prompt_result, note, exclude_from_export, system_variables')
        .in('row_id', promptIds)
        .or('exclude_from_export.is.null,exclude_from_export.eq.false');

      if (error) throw error;
      
      const promptMap = new Map<string, PromptData>();
      (data || []).forEach(prompt => {
        promptMap.set(prompt.row_id, {
          ...prompt,
          output_response: prompt.output_response || prompt.user_prompt_result || ''
        });
      });

      const orderedData = promptIds
        .map(id => promptMap.get(id))
        .filter((p): p is PromptData => Boolean(p));
      
      setPromptsData(orderedData);
      return orderedData;
    } catch (error) {
      console.error('Error fetching prompts data:', error);
      return [];
    } finally {
      setIsLoadingPrompts(false);
    }
  }, []);

  // Fetch variables for selected prompts
  const fetchVariablesData = useCallback(async (promptIds: string[]): Promise<VariablesDataMap> => {
    console.log('[useExport] fetchVariablesData called with promptIds:', promptIds);
    if (!promptIds.length) {
      console.log('[useExport] No prompt IDs provided, clearing variables');
      setVariablesData({});
      return {};
    }

    setIsLoadingVariables(true);
    try {
      const tableName = import.meta.env.VITE_PROMPT_VARIABLES_TBL || 'q_prompt_variables';
      console.log('[useExport] Querying table:', tableName, 'for', promptIds.length, 'prompts');
      
      const { data, error } = await supabase
        .from(tableName)
        .select('prompt_row_id, variable_name, variable_value, default_value')
        .in('prompt_row_id', promptIds);

      if (error) {
        console.error('[useExport] Supabase error fetching variables:', error);
        throw error;
      }

      console.log('[useExport] Raw variables data:', data?.length || 0, 'variables found');

      const grouped = (data || []).reduce<VariablesDataMap>((acc, variable) => {
        const promptId = variable.prompt_row_id;
        if (!acc[promptId]) {
          acc[promptId] = [];
        }
        acc[promptId].push(variable);
        return acc;
      }, {});

      console.log('[useExport] Grouped variables:', Object.keys(grouped).length, 'prompts have variables');
      setVariablesData(grouped);
      return grouped;
    } catch (error) {
      console.error('[useExport] Error fetching variables:', error);
      return {};
    } finally {
      setIsLoadingVariables(false);
    }
  }, []);

  // Open the export drawer, optionally with pre-selected prompts
  const openExport = useCallback(async (preSelectedPromptIds: string[] = []): Promise<void> => {
    setIsOpen(true);
    
    // Track export started
    trackEvent('export_started', {
      pre_selected_count: preSelectedPromptIds.length,
    });

    if (preSelectedPromptIds.length > 0) {
      try {
        const expandedIds = await expandPromptIdsWithDescendants(preSelectedPromptIds);
        console.log('[useExport] Expanded prompt IDs:', expandedIds.length, 'from', preSelectedPromptIds.length, 'root(s)');
        
        setSelectedPromptIds(expandedIds);
        
        const [promptsResult] = await Promise.all([
          fetchPromptsData(expandedIds),
          fetchVariablesData(expandedIds)
        ]);
        console.log('[useExport] Fetched prompts data:', promptsResult?.length || 0, 'prompts');
        
        setCurrentStep(EXPORT_STEPS.SELECT_FIELDS);
      } catch (error) {
        console.error('[useExport] Error expanding/fetching prompts:', error);
        setSelectedPromptIds(preSelectedPromptIds);
        setCurrentStep(EXPORT_STEPS.SELECT_FIELDS);
      }

      return;
    }

    setCurrentStep(EXPORT_STEPS.SELECT_PROMPTS);
  }, [expandPromptIdsWithDescendants, fetchPromptsData, fetchVariablesData]);

  // Close and reset
  const closeExport = useCallback((): void => {
    setIsOpen(false);
    setCurrentStep(EXPORT_STEPS.SELECT_PROMPTS);
    setSelectedPromptIds([]);
    setSelectedFields(['output_response', 'prompt_name']);
    setSelectedVariables({});
    setExportType(null);
    setPromptsData([]);
    setVariablesData({});
  }, []);

  // Navigate steps
  const goToStep = useCallback((step: ExportStep): void => {
    setCurrentStep(step);
  }, []);

  const goNext = useCallback((): void => {
    if (currentStep < EXPORT_STEPS.CONFIGURE) {
      setCurrentStep(prev => (prev + 1) as ExportStep);
    }
  }, [currentStep]);

  const goBack = useCallback((): void => {
    if (currentStep > EXPORT_STEPS.SELECT_PROMPTS) {
      setCurrentStep(prev => (prev - 1) as ExportStep);
    }
  }, [currentStep]);

  // Toggle prompt selection
  const togglePromptSelection = useCallback((promptId: string): void => {
    setSelectedPromptIds(prev => {
      if (prev.includes(promptId)) {
        return prev.filter(id => id !== promptId);
      }
      return [...prev, promptId];
    });
  }, []);

  // Toggle prompt with all descendants (for hierarchical selection)
  const toggleWithDescendants = useCallback((node: TreeNode, isCurrentlyAllSelected: boolean): void => {
    const collectIds = (n: TreeNode): string[] => {
      const ids = [n.row_id];
      if (n.children?.length) {
        n.children.forEach(child => {
          ids.push(...collectIds(child));
        });
      }
      return ids;
    };
    
    const allIds = collectIds(node);
    
    setSelectedPromptIds(prev => {
      if (isCurrentlyAllSelected) {
        return prev.filter(id => !allIds.includes(id));
      } else {
        const newIds = new Set([...prev, ...allIds]);
        return Array.from(newIds);
      }
    });
  }, []);

  // Select all prompts
  const selectAllPrompts = useCallback((promptIds: string[]): void => {
    setSelectedPromptIds(promptIds);
  }, []);

  // Clear prompt selection
  const clearPromptSelection = useCallback((): void => {
    setSelectedPromptIds([]);
  }, []);

  // Toggle field selection
  const toggleFieldSelection = useCallback((fieldId: string): void => {
    setSelectedFields(prev => {
      if (prev.includes(fieldId)) {
        return prev.filter(id => id !== fieldId);
      }
      return [...prev, fieldId];
    });
  }, []);

  // Toggle variable selection for a prompt
  const toggleVariableSelection = useCallback((promptId: string, variableName: string): void => {
    setSelectedVariables(prev => {
      const promptVars = prev[promptId] || [];
      if (promptVars.includes(variableName)) {
        return {
          ...prev,
          [promptId]: promptVars.filter(v => v !== variableName)
        };
      }
      return {
        ...prev,
        [promptId]: [...promptVars, variableName]
      };
    });
  }, []);

  // Get export data based on selections
  // Include ALL variables (not just selected) for {{variable}} resolution
  // Also include system_variables for q.ref[UUID] resolution
  // Filter out context variables that should not be exported (they're stale snapshots)
  const getExportData = useMemo((): ExportDataItem[] => {
    // Build a map of all prompts for q.ref[UUID] resolution
    const promptRefMap = new Map<string, PromptData>();
    promptsData.forEach(prompt => {
      promptRefMap.set(prompt.row_id, prompt);
    });

    return promptsData.map(prompt => {
      // Filter out context variables from system_variables
      const filteredSystemVars: Record<string, unknown> = {};
      if (prompt.system_variables && typeof prompt.system_variables === 'object') {
        Object.entries(prompt.system_variables).forEach(([key, val]) => {
          if (!CONTEXT_VARIABLE_KEYS.includes(key)) {
            filteredSystemVars[key] = val;
          }
        });
      }
      
      const data: ExportDataItem = { 
        promptId: prompt.row_id,
        row_id: prompt.row_id,  // Required for resolveSourceValue lookup
        prompt_name: prompt.prompt_name || undefined,  // Always include prompt_name for reference
        system_variables: filteredSystemVars,  // Filtered system_variables for q.ref resolution
        _promptRefMap: promptRefMap  // Pass reference map for q.ref resolution
      };
      
      // Include selected fields
      selectedFields.forEach(fieldId => {
        if (prompt[fieldId] !== undefined) {
          data[fieldId] = prompt[fieldId];
        }
      });

      // Include ALL variables for this prompt (needed for {{variable}} resolution)
      // Not just selected ones - we need all for proper substitution
      const allVars = variablesData[prompt.row_id] || [];
      allVars.forEach(variable => {
        data[`var_${variable.variable_name}`] = variable.variable_value || variable.default_value || '';
      });

      return data;
    });
  }, [promptsData, selectedFields, variablesData]);

  // Check if can proceed to next step
  const canProceed = useMemo((): boolean => {
    switch (currentStep) {
      case EXPORT_STEPS.SELECT_PROMPTS:
        return selectedPromptIds.length > 0;
      case EXPORT_STEPS.SELECT_FIELDS:
        return selectedFields.length > 0 || Object.values(selectedVariables).some(v => v.length > 0);
      case EXPORT_STEPS.SELECT_TYPE:
        return exportType !== null;
      case EXPORT_STEPS.CONFIGURE:
        return true;
      default:
        return false;
    }
  }, [currentStep, selectedPromptIds, selectedFields, selectedVariables, exportType]);

  return {
    // State
    isOpen,
    currentStep,
    selectedPromptIds,
    selectedFields,
    selectedVariables,
    exportType,
    promptsData,
    variablesData,
    isLoadingPrompts,
    isLoadingVariables,
    canProceed,
    
    // Actions
    openExport,
    closeExport,
    goToStep,
    goNext,
    goBack,
    togglePromptSelection,
    toggleWithDescendants,
    selectAllPrompts,
    clearPromptSelection,
    toggleFieldSelection,
    toggleVariableSelection,
    setExportType,
    setSelectedFields,
    setSelectedVariables,
    fetchPromptsData,
    fetchVariablesData,
    getExportData,

    // Constants
    EXPORT_STEPS,
    EXPORT_TYPES,
    STANDARD_FIELDS
  };
};
