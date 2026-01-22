import { useState, useRef, useEffect } from 'react';
import { Cpu, Brain, Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const REASONING_OPTIONS = [
  { value: 'auto', label: 'Auto', desc: 'Model default' },
  { value: 'low', label: 'Low', desc: 'Faster' },
  { value: 'medium', label: 'Medium', desc: 'Balanced' },
  { value: 'high', label: 'High', desc: 'Deeper' },
];

const ModelReasoningSelector = ({
  selectedModel,
  onModelChange,
  activeModels = [],
  defaultModelName = 'Default',
  reasoningEffort = 'auto',
  onReasoningChange,
  supportsReasoning = false,
}) => {
  const [modelOpen, setModelOpen] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const modelRef = useRef(null);
  const reasoningRef = useRef(null);

  // Click-outside handlers
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modelRef.current && !modelRef.current.contains(e.target)) {
        setModelOpen(false);
      }
      if (reasoningRef.current && !reasoningRef.current.contains(e.target)) {
        setReasoningOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedModelName = selectedModel 
    ? activeModels.find(m => m.model_id === selectedModel)?.model_name 
    : null;

  return (
    <div className="flex items-center gap-1">
      {/* Model Selector */}
      <div className="relative" ref={modelRef}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => { setModelOpen(!modelOpen); setReasoningOpen(false); }}
              className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
            >
              <Cpu className={cn(
                "h-4 w-4",
                selectedModel ? "text-primary" : "text-on-surface-variant"
              )} />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">
            Model: {selectedModelName || 'Default'}
          </TooltipContent>
        </Tooltip>

        {modelOpen && (
          <div className="absolute bottom-full left-0 mb-1 w-52 bg-surface-container-high rounded-m3-md shadow-lg border border-outline-variant z-20 py-1 max-h-64 overflow-auto">
            <button
              onClick={() => { onModelChange(null); setModelOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-body-sm hover:bg-surface-container"
            >
              <span>Default ({defaultModelName})</span>
              {!selectedModel && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
            <div className="h-px bg-outline-variant my-1" />
            {activeModels.map(model => (
              <button
                key={model.model_id}
                onClick={() => { onModelChange(model.model_id); setModelOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-body-sm hover:bg-surface-container"
              >
                <span>{model.model_name}</span>
                {selectedModel === model.model_id && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Reasoning Selector - only shown if model supports it */}
      {supportsReasoning && (
        <div className="relative" ref={reasoningRef}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => { setReasoningOpen(!reasoningOpen); setModelOpen(false); }}
                className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
              >
                <Brain className={cn(
                  "h-4 w-4",
                  reasoningEffort !== 'auto' ? "text-primary" : "text-on-surface-variant"
                )} />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">
              Reasoning: {reasoningEffort === 'auto' ? 'Auto' : reasoningEffort}
            </TooltipContent>
          </Tooltip>

          {reasoningOpen && (
            <div className="absolute bottom-full left-0 mb-1 w-40 bg-surface-container-high rounded-m3-md shadow-lg border border-outline-variant z-20 py-1">
              {REASONING_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { onReasoningChange(opt.value); setReasoningOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-body-sm hover:bg-surface-container"
                >
                  <div className="flex items-center gap-2">
                    <span>{opt.label}</span>
                    <span className="text-[10px] text-on-surface-variant">{opt.desc}</span>
                  </div>
                  {reasoningEffort === opt.value && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModelReasoningSelector;
