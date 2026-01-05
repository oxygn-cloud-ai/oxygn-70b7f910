import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';

const CascadeRunContext = createContext(null);

export const useCascadeRun = () => {
  const context = useContext(CascadeRunContext);
  if (!context) {
    throw new Error('useCascadeRun must be used within a CascadeRunProvider');
  }
  return context;
};

export const CascadeRunProvider = ({ children }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [totalLevels, setTotalLevels] = useState(0);
  const [currentPromptName, setCurrentPromptName] = useState('');
  const [currentPromptRowId, setCurrentPromptRowId] = useState(null);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [totalPrompts, setTotalPrompts] = useState(0);
  const [completedPrompts, setCompletedPrompts] = useState([]);
  const [skippedPrompts, setSkippedPrompts] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [error, setError] = useState(null);
  const [errorPrompt, setErrorPrompt] = useState(null);
  
  // Single run state (for non-cascade runs)
  const [singleRunPromptId, setSingleRunPromptId] = useState(null);
  
  // Action preview state (for showing ActionPreviewDialog)
  const [actionPreview, setActionPreview] = useState(null);
  
  // Skip all previews state (for bypassing all action previews during cascade)
  const [skipAllPreviews, setSkipAllPreviews] = useState(false);
  
  const cancelRef = useRef(false);
  const pauseRef = useRef(false);
  const errorResolverRef = useRef(null);
  const actionPreviewResolverRef = useRef(null);
  
  // Cancel handler ref for true OpenAI cancellation
  const cancelHandlerRef = useRef(null);

  const startCascade = useCallback((levels, promptCount, skippedCount = 0) => {
    setIsRunning(true);
    setIsPaused(false);
    setCurrentLevel(0);
    setTotalLevels(levels);
    setCurrentPromptName('');
    setCurrentPromptRowId(null);
    setCurrentPromptIndex(0);
    setTotalPrompts(promptCount);
    setCompletedPrompts([]);
    setSkippedPrompts([]);
    setStartTime(Date.now());
    setError(null);
    setErrorPrompt(null);
    setSkipAllPreviews(false); // Reset skip all previews on new cascade
    cancelRef.current = false;
    pauseRef.current = false;
  }, []);

  const markPromptSkipped = useCallback((promptRowId, promptName) => {
    setSkippedPrompts(prev => [...prev, { promptRowId, promptName }]);
  }, []);

  const updateProgress = useCallback((level, promptName, promptIndex, promptRowId = null) => {
    setCurrentLevel(level);
    setCurrentPromptName(promptName);
    setCurrentPromptIndex(promptIndex);
    if (promptRowId) setCurrentPromptRowId(promptRowId);
  }, []);

  const markPromptComplete = useCallback((promptRowId, promptName, response) => {
    setCompletedPrompts(prev => [...prev, { promptRowId, promptName, response }]);
  }, []);

  const completeCascade = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    setCurrentPromptName('');
    setCurrentPromptRowId(null);
    setSkipAllPreviews(false); // Reset on completion
    cancelRef.current = false;
    pauseRef.current = false;
    cancelHandlerRef.current = null; // Clear cancel handler
  }, []);

  // Register a cancel handler for true OpenAI cancellation
  const registerCancelHandler = useCallback((handler) => {
    cancelHandlerRef.current = handler;
    return () => { cancelHandlerRef.current = null; };
  }, []);

  const cancel = useCallback(async () => {
    cancelRef.current = true;
    setIsRunning(false);
    setIsPaused(false);
    
    // Call the actual cancel handler (OpenAI cancel endpoint)
    if (cancelHandlerRef.current) {
      try {
        await cancelHandlerRef.current();
      } catch (e) {
        console.warn('Cancel handler error:', e);
      }
      cancelHandlerRef.current = null;
    }
    
    // Show cancellation toast
    toast.info('Cascade run cancelled', {
      description: `Stopped after ${completedPrompts.length} prompt${completedPrompts.length !== 1 ? 's' : ''}`,
    });
    
    // Track cascade cancellation
    trackEvent('cascade_cancelled', {
      prompts_completed: completedPrompts.length,
    });
    
    // Resolve any pending error dialog with 'stop'
    if (errorResolverRef.current) {
      errorResolverRef.current('stop');
      errorResolverRef.current = null;
    }
  }, [completedPrompts.length]);

  const pause = useCallback(() => {
    pauseRef.current = true;
    setIsPaused(true);
    
    // Track cascade pause
    trackEvent('cascade_paused', {
      prompts_completed: completedPrompts.length,
    });
  }, [completedPrompts.length]);

  const resume = useCallback(() => {
    pauseRef.current = false;
    setIsPaused(false);
    
    // Track cascade resume
    trackEvent('cascade_resumed', {
      prompts_completed: completedPrompts.length,
    });
  }, [completedPrompts.length]);

  const isCancelled = useCallback(() => cancelRef.current, []);
  const checkPaused = useCallback(() => pauseRef.current, []);

  const showError = useCallback((promptData, errorMessage) => {
    setError(errorMessage);
    setErrorPrompt(promptData);
    
    return new Promise((resolve) => {
      errorResolverRef.current = resolve;
    });
  }, []);

  const resolveError = useCallback((action) => {
    setError(null);
    setErrorPrompt(null);
    if (errorResolverRef.current) {
      errorResolverRef.current(action);
      errorResolverRef.current = null;
    }
  }, []);

  // Action preview functions (for ActionPreviewDialog)
  const showActionPreview = useCallback((previewData) => {
    setActionPreview(previewData);
    return new Promise((resolve) => {
      actionPreviewResolverRef.current = resolve;
    });
  }, []);

  const resolveActionPreview = useCallback((confirmed) => {
    setActionPreview(null);
    if (actionPreviewResolverRef.current) {
      actionPreviewResolverRef.current(confirmed);
      actionPreviewResolverRef.current = null;
    }
  }, []);

  // Single run functions (for non-cascade runs)
  const startSingleRun = useCallback((promptRowId) => {
    setSingleRunPromptId(promptRowId);
  }, []);

  const endSingleRun = useCallback(() => {
    setSingleRunPromptId(null);
  }, []);

  const value = {
    // State
    isRunning,
    isPaused,
    currentLevel,
    totalLevels,
    currentPromptName,
    currentPromptRowId,
    currentPromptIndex,
    totalPrompts,
    completedPrompts,
    skippedPrompts,
    startTime,
    error,
    errorPrompt,
    singleRunPromptId,
    actionPreview,
    skipAllPreviews,
    
    // Actions
    startCascade,
    updateProgress,
    markPromptComplete,
    markPromptSkipped,
    completeCascade,
    cancel,
    pause,
    resume,
    isCancelled,
    checkPaused,
    showError,
    resolveError,
    showActionPreview,
    resolveActionPreview,
    setSkipAllPreviews,
    startSingleRun,
    endSingleRun,
    registerCancelHandler, // For true OpenAI cancellation
  };

  return (
    <CascadeRunContext.Provider value={value}>
      {children}
    </CascadeRunContext.Provider>
  );
};

export default CascadeRunContext;
