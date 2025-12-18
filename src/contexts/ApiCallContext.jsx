import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// Default context with no-op functions for when used outside provider
const defaultContextValue = {
  isApiCallInProgress: false,
  pendingCallsCount: 0,
  registerCall: () => {
    const cleanup = () => {};
    cleanup.signal = undefined;
    cleanup.abort = () => {};
    return cleanup;
  },
  cancelAllCalls: () => {},
  backgroundCalls: [],
  addBackgroundCall: () => 0,
  removeBackgroundCall: () => {},
  showNavigationDialog: false,
  setShowNavigationDialog: () => {},
  pendingNavigation: null,
  confirmNavigation: () => {},
  cancelNavigation: () => {},
  navigateWithGuard: () => {},
};

const ApiCallContext = createContext(defaultContextValue);

export const useApiCallContext = () => useContext(ApiCallContext);

export const ApiCallProvider = ({ children }) => {
  const [pendingCallsCount, setPendingCallsCount] = useState(0);
  const [backgroundCalls, setBackgroundCalls] = useState([]);
  const [showNavigationDialog, setShowNavigationDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const abortControllersRef = useRef(new Map());
  const callIdRef = useRef(0);

  const registerCall = useCallback((onComplete) => {
    const callId = ++callIdRef.current;
    const abortController = new AbortController();

    abortControllersRef.current.set(callId, { abortController, onComplete });
    setPendingCallsCount((prev) => prev + 1);

    const cleanup = (wasCompleted = true) => {
      abortControllersRef.current.delete(callId);
      setPendingCallsCount((prev) => Math.max(0, prev - 1));

      if (typeof onComplete === 'function') {
        try {
          onComplete({ wasCompleted });
        } catch (e) {
          // ignore
        }
      }
    };

    // Attach abort signal to the cleanup function (backwards-compatible API)
    cleanup.signal = abortController.signal;
    cleanup.abort = () => abortController.abort();

    return cleanup;
  }, []);

  const cancelAllCalls = useCallback(() => {
    abortControllersRef.current.forEach(({ abortController }) => {
      abortController.abort();
    });
    abortControllersRef.current.clear();
    setPendingCallsCount(0);
  }, []);

  const addBackgroundCall = useCallback((callInfo) => {
    const id = ++callIdRef.current;
    setBackgroundCalls((prev) => [...prev, { id, ...callInfo }]);
    return id;
  }, []);

  const removeBackgroundCall = useCallback((id) => {
    setBackgroundCalls((prev) => prev.filter((call) => call.id !== id));
  }, []);

  const confirmNavigation = useCallback(() => {
    if (pendingNavigation) {
      const nav = pendingNavigation;
      setPendingNavigation(null);
      setShowNavigationDialog(false);
      // Execute the pending navigation
      nav();
    }
  }, [pendingNavigation]);

  const cancelNavigation = useCallback(() => {
    setPendingNavigation(null);
    setShowNavigationDialog(false);
  }, []);

  const navigateWithGuard = useCallback(
    (navigateFn) => {
      if (pendingCallsCount > 0) {
        setPendingNavigation(() => navigateFn);
        setShowNavigationDialog(true);
      } else {
        navigateFn();
      }
    },
    [pendingCallsCount]
  );

  const value = {
    isApiCallInProgress: pendingCallsCount > 0,
    pendingCallsCount,
    registerCall,
    cancelAllCalls,
    backgroundCalls,
    addBackgroundCall,
    removeBackgroundCall,
    showNavigationDialog,
    setShowNavigationDialog,
    pendingNavigation,
    confirmNavigation,
    cancelNavigation,
    navigateWithGuard,
  };

  return <ApiCallContext.Provider value={value}>{children}</ApiCallContext.Provider>;
};

