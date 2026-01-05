import React, { createContext, useContext, useRef, useCallback } from 'react';

const PendingSaveContext = createContext(null);

/**
 * Provider that tracks pending save operations across the app.
 * This enables callers (like handleRunPrompt) to wait for all in-flight 
 * saves to complete before proceeding with actions that depend on fresh DB data.
 */
export const PendingSaveProvider = ({ children }) => {
  // Use ref to avoid re-renders when saves are registered/completed
  const pendingSavesRef = useRef(new Set());
  
  /**
   * Register a save promise for tracking.
   * The promise will auto-remove from the set when it settles.
   * @param {Promise} savePromise - The promise returned by the save operation
   */
  const registerSave = useCallback((savePromise) => {
    if (!savePromise || typeof savePromise.then !== 'function') {
      // Not a promise, ignore
      return;
    }
    
    pendingSavesRef.current.add(savePromise);
    
    // Auto-cleanup when promise settles (success or failure)
    savePromise.finally(() => {
      pendingSavesRef.current.delete(savePromise);
    });
  }, []);
  
  /**
   * Wait for all pending saves to complete.
   * Uses Promise.allSettled to handle both successes and failures.
   * Includes a safety timeout to prevent infinite waiting.
   * @returns {Promise<void>}
   */
  const flushPendingSaves = useCallback(async () => {
    const pending = Array.from(pendingSavesRef.current);
    
    if (pending.length === 0) {
      return;
    }
    
    console.log(`[PendingSave] Flushing ${pending.length} pending save(s)...`);
    
    // Use Promise.allSettled to wait for all, even if some fail
    // Add a 10-second timeout as a safety net
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Pending saves timeout')), 10000)
    );
    
    try {
      await Promise.race([
        Promise.allSettled(pending),
        timeout
      ]);
      console.log(`[PendingSave] All saves flushed successfully`);
    } catch (err) {
      console.warn('[PendingSave] Flush timed out or failed:', err.message);
      // Continue anyway - don't block the run forever
    }
  }, []);
  
  return (
    <PendingSaveContext.Provider value={{ registerSave, flushPendingSaves }}>
      {children}
    </PendingSaveContext.Provider>
  );
};

/**
 * Hook to access the pending save registry.
 * Returns { registerSave, flushPendingSaves }
 */
export const usePendingSaves = () => {
  const context = useContext(PendingSaveContext);
  
  if (!context) {
    // Fallback for components outside provider - return no-op functions
    console.warn('usePendingSaves called outside PendingSaveProvider');
    return {
      registerSave: () => {},
      flushPendingSaves: async () => {},
    };
  }
  
  return context;
};

export default PendingSaveProvider;
