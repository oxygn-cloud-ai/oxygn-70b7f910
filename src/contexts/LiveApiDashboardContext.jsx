import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { estimateCost } from '@/utils/costEstimator';

const LiveApiDashboardContext = createContext(null);

// Debounce interval for output text updates (ms)
const OUTPUT_DEBOUNCE_MS = 120;
// Debounce interval for token increment batching (ms)
const TOKEN_FLUSH_MS = 200;

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
  
  // Ref to keep activeCalls accessible in stable callbacks
  const activeCallsRef = useRef(activeCalls);
  useEffect(() => {
    activeCallsRef.current = activeCalls;
  }, [activeCalls]);
  
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
  
  // Ref to accumulate pending token increments for batching
  const pendingTokensRef = useRef({});

  // Cleanup pending timeouts on unmount
  useEffect(() => {
    return () => {
      // Clear all pending output timeouts
      Object.keys(pendingOutputRef.current).forEach((key) => {
        if (key.endsWith('_timeout')) {
          clearTimeout(pendingOutputRef.current[key]);
        }
      });
      pendingOutputRef.current = {};
      
      // Clear all pending token timeouts
      Object.keys(pendingTokensRef.current).forEach((key) => {
        if (key.endsWith('_timeout')) {
          clearTimeout(pendingTokensRef.current[key]);
        }
      });
      pendingTokensRef.current = {};
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

  // Flush pending token increments for a specific call
  const flushPendingTokens = useCallback((callId) => {
    const key = String(callId);
    const pending = pendingTokensRef.current[key];
    
    if (!pending) return;
    
    const { tokens, firstTime, lastTime } = pending;
    delete pendingTokensRef.current[key];
    
    const timeoutKey = `${key}_timeout`;
    if (pendingTokensRef.current[timeoutKey]) {
      clearTimeout(pendingTokensRef.current[timeoutKey]);
      delete pendingTokensRef.current[timeoutKey];
    }
    
    if (tokens > 0) {
      setActiveCalls((prev) =>
        prev.map((c) => {
          if (c.id !== callId) return c;
          return {
            ...c,
            outputTokens: (c.outputTokens || 0) + tokens,
            tokenCount: (c.tokenCount || 0) + tokens,
            firstTokenAt: c.firstTokenAt || firstTime,
            lastTokenAt: lastTime,
          };
        })
      );
    }
  }, []);

  // Increment output tokens - BATCHED (called during streaming)
  const incrementOutputTokens = useCallback((id, tokenDelta = 1) => {
    const now = Date.now();
    const key = String(id);
    
    // Accumulate tokens
    if (!pendingTokensRef.current[key]) {
      pendingTokensRef.current[key] = { tokens: 0, firstTime: now, lastTime: now };
    }
    pendingTokensRef.current[key].tokens += tokenDelta;
    pendingTokensRef.current[key].lastTime = now;
    
    // Schedule flush (TOKEN_FLUSH_MS debounce)
    const timeoutKey = `${key}_timeout`;
    if (!pendingTokensRef.current[timeoutKey]) {
      pendingTokensRef.current[timeoutKey] = setTimeout(() => {
        flushPendingTokens(id);
      }, TOKEN_FLUSH_MS);
    }
  }, [flushPendingTokens]);

  // Remove a call from the dashboard and update cumulative stats
  const removeCall = useCallback((id) => {
    // Flush any pending output before removing (prevents lost final text)
    const key = String(id);
    const outputTimeoutKey = `${key}_timeout`;
    
    if (pendingOutputRef.current[outputTimeoutKey]) {
      clearTimeout(pendingOutputRef.current[outputTimeoutKey]);
      delete pendingOutputRef.current[outputTimeoutKey];
    }
    
    // Apply any accumulated output text before removing
    const pendingOutput = pendingOutputRef.current[key];
    if (pendingOutput) {
      delete pendingOutputRef.current[key];
      setActiveCalls((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, outputText: (c.outputText || '') + pendingOutput }
            : c
        )
      );
    }
    
    // Flush and clean up pending token increments
    flushPendingTokens(id);
    
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
  }, [flushPendingTokens]);

  // Reset cumulative stats (call when cascade starts)
  const resetCumulativeStats = useCallback(() => {
    setCumulativeStats({ inputTokens: 0, outputTokens: 0, totalCost: 0, callCount: 0 });
  }, []);

  // Cancel a specific call - uses ref to avoid dependency on activeCalls
  const cancelCall = useCallback(
    async (id) => {
      const call = activeCallsRef.current.find((c) => c.id === id);
      if (call?.cancelFn) {
        try {
          await call.cancelFn();
        } catch (e) {
          console.warn('Cancel call failed:', e);
        }
      }
      removeCall(id);
    },
    [removeCall]
  );

  // Memoize context value to prevent consumer re-renders when nothing changed
  const value = useMemo(() => ({
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
  }), [
    activeCalls,
    cumulativeStats,
    addCall,
    updateCall,
    updateResolvedSettings,
    appendThinking,
    appendOutputText,
    incrementOutputTokens,
    removeCall,
    cancelCall,
    resetCumulativeStats,
  ]);

  return (
    <LiveApiDashboardContext.Provider value={value}>
      {children}
    </LiveApiDashboardContext.Provider>
  );
};

export default LiveApiDashboardContext;
