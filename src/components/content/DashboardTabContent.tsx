/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useMemo } from "react";
import { 
  Brain, Zap, DollarSign, LayoutDashboard,
  Gauge, Activity, Globe, FileSearch, Code,
  Copy, X, Pause, Play,
  Settings2, Wrench
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { useLiveApiDashboard } from "@/contexts/LiveApiDashboardContext";
import { useCascadeRun } from "@/contexts/CascadeRunContext";
import { estimateCost } from "@/utils/costEstimator";
import { toast } from "@/components/ui/sonner";
import type { LucideIcon } from 'lucide-react';

// Format token count with K suffix
const formatTokens = (count: number | null | undefined) => {
  if (!count || count === 0) return '0';
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(count);
};

// Format cost in dollars
const formatCost = (cost: number | null | undefined) => {
  if (!cost || cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(3)}`;
};

// Format elapsed time
const formatTime = (seconds: number | null | undefined) => {
  if (!seconds || seconds === 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Calculate tokens per second
const calculateSpeed = (call: any) => {
  if (!call?.firstTokenAt || !call?.lastTokenAt || !call?.tokenCount) return null;
  const durationMs = call.lastTokenAt - call.firstTokenAt;
  if (durationMs <= 0) return null;
  return (call.tokenCount / (durationMs / 1000)).toFixed(1);
};

// Metric row component
interface MetricRowProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  sublabel?: string;
}

const MetricRow = ({ label, value, icon: Icon, sublabel }: MetricRowProps) => (
  <div className="flex items-center justify-between py-1.5">
    <div className="flex items-center gap-2">
      {Icon && <Icon className="h-3.5 w-3.5 text-on-surface-variant" />}
      <span className="text-body-sm text-on-surface-variant">{label}</span>
    </div>
    <div className="text-right">
      <span className="text-body-sm text-on-surface font-mono">{value}</span>
      {sublabel && <span className="text-[10px] text-on-surface-variant ml-1">{sublabel}</span>}
    </div>
  </div>
);

// Setting row for resolved settings display
interface SettingRowProps {
  label: string;
  value: string | number;
}

const SettingRowDisplay = ({ label, value }: SettingRowProps) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-[11px] text-on-surface-variant">{label}</span>
    <span className="text-[11px] text-on-surface font-mono">{value}</span>
  </div>
);

// Tool badge component
interface ToolBadgeProps {
  enabled: boolean;
  icon: LucideIcon;
  label: string;
}

const ToolBadge = ({ enabled, icon: Icon, label }: ToolBadgeProps) => (
  <div className={`flex items-center gap-1 px-2 py-1 rounded-m3-sm text-[10px] ${
    enabled 
      ? 'bg-primary/10 text-primary' 
      : 'bg-surface-container text-on-surface-variant'
  }`}>
    <Icon className="h-3 w-3" />
    <span>{label}</span>
  </div>
);

const DashboardTabContent = () => {
  const { activeCalls, hasActiveCalls, cancelCall, cumulativeStats } = useLiveApiDashboard() as any;
  const cascadeRun = useCascadeRun() as any;
  const { 
    isRunning: isCascadeRunning, 
    isPaused, 
    currentPromptName, 
    completedPrompts, 
    totalPrompts,
    currentLevel,
    totalLevels,
    pause, 
    resume, 
    cancel: cancelCascade,
  } = cascadeRun;
  const skipPreviews = cascadeRun.skipPreviews ?? false;
  const setSkipPreviews = cascadeRun.setSkipPreviews ?? (() => {});

  // Timer state
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Auto-scroll for reasoning
  const reasoningRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Get the primary active call
  const primaryCall = (activeCalls as any[])?.[0] as any;
  
  // Calculate live metrics
  const liveSpeed = useMemo(() => calculateSpeed(primaryCall), [primaryCall?.tokenCount, primaryCall?.firstTokenAt, primaryCall?.lastTokenAt]);
  
  const liveCost = useMemo(() => {
    if (!primaryCall) return 0;
    return estimateCost({
      model: primaryCall.model,
      inputTokens: primaryCall.estimatedInputTokens || 0,
      outputTokens: primaryCall.outputTokens || 0,
    });
  }, [primaryCall?.model, primaryCall?.estimatedInputTokens, primaryCall?.outputTokens]);

  // Context usage percentage
  const contextUsage = useMemo(() => {
    if (!primaryCall?.contextWindow) return 0;
    const totalTokens = (primaryCall.estimatedInputTokens || 0) + (primaryCall.outputTokens || 0);
    return Math.min(100, Math.round((totalTokens / primaryCall.contextWindow) * 100));
  }, [primaryCall?.estimatedInputTokens, primaryCall?.outputTokens, primaryCall?.contextWindow]);

  // Timer effect
  useEffect(() => {
    if (hasActiveCalls || isCascadeRunning) {
      const startTime = primaryCall?.startedAt ? new Date(primaryCall.startedAt).getTime() : Date.now();
      
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      setElapsed(0);
    }
  }, [hasActiveCalls, isCascadeRunning, primaryCall?.startedAt]);

  // Auto-scroll reasoning
  useEffect(() => {
    if (autoScroll && reasoningRef.current && primaryCall?.thinkingSummary) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
    }
  }, [primaryCall?.thinkingSummary, autoScroll]);

  // Copy reasoning to clipboard
  const handleCopyReasoning = async () => {
    if (primaryCall?.thinkingSummary) {
      try {
        await navigator.clipboard.writeText(primaryCall.thinkingSummary);
        toast.success('Copied to clipboard');
      } catch {
        toast.error('Failed to copy');
      }
    }
  };

  // Empty state
  if (!hasActiveCalls && !isCascadeRunning) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <LayoutDashboard className="h-10 w-10 text-on-surface-variant/30 mb-3" />
        <p className="text-body-sm text-on-surface-variant">No active API call</p>
        <p className="text-[10px] text-on-surface-variant/70 mt-1">Run a prompt to see live metrics</p>
        
        {/* Last run summary */}
        {cumulativeStats.callCount > 0 && (
          <div className="mt-6 p-3 bg-surface-container-low rounded-m3-md">
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-2">Last Session</p>
            <div className="flex items-center gap-4 text-body-sm text-on-surface">
              <span>{cumulativeStats.callCount} calls</span>
              <span>{formatTokens(cumulativeStats.inputTokens + cumulativeStats.outputTokens)} tokens</span>
              <span>{formatCost(cumulativeStats.totalCost)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  const resolvedSettings = primaryCall?.resolvedSettings;
  const resolvedTools = primaryCall?.resolvedTools;

  return (
    <div className="space-y-4">
      {/* Status Section */}
      <div className="bg-surface-container-low rounded-m3-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${hasActiveCalls ? 'bg-green-500 animate-pulse' : 'bg-on-surface-variant/30'}`} />
            <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">
              {isCascadeRunning ? 'Cascade' : 'Running'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-body-sm text-on-surface font-mono">{formatTime(elapsed)}</span>
            {primaryCall && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={() => cancelCall(primaryCall.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-m3-full hover:bg-surface-container text-on-surface-variant hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Cancel</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        
        {/* Model and prompt info */}
        <div className="flex items-center justify-between">
          <span className="text-body-sm text-on-surface font-medium">
            {primaryCall?.model || 'Loading...'}
          </span>
          <span className="text-[10px] text-on-surface-variant truncate max-w-[200px]">
            {primaryCall?.promptName}
          </span>
        </div>

        {/* Cascade controls */}
        {isCascadeRunning && (
          <div className="pt-2 border-t border-outline-variant space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-on-surface-variant">
                {completedPrompts}/{totalPrompts} prompts • Level {currentLevel}/{totalLevels}
              </span>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={isPaused ? resume : pause}
                      className="w-7 h-7 flex items-center justify-center rounded-m3-full hover:bg-surface-container text-on-surface-variant"
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
                      className="w-7 h-7 flex items-center justify-center rounded-m3-full hover:bg-surface-container text-on-surface-variant hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Cancel Cascade</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-on-surface-variant">Skip action previews</span>
              <Switch checked={skipPreviews} onCheckedChange={setSkipPreviews} />
            </div>
            <p className="text-[10px] text-on-surface-variant truncate">{currentPromptName}</p>
          </div>
        )}
      </div>

      {/* Resolved Settings */}
      {resolvedSettings && (
        <div className="bg-surface-container-low rounded-m3-lg p-3 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Settings2 className="h-4 w-4 text-on-surface-variant" />
            <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">Resolved Settings</span>
          </div>
          
          {resolvedSettings.temperature !== undefined && (
            <SettingRowDisplay label="Temperature" value={resolvedSettings.temperature} />
          )}
          {resolvedSettings.max_output_tokens !== undefined && (
            <SettingRowDisplay label="Max Output Tokens" value={resolvedSettings.max_output_tokens.toLocaleString()} />
          )}
          {resolvedSettings.top_p !== undefined && (
            <SettingRowDisplay label="Top P" value={resolvedSettings.top_p} />
          )}
          {resolvedSettings.frequency_penalty !== undefined && (
            <SettingRowDisplay label="Frequency Penalty" value={resolvedSettings.frequency_penalty} />
          )}
          {resolvedSettings.presence_penalty !== undefined && (
            <SettingRowDisplay label="Presence Penalty" value={resolvedSettings.presence_penalty} />
          )}
          {resolvedSettings.reasoning_effort && (
            <SettingRowDisplay label="Reasoning Effort" value={resolvedSettings.reasoning_effort} />
          )}
          {resolvedSettings.tool_choice && (
            <SettingRowDisplay label="Tool Choice" value={resolvedSettings.tool_choice} />
          )}
          {resolvedSettings.seed !== undefined && (
            <SettingRowDisplay label="Seed" value={resolvedSettings.seed} />
          )}
          {resolvedSettings.response_format && (
            <SettingRowDisplay label="Response Format" value={resolvedSettings.response_format} />
          )}
        </div>
      )}

      {/* Tools */}
      {resolvedTools && (
        <div className="bg-surface-container-low rounded-m3-lg p-3 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="h-4 w-4 text-on-surface-variant" />
            <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">Tools</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <ToolBadge enabled={resolvedTools.web_search} icon={Globe} label="Web Search" />
            <ToolBadge enabled={resolvedTools.confluence} icon={FileSearch} label="Confluence" />
            <ToolBadge enabled={resolvedTools.code_interpreter} icon={Code} label="Code" />
            <ToolBadge enabled={resolvedTools.file_search} icon={FileSearch} label="Files" />
          </div>
        </div>
      )}

      {/* Token Metrics */}
      <div className="bg-surface-container-low rounded-m3-lg p-3 space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-4 w-4 text-on-surface-variant" />
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">Metrics</span>
        </div>
        
        <MetricRow 
          label="Input Tokens" 
          value={formatTokens(primaryCall?.estimatedInputTokens)} 
          sublabel="est"
        />
        <MetricRow 
          label="Output Tokens" 
          value={formatTokens(primaryCall?.outputTokens)} 
          icon={primaryCall?.outputTokens > 0 ? Zap : undefined}
        />
        <MetricRow 
          label="Context Usage" 
          value={`${contextUsage}%`} 
        />
        
        {/* Context bar */}
        <div className="h-1.5 bg-surface-container rounded-full overflow-hidden mt-2">
          <div 
            className={`h-full transition-all duration-300 ${
              contextUsage > 80 ? 'bg-destructive' : contextUsage > 50 ? 'bg-amber-500' : 'bg-primary'
            }`}
            style={{ width: `${contextUsage}%` }}
          />
        </div>
      </div>

      {/* Performance */}
      <div className="bg-surface-container-low rounded-m3-lg p-3 space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <Gauge className="h-4 w-4 text-on-surface-variant" />
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">Performance</span>
        </div>
        
        <MetricRow 
          label="Speed" 
          value={liveSpeed ? `${liveSpeed} tok/s` : '—'} 
        />
        <MetricRow 
          label="Est. Cost" 
          value={formatCost(liveCost)} 
          icon={DollarSign}
        />
      </div>

      {/* Cascade Stats */}
      {isCascadeRunning && cumulativeStats.callCount > 0 && (
        <div className="bg-surface-container-low rounded-m3-lg p-3 space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-on-surface-variant" />
            <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">Cascade Totals</span>
          </div>
          
          <MetricRow 
            label="Calls" 
            value={cumulativeStats.callCount} 
          />
          <MetricRow 
            label="Total Tokens" 
            value={formatTokens(cumulativeStats.inputTokens + cumulativeStats.outputTokens)} 
          />
          <MetricRow 
            label="Total Cost" 
            value={formatCost(cumulativeStats.totalCost)} 
          />
        </div>
      )}

      {/* Reasoning */}
      {primaryCall?.thinkingSummary && (
        <div className="bg-surface-container-low rounded-m3-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-on-surface-variant" />
              <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">Reasoning</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={handleCopyReasoning}
                  className="w-7 h-7 flex items-center justify-center rounded-m3-full hover:bg-surface-container text-on-surface-variant"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Copy</TooltipContent>
            </Tooltip>
          </div>
          
          <div 
            ref={reasoningRef}
            className="max-h-48 overflow-auto text-[11px] text-on-surface-variant leading-relaxed bg-surface-container rounded-m3-sm p-2"
          >
            {primaryCall.thinkingSummary}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardTabContent;
