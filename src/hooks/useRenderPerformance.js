import * as React from 'react';
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
  // Early return if React hooks aren't available (prevents crashes during module loading)
  if (!React || typeof React.useRef !== 'function') {
    return;
  }

  const { slowThresholdMs = 100, trackMountOnly = true } = options;
  
  // Always call hooks unconditionally to follow Rules of Hooks
  const mountTimeRef = React.useRef(performance.now());
  const renderCountRef = React.useRef(0);
  const hasTrackedMountRef = React.useRef(false);

  React.useEffect(() => {
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
