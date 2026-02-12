// @ts-nocheck
import { useEffect, useRef } from 'react';
import { trackRenderPerformance } from '@/lib/posthog';

/**
 * Hook to track component render performance
 * Measures initial mount time and tracks slow re-renders
 * 
 * Includes defensive handling for Vite HMR edge cases where
 * React's internal state may be temporarily corrupted.
 */
export const useRenderPerformance = (componentName, options = {}) => {
  const { slowThresholdMs = 100, trackMountOnly = true } = options;
  
  // Defensive check for HMR corruption - React hooks may return null
  // during hot module replacement transitions
  let mountTimeRef, renderCountRef, hasTrackedMountRef;
  
  try {
    mountTimeRef = useRef(performance.now());
    renderCountRef = useRef(0);
    hasTrackedMountRef = useRef(false);
  } catch (e) {
    // HMR corruption - silently skip performance tracking this render
    console.warn('[useRenderPerformance] HMR state corruption detected, skipping tracking');
    return;
  }
  
  // Additional null check in case hooks returned without throwing
  if (!mountTimeRef || !renderCountRef || !hasTrackedMountRef) {
    return;
  }

  useEffect(() => {
    // Safety check - only track if function exists
    if (typeof trackRenderPerformance !== 'function') return;
    
    const renderTime = performance.now() - mountTimeRef.current;
    renderCountRef.current += 1;
    
    // Track initial mount
    if (!hasTrackedMountRef.current) {
      hasTrackedMountRef.current = true;
      trackRenderPerformance(componentName, Math.round(renderTime), {
        render_type: 'mount',
        render_count: renderCountRef.current,
      });
    } else if (!trackMountOnly && renderTime > slowThresholdMs) {
      // Track slow re-renders if configured
      trackRenderPerformance(componentName, Math.round(renderTime), {
        render_type: 're-render',
        render_count: renderCountRef.current,
        is_slow: true,
      });
    }
    
    // Reset for next render measurement
    mountTimeRef.current = performance.now();
  });
};

export default useRenderPerformance;
