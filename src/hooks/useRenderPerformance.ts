import { useEffect, useRef } from 'react';
import { trackRenderPerformance } from '@/lib/posthog';

interface RenderPerformanceOptions {
  slowThresholdMs?: number;
  trackMountOnly?: boolean;
}

/**
 * Hook to track component render performance
 * Measures initial mount time and tracks slow re-renders
 * 
 * Includes defensive handling for Vite HMR edge cases where
 * React's internal state may be temporarily corrupted.
 */
export const useRenderPerformance = (
  componentName: string, 
  options: RenderPerformanceOptions = {}
): void => {
  const { slowThresholdMs = 100, trackMountOnly = true } = options;
  
  const mountTimeRef = useRef<number>(performance.now());
  const renderCountRef = useRef<number>(0);
  const hasTrackedMountRef = useRef<boolean>(false);

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
