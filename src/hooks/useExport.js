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
  { id: 'output_response', label: 'Output Response', description: 'AI-generated response' },
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
  const [exportType, setExportType] = useState(null);
  const [promptsData, setPromptsData] = useState([]);
  const [variablesData, setVariablesData] = useState({});
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [isLoadingVariables, setIsLoadingVariables] = useState(false);

  // Open the export drawer, optionally with pre-selected prompts
  const openExport = useCallback((preSelectedPromptIds = []) => {
    setIsOpen(true);
    if (preSelectedPromptIds.length > 0) {
      setSelectedPromptIds(preSelectedPromptIds);
      setCurrentStep(EXPORT_STEPS.SELECT_FIELDS); // Skip to fields step
    } else {
      setCurrentStep(EXPORT_STEPS.SELECT_PROMPTS);
    }
  }, []);

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

  // Fetch prompt data for selected prompts
  const fetchPromptsData = useCallback(async (promptIds) => {
    if (!promptIds.length) {
      setPromptsData([]);
      return [];
    }

    setIsLoadingPrompts(true);
    try {
      const { data, error } = await supabase
        .from('q_prompts')
        .select('row_id, prompt_name, input_user_prompt, input_admin_prompt, output_response, note')
        .in('row_id', promptIds);

      if (error) throw error;
      setPromptsData(data || []);
      return data || [];
    } catch (error) {
      console.error('Error fetching prompts data:', error);
      return [];
    } finally {
      setIsLoadingPrompts(false);
    }
  }, []);

  // Fetch variables for selected prompts
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

      // Group by prompt_row_id
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

  // Get export data based on selections
  const getExportData = useMemo(() => {
    return promptsData.map(prompt => {
      const data = { promptId: prompt.row_id };
      
      // Add selected standard fields
      selectedFields.forEach(fieldId => {
        if (prompt[fieldId] !== undefined) {
          data[fieldId] = prompt[fieldId];
        }
      });

      // Add selected variables
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
    selectAllPrompts,
    clearPromptSelection,
    toggleFieldSelection,
    toggleVariableSelection,
    setExportType,
    fetchPromptsData,
    fetchVariablesData,
    getExportData,

    // Constants
    EXPORT_STEPS,
    EXPORT_TYPES,
    STANDARD_FIELDS
  };
};
