import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ApiCallContext = createContext({
  isApiCallInProgress: false,
  pendingCallsCount: 0,
  registerCall: () => () => {},
  cancelAllCalls: () => {},
  backgroundCalls: [],
  addBackgroundCall: () => {},
  removeBackgroundCall: () => {},
});

export const useApiCallContext = () => useContext(ApiCallContext);

export const ApiCallProvider = ({ children }) => {
  const [pendingCallsCount, setPendingCallsCount] = useState(0);
  const [backgroundCalls, setBackgroundCalls] = useState([]);
  const abortControllersRef = useRef(new Map());
  const callIdRef = useRef(0);

  const registerCall = useCallback((onComplete) => {
    const callId = ++callIdRef.current;
    const abortController = new AbortController();
    
    abortControllersRef.current.set(callId, { abortController, onComplete });
    setPendingCallsCount(prev => prev + 1);

    // Return cleanup function
    return (wasCompleted = true) => {
      abortControllersRef.current.delete(callId);
      setPendingCallsCount(prev => Math.max(0, prev - 1));
    };
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
    setBackgroundCalls(prev => [...prev, { id, ...callInfo }]);
    return id;
  }, []);

  const removeBackgroundCall = useCallback((id) => {
    setBackgroundCalls(prev => prev.filter(call => call.id !== id));
  }, []);

  const value = {
    isApiCallInProgress: pendingCallsCount > 0,
    pendingCallsCount,
    registerCall,
    cancelAllCalls,
    backgroundCalls,
    addBackgroundCall,
    removeBackgroundCall,
  };

  return (
    <ApiCallContext.Provider value={value}>
      {children}
    </ApiCallContext.Provider>
  );
};
