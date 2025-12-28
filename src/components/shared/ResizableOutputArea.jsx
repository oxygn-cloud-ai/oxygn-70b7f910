import React, { useState, useRef, useEffect } from "react";
import { 
  ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, 
  Play, Copy, Check, Clock, Loader2
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/sonner";

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

/**
 * ResizableOutputArea - Read-only output field with dual resize methods:
 * 1. Drag handle (bottom-right corner via CSS resize)
 * 2. Chevron buttons to jump between collapsed/min/full states
 */
const ResizableOutputArea = ({ 
  label = "Output",
  value, 
  placeholder = "No output yet. Run the prompt to generate a response.",
  metadata,
  onRegenerate,
  isRegenerating = false,
  defaultHeight = MIN_HEIGHT 
}) => {
  const [expandState, setExpandState] = useState('min'); // 'collapsed' | 'min' | 'full'
  const [manualHeight, setManualHeight] = useState(null);
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(defaultHeight);

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
          
          {value && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 flex items-center gap-1">
              <Check className="h-2.5 w-2.5" />
              Generated
            </span>
          )}
        </div>
        
        {/* Actions - right side */}
        <div className="flex items-center gap-1">
          {onRegenerate && (
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

      {/* Content area */}
      {!isCollapsed && (
        <>
          <div 
            ref={contentRef}
            style={{ height: `${currentHeight}px` }}
            className="p-2.5 bg-surface-container-low rounded-m3-md border border-outline-variant text-body-sm text-on-surface leading-relaxed whitespace-pre-wrap overflow-auto resize"
            onMouseUp={handleResize}
          >
            {value || <span className="text-on-surface-variant opacity-50">{placeholder}</span>}
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
