import { useState, useEffect, useCallback } from 'react';

export interface PromptData {
  row_id: string;
  prompt_name?: string;
  parent_id?: string | null;
  [key: string]: unknown;
}

interface ExpandedFoldersMap {
  [key: string]: boolean;
}

interface UsePromptSelectionReturn {
  selectedPromptId: string | null;
  setSelectedPromptId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedPromptData: PromptData | null;
  setSelectedPromptData: React.Dispatch<React.SetStateAction<PromptData | null>>;
  isLoadingPrompt: boolean;
  expandedFolders: ExpandedFoldersMap;
  setExpandedFolders: React.Dispatch<React.SetStateAction<ExpandedFoldersMap>>;
  toggleFolder: (id: string) => void;
  handleSelectPrompt: (newPromptId: string | null) => void;
}

/**
 * Hook to manage selected prompt state with localStorage persistence.
 * Handles prompt selection, data loading, and tree expansion state.
 * 
 * NOTE: API calls now continue in background when switching prompts.
 * The LiveApiDashboard in TopBar shows active call status.
 */
export const usePromptSelection = (
  fetchItemData: (id: string) => Promise<PromptData | null>
): UsePromptSelectionReturn => {
  // Selected prompt state - persisted to localStorage
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('qonsol-selected-prompt-id');
      return saved || null;
    } catch {
      return null;
    }
  });
  const [selectedPromptData, setSelectedPromptData] = useState<PromptData | null>(null);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  
  // Tree expanded/collapsed state - persisted to localStorage
  const [expandedFolders, setExpandedFolders] = useState<ExpandedFoldersMap>(() => {
    try {
      const saved = localStorage.getItem('qonsol-expanded-folders');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  // Toggle folder expansion
  const toggleFolder = useCallback((id: string) => {
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);
  
  // Direct prompt selection - API calls continue in background
  const handleSelectPrompt = useCallback((newPromptId: string | null) => {
    setSelectedPromptId(newPromptId);
  }, []);
  
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
    const handlePromptResultUpdated = async (event: CustomEvent<{ promptRowId?: string }>) => {
      try {
        const { promptRowId } = event.detail || {};
        if (promptRowId && promptRowId === selectedPromptId) {
          const freshData = await fetchItemData(selectedPromptId);
          setSelectedPromptData(freshData);
        }
      } catch (error) {
        console.error('Error refreshing prompt data:', error);
      }
    };
    
    window.addEventListener('prompt-result-updated', handlePromptResultUpdated as EventListener);
    return () => {
      window.removeEventListener('prompt-result-updated', handlePromptResultUpdated as EventListener);
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
    } catch {
      // Ignore localStorage errors
    }
  }, [selectedPromptId]);
  
  // Persist expanded folders to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('qonsol-expanded-folders', JSON.stringify(expandedFolders));
    } catch {
      // Ignore localStorage errors
    }
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
