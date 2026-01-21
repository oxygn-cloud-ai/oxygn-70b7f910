import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { estimateCost } from '@/utils/costEstimator';

const LiveApiDashboardContext = createContext(null);

// Debounce interval for output text updates (ms)
const OUTPUT_DEBOUNCE_MS = 100;

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
      updateResolvedSettings: () => {},
      appendThinking: () => {},
      appendOutputText: () => {},
      incrementOutputTokens: () => {},
      removeCall: () => {},
      cancelCall: () => {},
      // Cumulative stats for cascade mode
      cumulativeStats: { inputTokens: 0, outputTokens: 0, totalCost: 0, callCount: 0 },
      resetCumulativeStats: () => {},
    };
  }
  return ctx;
};

/**
 * Provider for tracking active API calls with detailed status.
 * Includes token tracking, cost estimation, and streaming speed metrics.
 */
export const LiveApiDashboardProvider = ({ children }) => {
  const [activeCalls, setActiveCalls] = useState([]);
  const callIdRef = useRef(0);
  
  // Cumulative stats for cascade mode
  const [cumulativeStats, setCumulativeStats] = useState({
    inputTokens: 0,
    outputTokens: 0,
    totalCost: 0,
    callCount: 0,
  });

  // Add a new call to the dashboard with extended metrics
  const addCall = useCallback((callInfo) => {
    const id = ++callIdRef.current;
    const newCall = {
      id,
      status: 'queued',
      startedAt: new Date(),
      thinkingSummary: '',
      outputText: '',
      responseId: null,
      isCascadeCall: false,
      // Token tracking
      estimatedInputTokens: callInfo.estimatedInputTokens || 0,
      outputTokens: 0,
      // Speed tracking
      firstTokenAt: null,
      lastTokenAt: null,
      tokenCount: 0, // For calculating tokens per second
      // Cost tracking (will be calculated from model pricing)
      estimatedCost: 0,
      // Context window
      contextWindow: callInfo.contextWindow || 128000, // Default to 128k
      // Resolved settings (populated via settings_resolved SSE event)
      resolvedSettings: null,
      resolvedTools: null,
      // Manus-specific fields
      provider: callInfo.provider || 'openai',
      manusTaskId: callInfo.manusTaskId || null,
      manusTaskUrl: callInfo.manusTaskUrl || null,
      manusProgress: callInfo.manusProgress || null,
      ...callInfo,
    };
    setActiveCalls((prev) => [...prev, newCall]);
    return id;
  }, []);

  // Update resolved settings from SSE event
  const updateResolvedSettings = useCallback((id, settings, tools) => {
    setActiveCalls((prev) =>
      prev.map((c) => (c.id === id ? { 
        ...c, 
        resolvedSettings: settings,
        resolvedTools: tools,
        model: settings?.model || c.model, // Update model from resolved settings
      } : c))
    );
  }, []);

  // Update call properties
  const updateCall = useCallback((id, updates) => {
    setActiveCalls((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }, []);

  // Append thinking text delta
  const appendThinking = useCallback((id, delta) => {
    if (!delta) return; // Guard against null/undefined
    // Guard against objects being passed as delta - only accept strings
    if (typeof delta !== 'string') {
      console.warn('appendThinking received non-string delta:', typeof delta, delta);
      return;
    }
    setActiveCalls((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, thinkingSummary: (c.thinkingSummary || '') + delta }
          : c
      )
    );
  }, []);

  // Ref to accumulate pending output text deltas for debouncing
  const pendingOutputRef = useRef({});

  // Cleanup pending timeouts on unmount
  useEffect(() => {
    return () => {
      // Clear all pending timeouts
      Object.keys(pendingOutputRef.current).forEach((key) => {
        if (key.endsWith('_timeout')) {
          clearTimeout(pendingOutputRef.current[key]);
        }
      });
    };
  }, []);

  // Append output text delta (streaming main response) - debounced
  const appendOutputText = useCallback((id, delta) => {
    if (!delta) return; // Guard against null/undefined
    // Guard against objects being passed as delta - only accept strings
    if (typeof delta !== 'string') {
      console.warn('appendOutputText received non-string delta:', typeof delta, delta);
      return;
    }
    
    // Accumulate to ref for debouncing
    const key = String(id);
    pendingOutputRef.current[key] = (pendingOutputRef.current[key] || '') + delta;
    
    // Debounced flush every OUTPUT_DEBOUNCE_MS
    const timeoutKey = `${key}_timeout`;
    if (!pendingOutputRef.current[timeoutKey]) {
      pendingOutputRef.current[timeoutKey] = setTimeout(() => {
        const accumulated = pendingOutputRef.current[key] || '';
        delete pendingOutputRef.current[key];
        delete pendingOutputRef.current[timeoutKey];
        
        if (accumulated) {
          setActiveCalls((prev) =>
            prev.map((c) =>
              c.id === id
                ? { ...c, outputText: (c.outputText || '') + accumulated }
                : c
            )
          );
        }
      }, OUTPUT_DEBOUNCE_MS);
    }
  }, []);

  // Increment output tokens (called during streaming)
  const incrementOutputTokens = useCallback((id, tokenDelta = 1) => {
    const now = Date.now();
    setActiveCalls((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          outputTokens: (c.outputTokens || 0) + tokenDelta,
          tokenCount: (c.tokenCount || 0) + tokenDelta,
          firstTokenAt: c.firstTokenAt || now,
          lastTokenAt: now,
        };
      })
    );
  }, []);

  // Remove a call from the dashboard and update cumulative stats
  const removeCall = useCallback((id) => {
    // Clean up any pending output flush for this call
    const key = String(id);
    const timeoutKey = `${key}_timeout`;
    if (pendingOutputRef.current[timeoutKey]) {
      clearTimeout(pendingOutputRef.current[timeoutKey]);
      delete pendingOutputRef.current[key];
      delete pendingOutputRef.current[timeoutKey];
    }
    
    setActiveCalls((prev) => {
      const call = prev.find((c) => c.id === id);
      if (call && call.isCascadeCall) {
        // Calculate cost from actual token counts using model pricing
        const callCost = estimateCost({
          model: call.model,
          inputTokens: call.estimatedInputTokens || 0,
          outputTokens: call.outputTokens || 0,
        });
        
        // Add to cumulative stats when cascade call completes
        setCumulativeStats((stats) => ({
          inputTokens: stats.inputTokens + (call.estimatedInputTokens || 0),
          outputTokens: stats.outputTokens + (call.outputTokens || 0),
          totalCost: stats.totalCost + callCost,
          callCount: stats.callCount + 1,
        }));
      }
      return prev.filter((c) => c.id !== id);
    });
  }, []);

  // Reset cumulative stats (call when cascade starts)
  const resetCumulativeStats = useCallback(() => {
    setCumulativeStats({ inputTokens: 0, outputTokens: 0, totalCost: 0, callCount: 0 });
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
    updateResolvedSettings,
    appendThinking,
    appendOutputText,
    incrementOutputTokens,
    removeCall,
    cancelCall,
    cumulativeStats,
    resetCumulativeStats,
  };

  return (
    <LiveApiDashboardContext.Provider value={value}>
      {children}
    </LiveApiDashboardContext.Provider>
  );
};

export default LiveApiDashboardContext;
