import React, { useState, useEffect } from 'react';
import { useCascadeRun } from '@/contexts/CascadeRunContext';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { X, Pause, Play, Loader2, CheckCircle2, SkipForward, FastForward } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SkippedPrompt {
  promptRowId: string;
  promptName: string;
}

const CascadeRunProgress: React.FC = () => {
  const {
    isRunning,
    isPaused,
    isCancelling,
    currentLevel,
    totalLevels,
    currentPromptName,
    currentPromptIndex,
    totalPrompts,
    completedPrompts,
    skippedPrompts,
    startTime,
    cancel,
    pause,
    resume,
    skipAllPreviews,
    setSkipAllPreviews,
  } = useCascadeRun();

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning || !startTime) {
      setElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  if (!isRunning) return null;

  const progressPercent = totalPrompts > 0 
    ? (completedPrompts.length / totalPrompts) * 100 
    : 0;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const skippedList = (skippedPrompts || []) as SkippedPrompt[];
  const skippedCount = skippedList.length;

  return (
    <div className="w-full bg-primary/10 border-b border-border px-4 py-2">
      <div className="flex items-center gap-4">
        {/* Status Icon */}
        <div className="flex items-center gap-2">
          {isCancelling ? (
            <Loader2 className="h-4 w-4 animate-spin text-destructive" />
          ) : isPaused ? (
            <Pause className="h-4 w-4 text-amber-500" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          )}
          <span className="text-sm font-medium">
            {isCancelling ? 'Cancelling...' : isPaused ? 'Paused' : 'Cascade Running'}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="flex-1 max-w-xs">
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {completedPrompts.length}/{totalPrompts}
          </span>
          
          {/* Skipped prompts indicator */}
          {skippedCount > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 text-muted-foreground/70">
                    <SkipForward className="h-3 w-3" />
                    {skippedCount} skipped
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium mb-1">Excluded from cascade:</p>
                  <ul className="text-xs space-y-0.5">
                    {skippedList.map((p, i) => (
                      <li key={p.promptRowId || i} className="truncate">
                        • {p.promptName}
                      </li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          <span>Level {currentLevel}/{totalLevels - 1}</span>
          <span className="max-w-[200px] truncate" title={currentPromptName}>
            {currentPromptName || 'Starting...'}
          </span>
          <span className="font-mono">{formatTime(elapsed)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Skip All Previews Toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <FastForward className={`h-3.5 w-3.5 ${skipAllPreviews ? 'text-primary' : 'text-on-surface-variant'}`} />
                  <Switch
                    checked={skipAllPreviews}
                    onCheckedChange={setSkipAllPreviews}
                    className="scale-75"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Skip all action previews</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <div className="w-px h-4 bg-outline-variant" />
          
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={isPaused ? resume : pause}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? (
              <Play className="h-3.5 w-3.5" />
            ) : (
              <Pause className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={cancel}
            disabled={isCancelling}
            title={isCancelling ? 'Cancelling...' : 'Cancel'}
          >
            {isCancelling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CascadeRunProgress;
