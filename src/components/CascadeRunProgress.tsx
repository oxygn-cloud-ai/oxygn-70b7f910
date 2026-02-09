import { useState, useEffect } from 'react';
import { useCascadeRun } from '@/contexts/CascadeRunContext';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Square, Pause, Play, Loader2, CheckCircle2, SkipForward, FastForward } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const CascadeRunProgress: React.FC = () => {
  const {
    isRunning,
    isPaused,
    isCancelling,
    currentLevel,
    totalLevels,
    currentPromptName,
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

  const skippedCount = skippedPrompts?.length || 0;

  return (
    <div className="w-full bg-primary/10 border-b border-outline-variant px-4 py-2">
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
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 text-muted-foreground/70">
                  <SkipForward className="h-3 w-3" />
                  {skippedCount} skipped
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-[10px]">
                <p className="font-medium mb-1">Excluded from cascade:</p>
                <ul className="space-y-0.5">
                  {skippedPrompts.map((p, i) => (
                    <li key={p.promptRowId || i} className="truncate">
                      • {p.promptName}
                    </li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
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
            <TooltipContent side="bottom" className="text-[10px]">
              Skip all action previews
            </TooltipContent>
          </Tooltip>
          
          <div className="w-px h-4 bg-outline-variant" />
          
          {/* Pause/Resume button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={isPaused ? resume : pause}
                className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
              >
                {isPaused ? (
                  <Play className="h-4 w-4 text-on-surface-variant" />
                ) : (
                  <Pause className="h-4 w-4 text-on-surface-variant" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">{isPaused ? 'Resume' : 'Pause'}</TooltipContent>
          </Tooltip>
          
          {/* Stop button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={cancel}
                disabled={isCancelling}
                className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container disabled:opacity-50"
              >
                {isCancelling ? (
                  <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                ) : (
                  <Square className="h-4 w-4 text-destructive" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">{isCancelling ? 'Stopping...' : 'Stop'}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default CascadeRunProgress;
