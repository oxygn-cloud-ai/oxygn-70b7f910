import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';

// Type definitions
interface CompletedPrompt {
  promptRowId: string;
  promptName: string;
  response: string;
}

interface SkippedPrompt {
  promptRowId: string;
  promptName: string;
}

interface ErrorPrompt {
  name: string;
  row_id?: string;
}

interface ActionPreviewData {
  jsonResponse: unknown;
  config: unknown;
  promptName: string;
}

interface QuestionData {
  question: string;
  variableName: string;
  maxQuestions?: number;
}

interface QuestionProgress {
  current: number;
  max: number;
}

interface CollectedQuestionVar {
  name: string;
  value: string;
}

type ErrorAction = 'retry' | 'skip' | 'stop';

interface CascadeRunContextValue {
  // State
  isRunning: boolean;
  isPaused: boolean;
  isCancelling: boolean;
  currentLevel: number;
  totalLevels: number;
  currentPromptName: string;
  currentPromptRowId: string | null;
  currentPromptIndex: number;
  totalPrompts: number;
  completedPrompts: CompletedPrompt[];
  skippedPrompts: SkippedPrompt[];
  startTime: number | null;
  error: string | null;
  errorPrompt: ErrorPrompt | null;
  singleRunPromptId: string | null;
  actionPreview: ActionPreviewData | null;
  skipAllPreviews: boolean;
  pendingQuestion: QuestionData | null;
  questionProgress: QuestionProgress;
  collectedQuestionVars: CollectedQuestionVar[];
  
  // Actions
  startCascade: (levels: number, promptCount: number, skippedCount?: number) => void;
  updateProgress: (level: number, promptName: string, promptIndex: number, promptRowId?: string | null) => void;
  markPromptComplete: (promptRowId: string, promptName: string, response: string) => void;
  markPromptSkipped: (promptRowId: string, promptName: string) => void;
  completeCascade: () => void;
  cancel: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  isCancelled: () => boolean;
  checkPaused: () => boolean;
  showError: (promptData: ErrorPrompt, errorMessage: string) => Promise<ErrorAction>;
  resolveError: (action: ErrorAction) => void;
  showActionPreview: (previewData: ActionPreviewData) => Promise<boolean>;
  resolveActionPreview: (confirmed: boolean) => void;
  setSkipAllPreviews: (skip: boolean) => void;
  startSingleRun: (promptRowId: string) => void;
  endSingleRun: () => void;
  registerCancelHandler: (handler: () => Promise<void>) => () => void;
  showQuestion: (questionData: QuestionData) => Promise<string | null>;
  resolveQuestion: (answer: string | null) => void;
  addCollectedQuestionVar: (name: string, value: string) => void;
  resetQuestionState: () => void;
}

const CascadeRunContext = createContext<CascadeRunContextValue | null>(null);

export const useCascadeRun = (): CascadeRunContextValue => {
  const context = useContext(CascadeRunContext);
  if (!context) {
    throw new Error('useCascadeRun must be used within a CascadeRunProvider');
  }
  return context;
};

interface CascadeRunProviderProps {
  children: ReactNode;
}

export const CascadeRunProvider: React.FC<CascadeRunProviderProps> = ({ children }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [totalLevels, setTotalLevels] = useState(0);
  const [currentPromptName, setCurrentPromptName] = useState('');
  const [currentPromptRowId, setCurrentPromptRowId] = useState<string | null>(null);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [totalPrompts, setTotalPrompts] = useState(0);
  const [completedPrompts, setCompletedPrompts] = useState<CompletedPrompt[]>([]);
  const [skippedPrompts, setSkippedPrompts] = useState<SkippedPrompt[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorPrompt, setErrorPrompt] = useState<ErrorPrompt | null>(null);
  
  // Single run state (for non-cascade runs)
  const [singleRunPromptId, setSingleRunPromptId] = useState<string | null>(null);
  
  // Action preview state (for showing ActionPreviewDialog)
  const [actionPreview, setActionPreview] = useState<ActionPreviewData | null>(null);
  
  // Skip all previews state (for bypassing all action previews during cascade)
  const [skipAllPreviews, setSkipAllPreviews] = useState(false);
  
  // Question prompt state (for run-mode question interrupts)
  const [pendingQuestion, setPendingQuestion] = useState<QuestionData | null>(null);
  const [questionProgress, setQuestionProgress] = useState<QuestionProgress>({ current: 0, max: 10 });
  const [collectedQuestionVars, setCollectedQuestionVars] = useState<CollectedQuestionVar[]>([]);
  
  const cancelRef = useRef(false);
  const pauseRef = useRef(false);
  const errorResolverRef = useRef<((action: ErrorAction) => void) | null>(null);
  const actionPreviewResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const questionResolverRef = useRef<((answer: string | null) => void) | null>(null);
  
  // Cancel handler ref for true OpenAI cancellation
  const cancelHandlerRef = useRef<(() => Promise<void>) | null>(null);

  const startCascade = useCallback((levels: number, promptCount: number, skippedCount = 0) => {
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

  const markPromptSkipped = useCallback((promptRowId: string, promptName: string) => {
    setSkippedPrompts(prev => [...prev, { promptRowId, promptName }]);
  }, []);

  const updateProgress = useCallback((level: number, promptName: string, promptIndex: number, promptRowId: string | null = null) => {
    setCurrentLevel(level);
    setCurrentPromptName(promptName);
    setCurrentPromptIndex(promptIndex);
    if (promptRowId) setCurrentPromptRowId(promptRowId);
  }, []);

  const markPromptComplete = useCallback((promptRowId: string, promptName: string, response: string) => {
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
  const registerCancelHandler = useCallback((handler: () => Promise<void>) => {
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

  const showError = useCallback((promptData: ErrorPrompt, errorMessage: string): Promise<ErrorAction> => {
    setError(errorMessage);
    setErrorPrompt(promptData);
    
    return new Promise((resolve) => {
      errorResolverRef.current = resolve;
    });
  }, []);

  const resolveError = useCallback((action: ErrorAction) => {
    setError(null);
    setErrorPrompt(null);
    if (errorResolverRef.current) {
      errorResolverRef.current(action);
      errorResolverRef.current = null;
    }
  }, []);

  // Action preview functions (for ActionPreviewDialog)
  const showActionPreview = useCallback((previewData: ActionPreviewData): Promise<boolean> => {
    setActionPreview(previewData);
    return new Promise((resolve) => {
      actionPreviewResolverRef.current = resolve;
    });
  }, []);

  const resolveActionPreview = useCallback((confirmed: boolean) => {
    setActionPreview(null);
    if (actionPreviewResolverRef.current) {
      actionPreviewResolverRef.current(confirmed);
      actionPreviewResolverRef.current = null;
    }
  }, []);

  // Single run functions (for non-cascade runs)
  const startSingleRun = useCallback((promptRowId: string) => {
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
  const showQuestion = useCallback((questionData: QuestionData): Promise<string | null> => {
    setPendingQuestion(questionData);
    setQuestionProgress(prev => ({ 
      current: prev.current + 1, 
      max: questionData.maxQuestions || prev.max 
    }));
    return new Promise((resolve) => {
      questionResolverRef.current = resolve;
    });
  }, []);

  const resolveQuestion = useCallback((answer: string | null) => {
    // answer is string if user submitted, null if cancelled
    setPendingQuestion(null);
    if (questionResolverRef.current) {
      questionResolverRef.current(answer);
      questionResolverRef.current = null;
    }
  }, []);

  const addCollectedQuestionVar = useCallback((name: string, value: string) => {
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

  const value: CascadeRunContextValue = {
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
