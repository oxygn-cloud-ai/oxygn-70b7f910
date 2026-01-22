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
  const [isCancelling, setIsCancelling] = useState(false);
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
  
  // Question prompt state (for run-mode question interrupts)
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const [questionProgress, setQuestionProgress] = useState({ current: 0, max: 10 });
  const [collectedQuestionVars, setCollectedQuestionVars] = useState([]);
  
  const cancelRef = useRef(false);
  const pauseRef = useRef(false);
  const errorResolverRef = useRef(null);
  const actionPreviewResolverRef = useRef(null);
  const questionResolverRef = useRef(null);
  
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
    // Reset question state on new cascade
    setPendingQuestion(null);
    setQuestionProgress({ current: 0, max: 10 });
    setCollectedQuestionVars([]);
    if (questionResolverRef.current) {
      questionResolverRef.current(null);
      questionResolverRef.current = null;
    }
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
    // Reset question state on completion
    setPendingQuestion(null);
    setQuestionProgress({ current: 0, max: 10 });
    setCollectedQuestionVars([]);
    if (questionResolverRef.current) {
      questionResolverRef.current(null);
      questionResolverRef.current = null;
    }
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
    // Set cancel flag immediately (for loop checks)
    cancelRef.current = true;
    setIsCancelling(true);
    
    // Resolve any pending question dialog with null (cancelled)
    if (questionResolverRef.current) {
      questionResolverRef.current(null);
      questionResolverRef.current = null;
    }
    setPendingQuestion(null);
    setQuestionProgress({ current: 0, max: 10 });
    setCollectedQuestionVars([]);
    
    // Call the actual cancel handler FIRST and wait for it
    if (cancelHandlerRef.current) {
      try {
        await cancelHandlerRef.current();
      } catch (e) {
        console.warn('Cancel handler error:', e);
      }
      cancelHandlerRef.current = null;
    }
    
    // NOW update UI state (after cancellation attempt completes)
    setIsCancelling(false);
    setIsRunning(false);
    setIsPaused(false);
    
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
    // Reset question state on new single run
    setPendingQuestion(null);
    setQuestionProgress({ current: 0, max: 10 });
    setCollectedQuestionVars([]);
    if (questionResolverRef.current) {
      questionResolverRef.current(null);
      questionResolverRef.current = null;
    }
    setSingleRunPromptId(promptRowId);
  }, []);

  const endSingleRun = useCallback(() => {
    // Reset question state on end single run
    setPendingQuestion(null);
    setQuestionProgress({ current: 0, max: 10 });
    setCollectedQuestionVars([]);
    if (questionResolverRef.current) {
      questionResolverRef.current(null);
      questionResolverRef.current = null;
    }
    setSingleRunPromptId(null);
  }, []);

  // Question prompt methods (for run-mode question interrupts)
  const showQuestion = useCallback((questionData) => {
    setPendingQuestion(questionData);
    setQuestionProgress(prev => ({ 
      current: prev.current + 1, 
      max: questionData.maxQuestions || prev.max 
    }));
    return new Promise((resolve) => {
      questionResolverRef.current = resolve;
    });
  }, []);

  const resolveQuestion = useCallback((answer) => {
    // answer is string if user submitted, null if cancelled
    setPendingQuestion(null);
    if (questionResolverRef.current) {
      questionResolverRef.current(answer);
      questionResolverRef.current = null;
    }
  }, []);

  const addCollectedQuestionVar = useCallback((name, value) => {
    setCollectedQuestionVars(prev => [...prev, { name, value }]);
  }, []);

  const resetQuestionState = useCallback(() => {
    setPendingQuestion(null);
    setQuestionProgress({ current: 0, max: 10 });
    setCollectedQuestionVars([]);
    if (questionResolverRef.current) {
      questionResolverRef.current(null);
      questionResolverRef.current = null;
    }
  }, []);

  const value = {
    // State
    isRunning,
    isPaused,
    isCancelling,
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
    // Question prompt state
    pendingQuestion,
    questionProgress,
    collectedQuestionVars,
    
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
    // Question prompt actions
    showQuestion,
    resolveQuestion,
    addCollectedQuestionVar,
    resetQuestionState,
  };

  return (
    <CascadeRunContext.Provider value={value}>
      {children}
    </CascadeRunContext.Provider>
  );
};

export default CascadeRunContext;
