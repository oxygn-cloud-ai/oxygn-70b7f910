import React, { useState, useEffect } from 'react';
import { Bot, Square, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

// Map progress stages to display text
const getStageDisplay = (progress) => {
  if (!progress) return { text: 'Starting...', icon: null };
  
  switch (progress.stage || progress.type) {
    case 'started':
      return { text: 'Starting...', icon: null };
    case 'prompt_loaded':
      return { text: `Loaded: ${progress.prompt_name || 'prompt'}`, icon: null };
    case 'loading_context':
      return { text: 'Loading files and pages...', icon: <Loader2 className="h-3 w-3 animate-spin" /> };
    case 'context_ready':
      if (progress.cached) {
        return { text: 'Using cached context', icon: <CheckCircle2 className="h-3 w-3 text-green-500" /> };
      }
      const parts = [];
      if (progress.files_count > 0) parts.push(`${progress.files_count} file${progress.files_count > 1 ? 's' : ''}`);
      if (progress.pages_count > 0) parts.push(`${progress.pages_count} page${progress.pages_count > 1 ? 's' : ''}`);
      const contextText = parts.length > 0 ? `Context loaded (${parts.join(', ')})` : 'Context ready';
      return { text: contextText, icon: <CheckCircle2 className="h-3 w-3 text-green-500" /> };
    case 'calling_api':
      return { text: `Calling ${progress.model || 'AI'}...`, icon: <Loader2 className="h-3 w-3 animate-spin" /> };
    case 'heartbeat':
      return { text: 'Still working...', icon: null };
    case 'complete':
      return { text: 'Complete!', icon: <CheckCircle2 className="h-3 w-3 text-green-500" /> };
    case 'error':
      return { text: 'Error occurred', icon: null };
    default:
      return { text: 'Processing...', icon: null };
  }
};

const ThinkingIndicator = ({ onCancel, conversationName, progress }) => {
  const [elapsed, setElapsed] = useState(0);
  const [lastHeartbeat, setLastHeartbeat] = useState(Date.now());

  // Track elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Update heartbeat timestamp when we receive one
  useEffect(() => {
    if (progress?.type === 'heartbeat') {
      setLastHeartbeat(Date.now());
    }
  }, [progress]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const stageDisplay = getStageDisplay(progress);
  
  // Check if we're still receiving heartbeats (within last 15 seconds)
  const isConnectionAlive = Date.now() - lastHeartbeat < 15000;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex gap-2 px-3 py-2 bg-background"
    >
      {/* Compact avatar with heartbeat pulse */}
      <div className="shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center relative">
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
          }}
          transition={{ 
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <Bot className="h-3 w-3 text-primary" />
        </motion.div>
        {/* Heartbeat pulse indicator */}
        <AnimatePresence>
          {isConnectionAlive && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500"
            >
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-green-500"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] font-semibold text-foreground">{conversationName || 'AI'}</span>
          <span className="text-[9px] text-muted-foreground">
            {formatTime(elapsed)}
          </span>
        </div>

        {/* Stage text with animation */}
        <motion.div
          key={stageDisplay.text}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2"
        >
          <span className="flex items-center gap-1">
            {stageDisplay.icon || (
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-1 h-1 rounded-full bg-primary"
              />
            )}
            {stageDisplay.text}
          </span>
        </motion.div>

        {/* Progress stages indicator */}
        {progress?.stage && (
          <div className="flex items-center gap-1 mb-2">
            {['prompt_loaded', 'context_ready', 'calling_api'].map((stage, idx) => {
              const stages = ['prompt_loaded', 'loading_context', 'context_ready', 'calling_api'];
              const currentIdx = stages.indexOf(progress.stage);
              const stageIdx = stages.indexOf(stage);
              const isComplete = currentIdx >= stageIdx;
              const isCurrent = progress.stage === stage || 
                (progress.stage === 'loading_context' && stage === 'context_ready');
              
              return (
                <div
                  key={stage}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-all duration-300",
                    isComplete ? "bg-primary" : "bg-muted",
                    isCurrent && !isComplete && "bg-primary/50"
                  )}
                />
              );
            })}
          </div>
        )}

        {/* Skeleton shimmer lines */}
        <div className="space-y-1">
          {[100, 80].map((width, i) => (
            <motion.div
              key={i}
              className={cn(
                "h-2 rounded-full overflow-hidden",
                "bg-gradient-to-r from-muted via-muted/50 to-muted"
              )}
              style={{ width: `${width}%` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.1 }}
            >
              <motion.div
                className="h-full w-1/3 bg-gradient-to-r from-transparent via-foreground/5 to-transparent"
                animate={{ x: ['0%', '300%'] }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity, 
                  ease: "linear",
                  delay: i * 0.2 
                }}
              />
            </motion.div>
          ))}
        </div>

        {/* Cancel button */}
        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={onCancel}
          >
            <Square className="h-3 w-3 mr-1.5" />
            Stop generating
          </Button>
        )}
      </div>
    </motion.div>
  );
};

export default ThinkingIndicator;
