// @ts-nocheck
import { useCallback, useRef, useEffect } from 'react';

/**
 * Hook to enable auto-scrolling when dragging near container edges
 * @param {Object} options
 * @param {number} options.edgeThreshold - Distance from edge to trigger scroll (default: 50px)
 * @param {number} options.scrollSpeed - Max scroll speed in px/frame (default: 8)
 */
export function useDragAutoScroll({ edgeThreshold = 50, scrollSpeed = 8 } = {}) {
  const scrollContainerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isDraggingRef = useRef(false);
  const mouseYRef = useRef(0);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || !isDraggingRef.current) {
      animationFrameRef.current = null;
      return;
    }

    const rect = container.getBoundingClientRect();
    const mouseY = mouseYRef.current;
    
    // Calculate distance from edges
    const distanceFromTop = mouseY - rect.top;
    const distanceFromBottom = rect.bottom - mouseY;
    
    let scrollDelta = 0;
    
    if (distanceFromTop < edgeThreshold && distanceFromTop > 0) {
      // Near top edge - scroll up
      const intensity = 1 - (distanceFromTop / edgeThreshold);
      scrollDelta = -scrollSpeed * intensity * intensity; // Quadratic easing
    } else if (distanceFromBottom < edgeThreshold && distanceFromBottom > 0) {
      // Near bottom edge - scroll down
      const intensity = 1 - (distanceFromBottom / edgeThreshold);
      scrollDelta = scrollSpeed * intensity * intensity; // Quadratic easing
    }
    
    if (scrollDelta !== 0) {
      container.scrollTop += scrollDelta;
    }
    
    // Continue animation loop while dragging
    if (isDraggingRef.current) {
      animationFrameRef.current = requestAnimationFrame(handleScroll);
    }
  }, [edgeThreshold, scrollSpeed]);

  const handleDragOver = useCallback((e) => {
    mouseYRef.current = e.clientY;
    
    if (!animationFrameRef.current && isDraggingRef.current) {
      animationFrameRef.current = requestAnimationFrame(handleScroll);
    }
  }, [handleScroll]);

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Attach global listeners for drag events
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Listen for native drag events on the document
    const onDragStart = () => handleDragStart();
    const onDragEnd = () => handleDragEnd();
    const onDrop = () => handleDragEnd();
    
    document.addEventListener('dragstart', onDragStart);
    document.addEventListener('dragend', onDragEnd);
    document.addEventListener('drop', onDrop);
    
    return () => {
      document.removeEventListener('dragstart', onDragStart);
      document.removeEventListener('dragend', onDragEnd);
      document.removeEventListener('drop', onDrop);
    };
  }, [handleDragStart, handleDragEnd]);

  return {
    scrollContainerRef,
    scrollContainerProps: {
      onDragOver: handleDragOver,
    },
  };
}
