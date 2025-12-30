import React, { useState, useRef, useEffect } from "react";
import { 
  ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, 
  Play, Copy, Check, Clock, Loader2, Octagon, Bot, CheckCircle2, Link2
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const MIN_HEIGHT = 100;
const COLLAPSED_HEIGHT = 0;

// Chevron button for expand/collapse
const ChevronButton = ({ icon: Icon, onClick, tooltipText }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={onClick}
        className="w-5 h-5 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08] hover:text-on-surface transition-colors"
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="text-[10px]">{tooltipText}</TooltipContent>
  </Tooltip>
);

// Map progress stages to display text
const getStageDisplay = (progress) => {
  if (!progress) return { text: 'Starting...', icon: null, badge: null };
  
  switch (progress.stage || progress.type) {
    case 'started':
      return { text: 'Starting...', icon: null, badge: null };
    case 'prompt_loaded':
      return { text: `Loaded: ${progress.prompt_name || 'prompt'}`, icon: null, badge: null };
    case 'loading_context':
      return { text: 'Loading files and pages...', icon: <Loader2 className="h-3 w-3 animate-spin" />, badge: null };
    case 'context_ready':
      if (progress.inherited_context) {
        return { 
          text: 'Using inherited conversation', 
          icon: <Link2 className="h-3 w-3 text-primary" />,
          badge: 'inherited'
        };
      }
      if (progress.cached) {
        return { text: 'Using cached context', icon: <CheckCircle2 className="h-3 w-3 text-green-500" />, badge: null };
      }
      const parts = [];
      if (progress.files_count > 0) parts.push(`${progress.files_count} file${progress.files_count > 1 ? 's' : ''}`);
      if (progress.pages_count > 0) parts.push(`${progress.pages_count} page${progress.pages_count > 1 ? 's' : ''}`);
      const contextText = parts.length > 0 ? `Context loaded (${parts.join(', ')})` : 'Context ready';
      return { text: contextText, icon: <CheckCircle2 className="h-3 w-3 text-green-500" />, badge: null };
    case 'calling_api':
      return { text: `Calling ${progress.model || 'AI'}...`, icon: <Loader2 className="h-3 w-3 animate-spin" />, badge: progress.inherited_context ? 'inherited' : null };
    case 'heartbeat':
      return { text: 'Still working...', icon: null, badge: null };
    case 'complete':
      return { text: 'Complete!', icon: <CheckCircle2 className="h-3 w-3 text-green-500" />, badge: null };
    case 'error':
      return { text: 'Error occurred', icon: null, badge: null };
    default:
      return { text: 'Processing...', icon: null, badge: null };
  }
};

/**
 * ResizableOutputArea - Read-only output field with dual resize methods:
 * 1. Drag handle (bottom edge via CSS resize-y for vertical only)
 * 2. Chevron buttons to jump between collapsed/min/full states
 */
const ResizableOutputArea = ({ 
  label = "Output",
  value, 
  placeholder = "No output yet. Run the prompt to generate a response.",
  metadata,
  onRegenerate,
  onCancel,
  isRegenerating = false,
  runTime,
  progress,
  defaultHeight = MIN_HEIGHT,
  storageKey, // Optional key to persist sizing in localStorage
  syntaxHighlight = false // Enable syntax highlighting for JSON output
}) => {
  // Generate storage key from label if not provided
  const persistKey = storageKey || (label ? `qonsol-output-height-${label.toLowerCase().replace(/\s+/g, '-')}` : null);
  
  const [expandState, setExpandState] = useState(() => {
    if (persistKey) {
      try {
        const saved = localStorage.getItem(persistKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.expandState || 'min';
        }
      } catch {}
    }
    return 'min';
  });
  const [manualHeight, setManualHeight] = useState(() => {
    if (persistKey) {
      try {
        const saved = localStorage.getItem(persistKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.manualHeight || null;
        }
      } catch {}
    }
    return null;
  });
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(defaultHeight);

  // Persist sizing to localStorage
  useEffect(() => {
    if (persistKey) {
      localStorage.setItem(persistKey, JSON.stringify({ expandState, manualHeight }));
    }
  }, [persistKey, expandState, manualHeight]);

  // Measure content height for 'full' state
  useEffect(() => {
    if (contentRef.current) {
      const scrollHeight = contentRef.current.scrollHeight;
      setContentHeight(Math.max(defaultHeight, scrollHeight));
    }
  }, [value, defaultHeight]);

  const handleCopy = async () => {
    if (value) {
      await navigator.clipboard.writeText(value);
      toast.success('Copied to clipboard');
    }
  };

  // State transitions
  const goToCollapsed = () => {
    setExpandState('collapsed');
    setManualHeight(null);
  };

  const goToMin = () => {
    setExpandState('min');
    setManualHeight(null);
  };

  const goToFull = () => {
    setExpandState('full');
    setManualHeight(null);
  };

  // Get height based on state (manual drag overrides chevron state)
  const getHeight = () => {
    if (manualHeight !== null) {
      return manualHeight;
    }
    switch (expandState) {
      case 'collapsed':
        return COLLAPSED_HEIGHT;
      case 'min':
        return MIN_HEIGHT;
      case 'full':
        return contentHeight;
      default:
        return MIN_HEIGHT;
    }
  };

  // Handle resize via drag (detect when user manually resizes)
  const handleResize = () => {
    if (contentRef.current) {
      const newHeight = contentRef.current.offsetHeight;
      if (newHeight !== getHeight()) {
        setManualHeight(newHeight);
      }
    }
  };

  const isCollapsed = expandState === 'collapsed' && manualHeight === null;
  const currentHeight = getHeight();
  const stageDisplay = getStageDisplay(progress);

  return (
    <div className="space-y-1.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* Chevron controls - left side */}
          {expandState === 'collapsed' && manualHeight === null && (
            <>
              <ChevronButton icon={ChevronDown} onClick={goToMin} tooltipText="Expand to minimum" />
              <ChevronButton icon={ChevronsDown} onClick={goToFull} tooltipText="Expand to full" />
            </>
          )}
          {expandState === 'min' && manualHeight === null && (
            <>
              <ChevronButton icon={ChevronUp} onClick={goToCollapsed} tooltipText="Collapse" />
              <ChevronButton icon={ChevronsDown} onClick={goToFull} tooltipText="Expand to full" />
            </>
          )}
          {expandState === 'full' && manualHeight === null && (
            <>
              <ChevronButton icon={ChevronUp} onClick={goToMin} tooltipText="Reduce to minimum" />
              <ChevronButton icon={ChevronsUp} onClick={goToCollapsed} tooltipText="Collapse" />
            </>
          )}
          {/* When manually resized, show reset controls */}
          {manualHeight !== null && (
            <>
              <ChevronButton icon={ChevronsUp} onClick={goToCollapsed} tooltipText="Collapse" />
              <ChevronButton icon={ChevronUp} onClick={goToMin} tooltipText="Reset to minimum" />
              <ChevronButton icon={ChevronsDown} onClick={goToFull} tooltipText="Expand to full" />
            </>
          )}
          
          <label className="text-[10px] text-on-surface-variant uppercase tracking-wider ml-1">{label}</label>
          
          {value && !isRegenerating && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 flex items-center gap-1">
              <Check className="h-2.5 w-2.5" />
              Generated
            </span>
          )}
        </div>
        
        {/* Actions - right side */}
        <div className="flex items-center gap-1">
          {onRegenerate && (
            <>
              {isRegenerating && runTime && (
                <span className="text-[10px] text-primary font-medium tabular-nums">
                  {runTime}
                </span>
              )}
              {isRegenerating && onCancel && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={onCancel}
                      className="w-6 h-6 flex items-center justify-center rounded-sm hover:bg-on-surface/[0.08] text-red-500 hover:text-red-600"
                    >
                      <Octagon className="h-3.5 w-3.5 fill-current" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Stop</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={onRegenerate}
                    disabled={isRegenerating}
                    className={`w-6 h-6 flex items-center justify-center rounded-sm hover:bg-on-surface/[0.08] ${isRegenerating ? 'text-primary' : 'text-on-surface-variant'}`}
                  >
                    {isRegenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">{isRegenerating ? 'Running...' : 'Play'}</TooltipContent>
              </Tooltip>
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={handleCopy}
                className="w-6 h-6 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Copy Output</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Progress indicator when running */}
      <AnimatePresence>
        {isRegenerating && progress && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-2 py-1.5 bg-primary/5 rounded-m3-sm border border-primary/10">
              <Bot className="h-3.5 w-3.5 text-primary" />
              <motion.div
                key={stageDisplay.text}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-1.5 text-[10px] text-on-surface-variant"
              >
                {stageDisplay.icon || (
                  <motion.span
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-1.5 h-1.5 rounded-full bg-primary"
                  />
                )}
                <span>{stageDisplay.text}</span>
                {/* Inherited context badge */}
                {stageDisplay.badge === 'inherited' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-m3-sm bg-primary/10 text-primary text-[9px] font-medium">
                        <Link2 className="h-2.5 w-2.5" />
                        Inherited
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px] max-w-[200px]">
                      Using conversation history from parent prompt
                    </TooltipContent>
                  </Tooltip>
                )}
              </motion.div>
              {/* Progress stages indicator */}
              {progress?.stage && (
                <div className="flex items-center gap-0.5 ml-auto">
                  {['prompt_loaded', 'context_ready', 'calling_api'].map((stage) => {
                    const stages = ['prompt_loaded', 'loading_context', 'context_ready', 'calling_api'];
                    const currentIdx = stages.indexOf(progress.stage);
                    const stageIdx = stages.indexOf(stage);
                    const isComplete = currentIdx >= stageIdx;
                    
                    return (
                      <div
                        key={stage}
                        className={`h-1 w-4 rounded-full transition-all duration-300 ${
                          isComplete ? "bg-primary" : "bg-outline-variant"
                        }`}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content area - resize-y for vertical only */}
      {!isCollapsed && (
        <>
          <div 
            ref={contentRef}
            style={{ height: `${currentHeight}px` }}
            className={`bg-surface-container-low rounded-m3-md border border-outline-variant overflow-auto resize-y ${syntaxHighlight ? '' : 'p-2.5 text-tree text-on-surface leading-relaxed whitespace-pre-wrap font-mono'}`}
            onMouseUp={handleResize}
          >
            {value ? (
              // Try to format and optionally syntax-highlight JSON
              (() => {
                const trimmed = value.trim();
                if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
                    (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                  try {
                    const parsed = JSON.parse(trimmed);
                    const formatted = JSON.stringify(parsed, null, 2);
                    
                    if (syntaxHighlight) {
                      return (
                        <SyntaxHighlighter
                          language="json"
                          style={oneDark}
                          customStyle={{
                            margin: 0,
                            padding: '10px',
                            background: 'transparent',
                            fontSize: '11px',
                            lineHeight: '1.5',
                          }}
                          wrapLongLines
                        >
                          {formatted}
                        </SyntaxHighlighter>
                      );
                    }
                    return formatted;
                  } catch {
                    return value; // Not valid JSON, show as-is
                  }
                }
                return value;
              })()
            ) : (
              <span className="text-on-surface-variant opacity-50 font-sans p-2.5 block">{placeholder}</span>
            )}
          </div>

          {/* Metadata */}
          {metadata && (
            <div className="flex items-center gap-3 text-[10px] text-on-surface-variant">
              {metadata.latency_ms && (
                <>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {(metadata.latency_ms / 1000).toFixed(1)}s
                  </span>
                  <span>•</span>
                </>
              )}
              {metadata.model && (
                <>
                  <span>{metadata.model}</span>
                  <span>•</span>
                </>
              )}
              {metadata.tokens_total && (
                <>
                  <span>{metadata.tokens_total} tokens</span>
                  <span>•</span>
                </>
              )}
              {metadata.cost_total_usd && (
                <span>${metadata.cost_total_usd.toFixed(4)}</span>
              )}
            </div>
          )}

          {/* Bottom chevron controls */}
          <div className="flex items-center gap-1 pt-1">
            {expandState === 'full' && manualHeight === null && (
              <>
                <ChevronButton icon={ChevronUp} onClick={goToMin} tooltipText="Reduce to minimum" />
                <ChevronButton icon={ChevronsUp} onClick={goToCollapsed} tooltipText="Collapse" />
              </>
            )}
            {expandState === 'min' && manualHeight === null && (
              <ChevronButton icon={ChevronsDown} onClick={goToFull} tooltipText="Expand to full" />
            )}
            {manualHeight !== null && (
              <>
                <ChevronButton icon={ChevronsUp} onClick={goToCollapsed} tooltipText="Collapse" />
                <ChevronButton icon={ChevronUp} onClick={goToMin} tooltipText="Reset to minimum" />
                <ChevronButton icon={ChevronsDown} onClick={goToFull} tooltipText="Expand to full" />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ResizableOutputArea;
