import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ApiCallContext = createContext(null);

export const useApiCallContext = () => {
  const ctx = useContext(ApiCallContext);
  // Return safe defaults if used outside provider
  if (!ctx) {
    return {
      isApiCallInProgress: false,
      pendingCallsCount: 0,
      registerCall: () => () => {},
      cancelAllCalls: () => {},
      backgroundCalls: [],
      addBackgroundCall: () => 0,
      removeBackgroundCall: () => {},
      showNavigationDialog: false,
      pendingDestination: null,
      requestNavigation: () => false,
      confirmNavigation: () => {},
      cancelNavigation: () => {},
    };
  }
  return ctx;
};

export const ApiCallProvider = ({ children }) => {
  const [pendingCallsCount, setPendingCallsCount] = useState(0);
  const [backgroundCalls, setBackgroundCalls] = useState([]);
  const [showNavigationDialog, setShowNavigationDialog] = useState(false);
  const [pendingDestination, setPendingDestination] = useState(null);
  const pendingNavigateRef = useRef(null);
  const callIdRef = useRef(0);

  // Register an active API call. Returns a cleanup function.
  const registerCall = useCallback(() => {
    const callId = ++callIdRef.current;
    setPendingCallsCount((prev) => prev + 1);

    const cleanup = () => {
      setPendingCallsCount((prev) => Math.max(0, prev - 1));
    };

    return cleanup;
  }, []);

  const cancelAllCalls = useCallback(() => {
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

  /**
   * Request navigation to a destination.
   * If calls are in progress, shows dialog and returns false.
   * If no calls, executes navigate immediately and returns true.
   */
  const requestNavigation = useCallback(
    (destination, navigateFn) => {
      if (pendingCallsCount > 0) {
        setPendingDestination(destination);
        pendingNavigateRef.current = navigateFn;
        setShowNavigationDialog(true);
        return false;
      }
      // No calls in progress, navigate immediately
      navigateFn();
      return true;
    },
    [pendingCallsCount]
  );

  const confirmNavigation = useCallback(() => {
    setShowNavigationDialog(false);
    const nav = pendingNavigateRef.current;
    setPendingDestination(null);
    pendingNavigateRef.current = null;
    if (nav) nav();
  }, []);

  const cancelNavigation = useCallback(() => {
    setShowNavigationDialog(false);
    setPendingDestination(null);
    pendingNavigateRef.current = null;
  }, []);

  const value = {
    isApiCallInProgress: pendingCallsCount > 0,
    pendingCallsCount,
    registerCall,
    cancelAllCalls,
    backgroundCalls,
    addBackgroundCall,
    removeBackgroundCall,
    showNavigationDialog,
    pendingDestination,
    requestNavigation,
    confirmNavigation,
    cancelNavigation,
  };

  return <ApiCallContext.Provider value={value}>{children}</ApiCallContext.Provider>;
};
