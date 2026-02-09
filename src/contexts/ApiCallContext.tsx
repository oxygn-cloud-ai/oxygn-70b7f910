import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

interface BackgroundCall {
  id: number;
  [key: string]: unknown;
}

interface ApiCallContextValue {
  isApiCallInProgress: boolean;
  pendingCallsCount: number;
  registerCall: () => () => void;
  cancelAllCalls: () => void;
  backgroundCalls: BackgroundCall[];
  addBackgroundCall: (callInfo: Omit<BackgroundCall, 'id'>) => number;
  removeBackgroundCall: (id: number) => void;
  showNavigationDialog: boolean;
  pendingDestination: string | null;
  requestNavigation: (destination: string, navigateFn: () => void) => boolean;
  confirmNavigation: () => void;
  cancelNavigation: () => void;
}

const ApiCallContext = createContext<ApiCallContextValue | null>(null);

export const useApiCallContext = (): ApiCallContextValue => {
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

interface ApiCallProviderProps {
  children: ReactNode;
}

export const ApiCallProvider: React.FC<ApiCallProviderProps> = ({ children }) => {
  const [pendingCallsCount, setPendingCallsCount] = useState(0);
  const [backgroundCalls, setBackgroundCalls] = useState<BackgroundCall[]>([]);
  const [showNavigationDialog, setShowNavigationDialog] = useState(false);
  const [pendingDestination, setPendingDestination] = useState<string | null>(null);
  const pendingNavigateRef = useRef<(() => void) | null>(null);
  const callIdRef = useRef(0);

  // Register an active API call. Returns a cleanup function.
  const registerCall = useCallback(() => {
    callIdRef.current += 1;
    setPendingCallsCount((prev) => prev + 1);

    const cleanup = () => {
      setPendingCallsCount((prev) => Math.max(0, prev - 1));
    };

    return cleanup;
  }, []);

  const cancelAllCalls = useCallback(() => {
    setPendingCallsCount(0);
  }, []);

  const addBackgroundCall = useCallback((callInfo: Omit<BackgroundCall, 'id'>) => {
    const id = ++callIdRef.current;
    setBackgroundCalls((prev) => [...prev, { id, ...callInfo }]);
    return id;
  }, []);

  const removeBackgroundCall = useCallback((id: number) => {
    setBackgroundCalls((prev) => prev.filter((call) => call.id !== id));
  }, []);

  /**
   * Request navigation to a destination.
   * If calls are in progress, shows dialog and returns false.
   * If no calls, executes navigate immediately and returns true.
   */
  const requestNavigation = useCallback(
    (destination: string, navigateFn: () => void) => {
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

  const value: ApiCallContextValue = {
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
