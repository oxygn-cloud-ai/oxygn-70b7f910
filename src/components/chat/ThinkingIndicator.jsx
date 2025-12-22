import React, { useState, useEffect } from 'react';
import { Bot, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const phases = [
  'Reading context...',
  'Analyzing your message...',
  'Thinking...',
  'Composing response...',
];

const ThinkingIndicator = ({ onCancel, conversationName }) => {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // Cycle through phases
  useEffect(() => {
    const interval = setInterval(() => {
      setPhaseIndex(prev => (prev + 1) % phases.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Track elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex gap-2 px-3 py-2 bg-background"
    >
      {/* Compact avatar */}
      <div className="shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
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
      </div>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] font-semibold text-foreground">{conversationName || 'AI'}</span>
          <span className="text-[9px] text-muted-foreground">
            {formatTime(elapsed)}
          </span>
        </div>

        {/* Phase text with animation */}
        <motion.div
          key={phaseIndex}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2"
        >
          <span className="flex items-center gap-1">
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1 h-1 rounded-full bg-primary"
            />
            {phases[phaseIndex]}
          </span>
        </motion.div>

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