import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Loader2, 
  X, 
  Pause, 
  Play, 
  MoreHorizontal,
  FastForward,
  ChevronDown
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { useLiveApiDashboard } from '@/contexts/LiveApiDashboardContext';
import { useCascadeRun } from '@/contexts/CascadeRunContext';

/**
 * Unified Live API Dashboard - replaces both search bar and CascadeRunProgress.
 * Displays active API calls, cascade progress, and streaming thinking content.
 */
const LiveApiDashboard = () => {
  const { activeCalls, hasActiveCalls, cancelCall } = useLiveApiDashboard();
  const {
    isRunning: isCascadeRunning,
    isPaused,
    isCancelling,
    currentLevel,
    totalLevels,
    currentPromptName,
    completedPrompts,
    totalPrompts,
    skippedPrompts,
    startTime,
    cancel: cancelCascade,
    pause,
    resume,
    skipAllPreviews,
    setSkipAllPreviews,
  } = useCascadeRun();

  // Elapsed time state
  const [elapsedTimes, setElapsedTimes] = useState({});
  const [cascadeElapsed, setCascadeElapsed] = useState(0);
  const activeCallsRef = useRef([]);

  // Update ref when activeCalls changes (for stable timer)
  useEffect(() => {
    activeCallsRef.current = activeCalls;
  }, [activeCalls]);

  // Timer for elapsed times (stable interval)
  useEffect(() => {
    if (!hasActiveCalls && !isCascadeRunning) return;

    const interval = setInterval(() => {
      const now = Date.now();
      
      // Update per-call elapsed times
      setElapsedTimes(
        activeCallsRef.current.reduce((acc, call) => {
          acc[call.id] = Math.floor((now - call.startedAt.getTime()) / 1000);
          return acc;
        }, {})
      );
      
      // Update cascade elapsed time
      if (isCascadeRunning && startTime) {
        setCascadeElapsed(Math.floor((now - startTime) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [hasActiveCalls, isCascadeRunning, startTime]);

  // Format seconds to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine current mode
  const mode = isCascadeRunning ? 'cascade' : (hasActiveCalls ? 'single' : 'idle');
  const currentCall = activeCalls[0];
  const thinkingText = currentCall?.thinkingSummary || '';
  
  // Show "Thinking..." placeholder when status is in_progress but no thinking text yet
  const isThinking = currentCall?.status === 'in_progress' && !thinkingText;

  // Idle mode
  if (mode === 'idle') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full h-10 flex items-center gap-2 px-3 bg-surface-container-high rounded-m3-xl"
        style={{ height: '40px', borderRadius: '20px' }}
      >
        <Activity className="h-4 w-4 text-on-surface-variant" />
        <span className="text-body-sm text-on-surface-variant">No active API calls</span>
      </motion.div>
    );
  }

  // Cascade mode
  if (mode === 'cascade') {
    const progressText = `${completedPrompts.length}/${totalPrompts}`;
    
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full h-10 flex items-center gap-2 px-3 bg-surface-container-high rounded-m3-xl overflow-hidden"
        style={{ height: '40px', borderRadius: '20px' }}
      >
        {/* Status icon */}
        {isCancelling ? (
          <Loader2 className="h-4 w-4 animate-spin text-red-500 shrink-0" />
        ) : isPaused ? (
          <Pause className="h-4 w-4 text-amber-500 shrink-0" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
        )}

        {/* Progress badge */}
        <span className="text-body-sm text-primary font-medium shrink-0">
          Cascade {progressText}
        </span>

        <div className="h-4 w-px bg-outline-variant shrink-0" />

        {/* Current level and prompt */}
        <span className="text-[10px] text-on-surface-variant shrink-0">L{currentLevel}</span>
        <span className="text-body-sm text-on-surface truncate max-w-[120px]">
          {currentPromptName || 'Starting...'}
        </span>

        {/* Live thinking (if available) */}
        {(thinkingText || isThinking) && (
          <span className="text-[10px] text-on-surface-variant italic truncate max-w-[150px] opacity-70">
            {thinkingText 
              ? (thinkingText.length > 50 ? '...' + thinkingText.slice(-50) : thinkingText) 
              : 'Thinking...'}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Timer */}
        <span className="font-mono text-[11px] text-on-surface-variant shrink-0">
          {formatTime(cascadeElapsed)}
        </span>

        {/* Controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={isPaused ? resume : pause}
              disabled={isCancelling}
              className="w-7 h-7 flex items-center justify-center rounded-m3-full hover:bg-surface-container text-on-surface-variant disabled:opacity-50"
            >
              {isPaused ? (
                <Play className="h-3.5 w-3.5" />
              ) : (
                <Pause className="h-3.5 w-3.5" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">
            {isPaused ? 'Resume' : 'Pause'}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={cancelCascade}
              disabled={isCancelling}
              className="w-7 h-7 flex items-center justify-center rounded-m3-full hover:bg-surface-container text-red-500 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">Cancel cascade</TooltipContent>
        </Tooltip>

        {/* Options popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="w-7 h-7 flex items-center justify-center rounded-m3-full hover:bg-surface-container text-on-surface-variant">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-3 bg-surface-container-high border-outline-variant">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FastForward className={`h-4 w-4 ${skipAllPreviews ? 'text-primary' : 'text-on-surface-variant'}`} />
                <span className="text-body-sm text-on-surface">Skip previews</span>
              </div>
              <Switch
                checked={skipAllPreviews}
                onCheckedChange={setSkipAllPreviews}
              />
            </div>
            {skippedPrompts.length > 0 && (
              <div className="mt-2 pt-2 border-t border-outline-variant">
                <span className="text-[10px] text-on-surface-variant">
                  Skipped: {skippedPrompts.length}
                </span>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </motion.div>
    );
  }

  // Single run mode (or multiple single calls)
  const callCount = activeCalls.length;
  const elapsed = currentCall ? (elapsedTimes[currentCall.id] || 0) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full h-10 flex items-center gap-2 px-3 bg-surface-container-high rounded-m3-xl overflow-hidden"
      style={{ height: '40px', borderRadius: '20px' }}
    >
      {/* Spinning loader */}
      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />

      {/* Count badge */}
      <span className="text-body-sm text-primary font-medium shrink-0">
        {callCount} active
      </span>

      <div className="h-4 w-px bg-outline-variant shrink-0" />

      {/* First call info */}
      <span className="text-body-sm text-on-surface truncate max-w-[140px]">
        {currentCall?.promptName || 'Running...'}
      </span>
      
      {currentCall?.model && (
        <span className="text-[10px] text-on-surface-variant shrink-0">
          {currentCall.model}
        </span>
      )}

      {/* Live thinking */}
      {(thinkingText || isThinking) && (
        <span className="text-[10px] text-on-surface-variant italic truncate max-w-[150px] opacity-70">
          {thinkingText 
            ? (thinkingText.length > 50 ? '...' + thinkingText.slice(-50) : thinkingText) 
            : 'Thinking...'}
        </span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Timer */}
      <span className="font-mono text-[11px] text-on-surface-variant shrink-0">
        {formatTime(elapsed)}
      </span>

      {/* Cancel button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => currentCall && cancelCall(currentCall.id)}
            className="w-7 h-7 flex items-center justify-center rounded-m3-full hover:bg-surface-container text-on-surface-variant"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="text-[10px]">Cancel</TooltipContent>
      </Tooltip>

      {/* Multiple calls popover */}
      {callCount > 1 && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-on-surface-variant bg-surface-container rounded-m3-sm hover:bg-surface-container-highest">
              +{callCount - 1} more
              <ChevronDown className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-2 bg-surface-container-high border-outline-variant">
            <div className="space-y-1">
              {activeCalls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-m3-sm bg-surface-container"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-body-sm text-on-surface truncate">
                      {call.promptName}
                    </div>
                    <div className="text-[10px] text-on-surface-variant">
                      {call.model} • {formatTime(elapsedTimes[call.id] || 0)}
                    </div>
                  </div>
                  <button
                    onClick={() => cancelCall(call.id)}
                    className="w-6 h-6 flex items-center justify-center rounded-m3-full hover:bg-surface-container-highest text-on-surface-variant"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </motion.div>
  );
};

export default LiveApiDashboard;
