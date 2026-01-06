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
  ChevronDown,
  Zap,
  Brain,
  TrendingUp,
  Maximize2
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { useLiveApiDashboard } from '@/contexts/LiveApiDashboardContext';
import { useCascadeRun } from '@/contexts/CascadeRunContext';
import LiveApiDashboardDetails from './LiveApiDashboardDetails';
import ReasoningStreamPopup from './ReasoningStreamPopup';
import { formatTokenCount, calculateContextUsage } from '@/utils/tokenizer';
import { formatCost, formatTokensPerSecond, calculateTokensPerSecond, estimateCost } from '@/utils/costEstimator';

/**
 * Unified Live API Dashboard - displays active API calls, cascade progress, 
 * and streaming reasoning content with full-width scrollable display.
 */
const LiveApiDashboard = () => {
  const { activeCalls, hasActiveCalls, cancelCall, cumulativeStats } = useLiveApiDashboard();
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

  // State
  const [elapsedTimes, setElapsedTimes] = useState({});
  const [cascadeElapsed, setCascadeElapsed] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reasoningPopupOpen, setReasoningPopupOpen] = useState(false);
  
  // Refs
  const activeCallsRef = useRef([]);
  const reasoningScrollRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  // Update ref when activeCalls changes
  useEffect(() => {
    activeCallsRef.current = activeCalls;
  }, [activeCalls]);

  // Timer for elapsed times
  useEffect(() => {
    if (!hasActiveCalls && !isCascadeRunning) return;

    const interval = setInterval(() => {
      const now = Date.now();
      
      setElapsedTimes(
        activeCallsRef.current.reduce((acc, call) => {
          acc[call.id] = Math.floor((now - call.startedAt.getTime()) / 1000);
          return acc;
        }, {})
      );
      
      if (isCascadeRunning && startTime) {
        setCascadeElapsed(Math.floor((now - startTime) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [hasActiveCalls, isCascadeRunning, startTime]);

  // Current call data
  const currentCall = activeCalls[0];
  const thinkingText = currentCall?.thinkingSummary || '';
  const outputText = currentCall?.outputText || '';
  const hasOutput = outputText.length > 0;
  const hasReasoning = thinkingText.length > 0;
  
  // Debounced auto-scroll for reasoning text
  useEffect(() => {
    if (!thinkingText || !reasoningScrollRef.current) return;
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      reasoningScrollRef.current?.scrollTo({
        left: reasoningScrollRef.current.scrollWidth,
        behavior: 'smooth'
      });
    }, 100);
    
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [thinkingText]);

  // Calculate live metrics
  const tokensPerSecond = currentCall ? calculateTokensPerSecond(
    currentCall.tokenCount,
    currentCall.firstTokenAt,
    currentCall.lastTokenAt
  ) : 0;
  
  const liveEstimatedCost = currentCall ? estimateCost({
    model: currentCall.model,
    inputTokens: currentCall.estimatedInputTokens || 0,
    outputTokens: currentCall.outputTokens || 0,
  }) : 0;
  
  const isThinking = currentCall?.status === 'in_progress' && !thinkingText && !hasOutput;

  // Format seconds to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine current mode
  const mode = isCascadeRunning ? 'cascade' : (hasActiveCalls ? 'single' : 'idle');

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
    const totalTokens = cumulativeStats.inputTokens + cumulativeStats.outputTokens + 
      (currentCall?.estimatedInputTokens || 0) + (currentCall?.outputTokens || 0);
    const totalCost = cumulativeStats.totalCost + liveEstimatedCost;
    
    return (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full bg-surface-container-high rounded-m3-xl overflow-hidden"
          style={{ borderRadius: '20px' }}
        >
          {/* Main row - always 40px */}
          <div className="h-10 flex items-center gap-2 px-3">
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
            <span className="text-body-sm text-on-surface truncate max-w-[100px]">
              {currentPromptName || 'Starting...'}
            </span>

            {/* Live token counter */}
            {currentCall && (
              <>
                <div className="h-4 w-px bg-outline-variant shrink-0" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-[10px] text-on-surface-variant shrink-0">
                      <Zap className="h-3 w-3" />
                      <span>{formatTokenCount(totalTokens)}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">
                    Total tokens (cumulative)
                  </TooltipContent>
                </Tooltip>
              </>
            )}

            {/* Live cost */}
            <span className="text-[10px] text-on-surface-variant shrink-0">
              {formatCost(totalCost)}
            </span>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Timer - using font-sans per design system */}
            <span className="text-[11px] text-on-surface-variant shrink-0 tabular-nums">
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
                  {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">{isPaused ? 'Resume' : 'Pause'}</TooltipContent>
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
                  <Switch checked={skipAllPreviews} onCheckedChange={setSkipAllPreviews} />
                </div>
                {skippedPrompts.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-outline-variant">
                    <span className="text-[10px] text-on-surface-variant">Skipped: {skippedPrompts.length}</span>
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-outline-variant space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-on-surface-variant">Completed calls</span>
                    <span className="text-on-surface">{cumulativeStats.callCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-on-surface-variant">Total tokens</span>
                    <span className="text-on-surface">{formatTokenCount(cumulativeStats.inputTokens + cumulativeStats.outputTokens)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-on-surface-variant">Total cost</span>
                    <span className="text-on-surface">{formatCost(cumulativeStats.totalCost)}</span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Reasoning Section - Full Width, Visible When Active */}
          <AnimatePresence>
            {(hasReasoning || isThinking) && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-outline-variant"
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  <Brain className="h-3.5 w-3.5 text-primary animate-pulse shrink-0" />
                <div 
                    ref={reasoningScrollRef}
                    onClick={() => setReasoningPopupOpen(true)}
                    className="flex-1 overflow-x-auto whitespace-nowrap text-[11px] text-on-surface-variant italic cursor-pointer hover:text-on-surface scrollbar-none"
                    style={{ scrollBehavior: 'smooth', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {thinkingText || 'Thinking...'}
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        onClick={() => setReasoningPopupOpen(true)}
                        className="w-6 h-6 flex items-center justify-center rounded-m3-full hover:bg-surface-container shrink-0"
                      >
                        <Maximize2 className="h-3 w-3 text-on-surface-variant" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Expand reasoning</TooltipContent>
                  </Tooltip>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Reasoning Popup */}
        <ReasoningStreamPopup
          isOpen={reasoningPopupOpen}
          onClose={() => setReasoningPopupOpen(false)}
          thinkingText={thinkingText}
          promptName={currentPromptName}
          model={currentCall?.model}
        />
      </>
    );
  }

  // Single run mode
  const callCount = activeCalls.length;
  const elapsed = currentCall ? (elapsedTimes[currentCall.id] || 0) : 0;
  
  const contextUsage = currentCall ? calculateContextUsage(
    (currentCall.estimatedInputTokens || 0) + (currentCall.outputTokens || 0),
    currentCall.contextWindow
  ) : 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full bg-surface-container-high rounded-m3-xl overflow-hidden"
        style={{ borderRadius: '20px' }}
      >
        {/* Main row */}
        <div className="h-10 flex items-center gap-2 px-3">
          {/* Spinning loader */}
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />

          {/* Model badge */}
          {currentCall?.model && (
            <span className="text-[10px] text-primary font-medium shrink-0 max-w-[80px] truncate">
              {currentCall.model.replace('gpt-', '').replace('-', '')}
            </span>
          )}

          <div className="h-4 w-px bg-outline-variant shrink-0" />

          {/* Token flow */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-[10px] shrink-0">
                <TrendingUp className="h-3 w-3 text-on-surface-variant" />
                <span className="text-on-surface-variant">~{formatTokenCount(currentCall?.estimatedInputTokens || 0)}</span>
                <span className="text-on-surface-variant">→</span>
                <span className="text-primary font-medium">{formatTokenCount(currentCall?.outputTokens || 0)}↑</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Input tokens (est.) → Output tokens (live)</TooltipContent>
          </Tooltip>

          {/* Cost */}
          <span className="text-[10px] text-on-surface-variant shrink-0">{formatCost(liveEstimatedCost)}</span>

          {/* Speed */}
          {tokensPerSecond > 0 && (
            <span className="text-[10px] text-on-surface-variant shrink-0">
              {formatTokensPerSecond(tokensPerSecond)} tok/s
            </span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Context usage mini bar */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-12 h-1.5 bg-surface-container rounded-full overflow-hidden shrink-0">
                <motion.div
                  className={`h-full rounded-full ${
                    contextUsage > 80 ? 'bg-red-500' : 
                    contextUsage > 50 ? 'bg-amber-500' : 
                    'bg-primary'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${contextUsage}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Context: {contextUsage}%</TooltipContent>
          </Tooltip>

          {/* Timer */}
          <span className="text-[11px] text-on-surface-variant shrink-0 tabular-nums">{formatTime(elapsed)}</span>

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

          {/* Details or multiple calls */}
          {callCount > 1 ? (
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-on-surface-variant bg-surface-container rounded-m3-sm hover:bg-surface-container-highest">
                  +{callCount - 1} more
                  <ChevronDown className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-2 bg-surface-container-high border-outline-variant">
                <div className="space-y-1">
                  {activeCalls.map((call) => {
                    const callTokPerSec = calculateTokensPerSecond(call.tokenCount, call.firstTokenAt, call.lastTokenAt);
                    const callCost = estimateCost({
                      model: call.model,
                      inputTokens: call.estimatedInputTokens || 0,
                      outputTokens: call.outputTokens || 0,
                    });
                    
                    return (
                      <div key={call.id} className="flex items-center justify-between gap-2 p-2 rounded-m3-sm bg-surface-container">
                        <div className="flex-1 min-w-0">
                          <div className="text-body-sm text-on-surface truncate">{call.promptName}</div>
                          <div className="flex items-center gap-2 text-[10px] text-on-surface-variant">
                            <span>{call.model}</span>
                            <span>•</span>
                            <span>{formatTokenCount(call.outputTokens || 0)}↑</span>
                            <span>•</span>
                            <span>{formatCost(callCost)}</span>
                            {callTokPerSec > 0 && (
                              <>
                                <span>•</span>
                                <span>{formatTokensPerSecond(callTokPerSec)} tok/s</span>
                              </>
                            )}
                          </div>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => cancelCall(call.id)}
                              className="w-6 h-6 flex items-center justify-center rounded-m3-full hover:bg-surface-container-highest text-on-surface-variant"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="text-[10px]">Cancel</TooltipContent>
                        </Tooltip>
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <LiveApiDashboardDetails
              call={currentCall}
              elapsed={elapsed}
              liveEstimatedCost={liveEstimatedCost}
              onCancel={cancelCall}
              isOpen={detailsOpen}
              onOpenChange={setDetailsOpen}
            />
          )}
        </div>

        {/* Reasoning Section - Full Width */}
        <AnimatePresence>
          {(hasReasoning || isThinking) && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-outline-variant"
            >
              <div className="flex items-center gap-2 px-3 py-2">
                <Brain className="h-3.5 w-3.5 text-primary animate-pulse shrink-0" />
                <div 
                  ref={reasoningScrollRef}
                  onClick={() => setReasoningPopupOpen(true)}
                  className="flex-1 overflow-x-auto whitespace-nowrap text-[11px] text-on-surface-variant italic cursor-pointer hover:text-on-surface scrollbar-none"
                  style={{ scrollBehavior: 'smooth', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {thinkingText || 'Thinking...'}
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => setReasoningPopupOpen(true)}
                      className="w-6 h-6 flex items-center justify-center rounded-m3-full hover:bg-surface-container shrink-0"
                    >
                      <Maximize2 className="h-3 w-3 text-on-surface-variant" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Expand reasoning</TooltipContent>
                </Tooltip>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Reasoning Popup */}
      <ReasoningStreamPopup
        isOpen={reasoningPopupOpen}
        onClose={() => setReasoningPopupOpen(false)}
        thinkingText={thinkingText}
        promptName={currentCall?.promptName}
        model={currentCall?.model}
      />
    </>
  );
};

export default LiveApiDashboard;
