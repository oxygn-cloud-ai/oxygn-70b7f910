import { useEffect, useRef } from 'react';
import { trackRenderPerformance } from '@/lib/posthog';

/**
 * Hook to track component render performance
 * Measures initial mount time and tracks slow re-renders
 * 
 * @param {string} componentName - Name of the component being tracked
 * @param {object} options - Configuration options
 * @param {number} options.slowThresholdMs - Threshold for logging slow renders (default: 100ms)
 * @param {boolean} options.trackMountOnly - Only track initial mount, not re-renders (default: true)
 */
export const useRenderPerformance = (componentName, options = {}) => {
  const { slowThresholdMs = 100, trackMountOnly = true } = options;
  
  // Defensive: ensure React hooks are available (can fail during HMR or SSR)
  let mountTimeRef, renderCountRef, hasTrackedMountRef;
  try {
    mountTimeRef = useRef(performance.now());
    renderCountRef = useRef(0);
    hasTrackedMountRef = useRef(false);
  } catch (e) {
    // React not fully initialized, skip tracking
    console.warn('useRenderPerformance: React hooks not available, skipping', e);
    return;
  }

  useEffect(() => {
    if (!mountTimeRef?.current) return;
    
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
