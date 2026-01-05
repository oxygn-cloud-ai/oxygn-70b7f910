import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to manage selected prompt state with localStorage persistence.
 * Handles prompt selection, data loading, and tree expansion state.
 */
export const usePromptSelection = (fetchItemData, isApiCallInProgress, requestNavigation) => {
  // Selected prompt state - persisted to localStorage
  const [selectedPromptId, setSelectedPromptId] = useState(() => {
    try {
      const saved = localStorage.getItem('qonsol-selected-prompt-id');
      return saved || null;
    } catch {
      return null;
    }
  });
  const [selectedPromptData, setSelectedPromptData] = useState(null);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  
  // Tree expanded/collapsed state - persisted to localStorage
  const [expandedFolders, setExpandedFolders] = useState(() => {
    try {
      const saved = localStorage.getItem('qonsol-expanded-folders');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  // Toggle folder expansion
  const toggleFolder = useCallback((id) => {
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);
  
  // Guarded prompt selection - checks for in-progress API calls before switching
  const handleSelectPrompt = useCallback((newPromptId) => {
    if (!isApiCallInProgress) {
      setSelectedPromptId(newPromptId);
      return;
    }
    // API call in progress - use navigation guard dialog
    requestNavigation(
      'Switching prompt',
      () => setSelectedPromptId(newPromptId)
    );
  }, [isApiCallInProgress, requestNavigation]);
  
  // Fetch prompt data when selection changes
  useEffect(() => {
    const loadPromptData = async () => {
      if (!selectedPromptId) {
        setSelectedPromptData(null);
        return;
      }
      setIsLoadingPrompt(true);
      const data = await fetchItemData(selectedPromptId);
      setSelectedPromptData(data);
      setIsLoadingPrompt(false);
    };
    loadPromptData();
  }, [selectedPromptId, fetchItemData]);
  
  // Listen for prompt-result-updated events to refresh selected prompt data
  useEffect(() => {
    const handlePromptResultUpdated = async (event) => {
      const { promptRowId } = event.detail || {};
      if (promptRowId && promptRowId === selectedPromptId) {
        const freshData = await fetchItemData(selectedPromptId);
        setSelectedPromptData(freshData);
      }
    };
    
    window.addEventListener('prompt-result-updated', handlePromptResultUpdated);
    return () => {
      window.removeEventListener('prompt-result-updated', handlePromptResultUpdated);
    };
  }, [selectedPromptId, fetchItemData]);
  
  // Persist selected prompt to localStorage
  useEffect(() => {
    try {
      if (selectedPromptId) {
        localStorage.setItem('qonsol-selected-prompt-id', selectedPromptId);
      } else {
        localStorage.removeItem('qonsol-selected-prompt-id');
      }
    } catch {}
  }, [selectedPromptId]);
  
  // Persist expanded folders to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('qonsol-expanded-folders', JSON.stringify(expandedFolders));
    } catch {}
  }, [expandedFolders]);
  
  return {
    selectedPromptId,
    setSelectedPromptId,
    selectedPromptData,
    setSelectedPromptData,
    isLoadingPrompt,
    expandedFolders,
    setExpandedFolders,
    toggleFolder,
    handleSelectPrompt,
  };
};

export default usePromptSelection;
