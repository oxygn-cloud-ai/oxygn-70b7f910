import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

const EXPORT_STEPS = {
  SELECT_PROMPTS: 1,
  SELECT_FIELDS: 2,
  SELECT_TYPE: 3,
  CONFIGURE: 4
};

const EXPORT_TYPES = {
  CONFLUENCE: 'confluence',
  SPREADSHEET: 'spreadsheet',
  JIRA: 'jira'
};

const STANDARD_FIELDS = [
  { id: 'output_response', label: 'Output Response', description: 'AI-generated response (includes both output_response and user_prompt_result)' },
  { id: 'input_user_prompt', label: 'User Prompt', description: 'User input prompt' },
  { id: 'input_admin_prompt', label: 'System Prompt', description: 'Admin/system prompt' },
  { id: 'note', label: 'Notes', description: 'Prompt notes' },
  { id: 'prompt_name', label: 'Prompt Name', description: 'Name of the prompt' }
];

export const useExport = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(EXPORT_STEPS.SELECT_PROMPTS);
  const [selectedPromptIds, setSelectedPromptIds] = useState([]);
  const [selectedFields, setSelectedFields] = useState(['output_response', 'prompt_name']);
  const [selectedVariables, setSelectedVariables] = useState({});
  const [exportType, setExportType] = useState(EXPORT_TYPES.CONFLUENCE);
  const [promptsData, setPromptsData] = useState([]);
  const [variablesData, setVariablesData] = useState({});
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [isLoadingVariables, setIsLoadingVariables] = useState(false);

  // Expand prompt IDs with descendants in tree order (parent first, then children by position)
  const expandPromptIdsWithDescendants = useCallback(async (rootPromptIds = []) => {
    const initial = Array.from(new Set(rootPromptIds.filter(Boolean)));
    if (initial.length === 0) return [];

    const allPromptIds = new Set(initial);
    let frontier = initial;

    while (frontier.length > 0) {
      const { data, error } = await supabase
        .from('q_prompts')
        .select('row_id')
        .in('parent_row_id', frontier)
        .or('is_deleted.is.null,is_deleted.eq.false');

      if (error) throw error;

      const next = [];
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
      .select('row_id, parent_row_id, position')
      .in('row_id', Array.from(allPromptIds))
      .or('is_deleted.is.null,is_deleted.eq.false');

    if (fetchError) throw fetchError;

    const childrenMap = new Map();
    const promptMap = new Map();
    
    (allPrompts || []).forEach(p => {
      promptMap.set(p.row_id, p);
      const parentId = p.parent_row_id || null;
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId).push(p);
    });

    childrenMap.forEach((children) => {
      children.sort((a, b) => (a.position || 0) - (b.position || 0));
    });

    const orderedIds = [];

    const traverse = (promptId) => {
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
  // IMPORTANT: This must be defined BEFORE openExport which uses it
  const fetchPromptsData = useCallback(async (promptIds) => {
    if (!promptIds.length) {
      setPromptsData([]);
      return [];
    }

    setIsLoadingPrompts(true);
    try {
      const { data, error } = await supabase
        .from('q_prompts')
        .select('row_id, prompt_name, input_user_prompt, input_admin_prompt, output_response, user_prompt_result, note, exclude_from_export')
        .in('row_id', promptIds)
        .or('exclude_from_export.is.null,exclude_from_export.eq.false');

      if (error) throw error;
      
      const promptMap = new Map();
      (data || []).forEach(prompt => {
        promptMap.set(prompt.row_id, {
          ...prompt,
          output_response: prompt.output_response || prompt.user_prompt_result || ''
        });
      });

      const orderedData = promptIds
        .map(id => promptMap.get(id))
        .filter(Boolean);
      
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
  // IMPORTANT: This must be defined BEFORE openExport which uses it
  const fetchVariablesData = useCallback(async (promptIds) => {
    if (!promptIds.length) {
      setVariablesData({});
      return {};
    }

    setIsLoadingVariables(true);
    try {
      const { data, error } = await supabase
        .from('q_prompt_variables')
        .select('prompt_row_id, variable_name, variable_value, default_value')
        .in('prompt_row_id', promptIds);

      if (error) throw error;

      const grouped = (data || []).reduce((acc, variable) => {
        const promptId = variable.prompt_row_id;
        if (!acc[promptId]) {
          acc[promptId] = [];
        }
        acc[promptId].push(variable);
        return acc;
      }, {});

      setVariablesData(grouped);
      return grouped;
    } catch (error) {
      console.error('Error fetching variables:', error);
      return {};
    } finally {
      setIsLoadingVariables(false);
    }
  }, []);

  // Open the export drawer, optionally with pre-selected prompts
  const openExport = useCallback(async (preSelectedPromptIds = []) => {
    setIsOpen(true);

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
  const closeExport = useCallback(() => {
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
  const goToStep = useCallback((step) => {
    setCurrentStep(step);
  }, []);

  const goNext = useCallback(() => {
    if (currentStep < EXPORT_STEPS.CONFIGURE) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep]);

  const goBack = useCallback(() => {
    if (currentStep > EXPORT_STEPS.SELECT_PROMPTS) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  // Toggle prompt selection
  const togglePromptSelection = useCallback((promptId) => {
    setSelectedPromptIds(prev => {
      if (prev.includes(promptId)) {
        return prev.filter(id => id !== promptId);
      }
      return [...prev, promptId];
    });
  }, []);

  // Toggle prompt with all descendants (for hierarchical selection)
  const toggleWithDescendants = useCallback((node, isCurrentlyAllSelected) => {
    const collectIds = (n) => {
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
  const selectAllPrompts = useCallback((promptIds) => {
    setSelectedPromptIds(promptIds);
  }, []);

  // Clear prompt selection
  const clearPromptSelection = useCallback(() => {
    setSelectedPromptIds([]);
  }, []);

  // Toggle field selection
  const toggleFieldSelection = useCallback((fieldId) => {
    setSelectedFields(prev => {
      if (prev.includes(fieldId)) {
        return prev.filter(id => id !== fieldId);
      }
      return [...prev, fieldId];
    });
  }, []);

  // Toggle variable selection for a prompt
  const toggleVariableSelection = useCallback((promptId, variableName) => {
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
  // IMPORTANT: Include row_id for resolveSourceValue to find prompts correctly
  const getExportData = useMemo(() => {
    return promptsData.map(prompt => {
      const data = { 
        promptId: prompt.row_id,
        row_id: prompt.row_id,  // Required for resolveSourceValue lookup
        prompt_name: prompt.prompt_name  // Always include prompt_name for reference
      };
      
      selectedFields.forEach(fieldId => {
        if (prompt[fieldId] !== undefined) {
          data[fieldId] = prompt[fieldId];
        }
      });

      const promptVars = selectedVariables[prompt.row_id] || [];
      const vars = variablesData[prompt.row_id] || [];
      
      promptVars.forEach(varName => {
        const variable = vars.find(v => v.variable_name === varName);
        if (variable) {
          data[`var_${varName}`] = variable.variable_value || variable.default_value || '';
        }
      });

      return data;
    });
  }, [promptsData, selectedFields, selectedVariables, variablesData]);

  // Check if can proceed to next step
  const canProceed = useMemo(() => {
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
