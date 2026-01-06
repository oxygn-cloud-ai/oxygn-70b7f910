import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Zap, 
  DollarSign, 
  Clock, 
  Cpu, 
  TrendingUp,
  ChevronRight,
  Brain
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatTokenCount, calculateContextUsage } from '@/utils/tokenizer';
import { formatCost, formatTokensPerSecond, calculateTokensPerSecond } from '@/utils/costEstimator';

/**
 * Expanded details popover for LiveApiDashboard.
 * Shows full breakdown of tokens, costs, and performance metrics.
 */
const LiveApiDashboardDetails = ({ 
  call, 
  elapsed,
  onCancel,
  isOpen,
  onOpenChange,
}) => {
  if (!call) return null;

  const tokensPerSecond = calculateTokensPerSecond(
    call.tokenCount,
    call.firstTokenAt,
    call.lastTokenAt
  );
  
  const contextUsage = calculateContextUsage(
    (call.estimatedInputTokens || 0) + (call.outputTokens || 0),
    call.contextWindow
  );

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-on-surface-variant bg-surface-container rounded-m3-sm hover:bg-surface-container-highest">
          Details
          <ChevronRight className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        align="end" 
        className="w-80 p-0 bg-surface-container-high border-outline-variant overflow-hidden"
      >
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-outline-variant bg-surface-container">
              <div className="flex items-center justify-between">
                <span className="text-body-sm font-medium text-on-surface">
                  {call.promptName || 'API Call'}
                </span>
                <span className="text-[10px] text-on-surface-variant">
                  {call.model || 'loading...'}
                </span>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="p-3 space-y-3">
              {/* Token Metrics */}
              <div className="grid grid-cols-2 gap-2">
                <MetricCard
                  icon={<TrendingUp className="h-3.5 w-3.5" />}
                  label="Input Tokens"
                  value={formatTokenCount(call.estimatedInputTokens)}
                  sublabel="estimated"
                />
                <MetricCard
                  icon={<Zap className="h-3.5 w-3.5" />}
                  label="Output Tokens"
                  value={formatTokenCount(call.outputTokens)}
                  sublabel="streaming"
                  highlight
                />
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-2 gap-2">
                <MetricCard
                  icon={<Cpu className="h-3.5 w-3.5" />}
                  label="Speed"
                  value={`${formatTokensPerSecond(tokensPerSecond)} tok/s`}
                />
                <MetricCard
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="Elapsed"
                  value={formatElapsed(elapsed)}
                />
              </div>

              {/* Cost Estimate */}
              <div className="grid grid-cols-2 gap-2">
                <MetricCard
                  icon={<DollarSign className="h-3.5 w-3.5" />}
                  label="Est. Cost"
                  value={formatCost(call.estimatedCost)}
                  sublabel="approx"
                />
                <MetricCard
                  icon={<Brain className="h-3.5 w-3.5" />}
                  label="Context"
                  value={`${contextUsage}%`}
                  sublabel={`of ${formatTokenCount(call.contextWindow)}`}
                />
              </div>

              {/* Context Usage Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-on-surface-variant">Context Window Usage</span>
                  <span className="text-on-surface-variant">
                    {formatTokenCount((call.estimatedInputTokens || 0) + (call.outputTokens || 0))} / {formatTokenCount(call.contextWindow)}
                  </span>
                </div>
                <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
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
              </div>

              {/* Thinking Summary (if available) */}
              {call.thinkingSummary && (
                <div className="space-y-1">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wide">
                    Reasoning
                  </span>
                  <div className="text-[11px] text-on-surface bg-surface-container rounded-m3-sm p-2 max-h-24 overflow-y-auto">
                    {call.thinkingSummary.length > 200 
                      ? '...' + call.thinkingSummary.slice(-200) 
                      : call.thinkingSummary}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-3 py-2 border-t border-outline-variant bg-surface-container">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onCancel?.(call.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-body-sm text-red-500 hover:bg-red-500/10 rounded-m3-sm transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancel Request
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Stop generation</TooltipContent>
              </Tooltip>
            </div>
          </motion.div>
        </AnimatePresence>
      </PopoverContent>
    </Popover>
  );
};

/**
 * Small metric card component
 */
const MetricCard = ({ icon, label, value, sublabel, highlight }) => (
  <div className={`p-2 rounded-m3-sm ${highlight ? 'bg-primary/10' : 'bg-surface-container'}`}>
    <div className="flex items-center gap-1.5 mb-0.5">
      <span className={highlight ? 'text-primary' : 'text-on-surface-variant'}>
        {icon}
      </span>
      <span className="text-[10px] text-on-surface-variant">{label}</span>
    </div>
    <div className="flex items-baseline gap-1">
      <span className={`text-body-sm font-medium ${highlight ? 'text-primary' : 'text-on-surface'}`}>
        {value}
      </span>
      {sublabel && (
        <span className="text-[9px] text-on-surface-variant">{sublabel}</span>
      )}
    </div>
  </div>
);

/**
 * Format elapsed seconds to readable string
 */
function formatElapsed(seconds) {
  if (!seconds || seconds < 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export default LiveApiDashboardDetails;
