import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

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
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [totalPrompts, setTotalPrompts] = useState(0);
  const [completedPrompts, setCompletedPrompts] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [error, setError] = useState(null);
  const [errorPrompt, setErrorPrompt] = useState(null);
  
  const cancelRef = useRef(false);
  const pauseRef = useRef(false);
  const errorResolverRef = useRef(null);

  const startCascade = useCallback((levels, promptCount) => {
    setIsRunning(true);
    setIsPaused(false);
    setCurrentLevel(0);
    setTotalLevels(levels);
    setCurrentPromptName('');
    setCurrentPromptIndex(0);
    setTotalPrompts(promptCount);
    setCompletedPrompts([]);
    setStartTime(Date.now());
    setError(null);
    setErrorPrompt(null);
    cancelRef.current = false;
    pauseRef.current = false;
  }, []);

  const updateProgress = useCallback((level, promptName, promptIndex) => {
    setCurrentLevel(level);
    setCurrentPromptName(promptName);
    setCurrentPromptIndex(promptIndex);
  }, []);

  const markPromptComplete = useCallback((promptRowId, promptName, response) => {
    setCompletedPrompts(prev => [...prev, { promptRowId, promptName, response }]);
  }, []);

  const completeCascade = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    setCurrentPromptName('');
    cancelRef.current = false;
    pauseRef.current = false;
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    setIsRunning(false);
    setIsPaused(false);
    // Resolve any pending error dialog with 'stop'
    if (errorResolverRef.current) {
      errorResolverRef.current('stop');
      errorResolverRef.current = null;
    }
  }, []);

  const pause = useCallback(() => {
    pauseRef.current = true;
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    pauseRef.current = false;
    setIsPaused(false);
  }, []);

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

  const value = {
    // State
    isRunning,
    isPaused,
    currentLevel,
    totalLevels,
    currentPromptName,
    currentPromptIndex,
    totalPrompts,
    completedPrompts,
    startTime,
    error,
    errorPrompt,
    
    // Actions
    startCascade,
    updateProgress,
    markPromptComplete,
    completeCascade,
    cancel,
    pause,
    resume,
    isCancelled,
    checkPaused,
    showError,
    resolveError,
  };

  return (
    <CascadeRunContext.Provider value={value}>
      {children}
    </CascadeRunContext.Provider>
  );
};

export default CascadeRunContext;
