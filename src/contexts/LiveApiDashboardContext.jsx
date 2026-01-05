import { createContext, useContext, useState, useCallback, useRef } from 'react';

const LiveApiDashboardContext = createContext(null);

/**
 * Hook to access the LiveApiDashboard context.
 * Returns safe defaults if used outside provider (for gradual migration).
 */
export const useLiveApiDashboard = () => {
  const ctx = useContext(LiveApiDashboardContext);
  if (!ctx) {
    // Safe defaults if used outside provider
    return {
      activeCalls: [],
      hasActiveCalls: false,
      addCall: () => 0,
      updateCall: () => {},
      appendThinking: () => {},
      removeCall: () => {},
      cancelCall: () => {},
    };
  }
  return ctx;
};

/**
 * Provider for tracking active API calls with detailed status.
 * Replaces the old navigation guard dialog with a live dashboard.
 */
export const LiveApiDashboardProvider = ({ children }) => {
  const [activeCalls, setActiveCalls] = useState([]);
  const callIdRef = useRef(0);

  // Add a new call to the dashboard
  const addCall = useCallback((callInfo) => {
    const id = ++callIdRef.current;
    const newCall = {
      id,
      status: 'queued',
      startedAt: new Date(),
      thinkingSummary: '',
      responseId: null,
      isCascadeCall: false,
      ...callInfo,
    };
    setActiveCalls((prev) => [...prev, newCall]);
    return id;
  }, []);

  // Update call properties
  const updateCall = useCallback((id, updates) => {
    setActiveCalls((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }, []);

  // Append thinking text delta
  const appendThinking = useCallback((id, delta) => {
    setActiveCalls((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, thinkingSummary: (c.thinkingSummary || '') + delta }
          : c
      )
    );
  }, []);

  // Remove a call from the dashboard
  const removeCall = useCallback((id) => {
    setActiveCalls((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Cancel a specific call
  const cancelCall = useCallback(
    async (id) => {
      const call = activeCalls.find((c) => c.id === id);
      if (call?.cancelFn) {
        try {
          await call.cancelFn();
        } catch (e) {
          console.warn('Cancel call failed:', e);
        }
      }
      removeCall(id);
    },
    [activeCalls, removeCall]
  );

  const value = {
    activeCalls,
    hasActiveCalls: activeCalls.length > 0,
    addCall,
    updateCall,
    appendThinking,
    removeCall,
    cancelCall,
  };

  return (
    <LiveApiDashboardContext.Provider value={value}>
      {children}
    </LiveApiDashboardContext.Provider>
  );
};

export default LiveApiDashboardContext;
