// @ts-nocheck
import React, { createContext, useContext, useRef, useCallback } from 'react';
import logger from '@/utils/logger';

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
    
    logger.debug(`[PendingSave] Flushing ${pending.length} pending save(s)...`);
    
    // Use Promise.allSettled to wait for all, even if some fail
    // Add a 30-second timeout as a safety net (increased from 10s for large operations)
    const TIMEOUT_MS = 30000;
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Pending saves timeout')), TIMEOUT_MS);
    });
    
    try {
      await Promise.race([
        Promise.allSettled(pending),
        timeout
      ]);
      clearTimeout(timeoutId);
      logger.debug('[PendingSave] All saves flushed successfully');
    } catch (err) {
      logger.warn('[PendingSave] Flush timed out or failed:', err.message);
      // Log which saves are still pending for debugging
      const stillPending = pendingSavesRef.current.size;
      if (stillPending > 0) {
        logger.warn(`[PendingSave] ${stillPending} save(s) still pending after timeout`);
      }
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
    logger.warn('usePendingSaves called outside PendingSaveProvider');
    return {
      registerSave: () => {},
      flushPendingSaves: async () => {},
    };
  }
  
  return context;
};

export default PendingSaveProvider;
