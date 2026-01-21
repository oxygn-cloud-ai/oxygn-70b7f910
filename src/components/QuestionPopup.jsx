import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { X, Send, Loader2, MessageCircleQuestion, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * QuestionPopup - Displays AI questions to user in question prompts
 * 
 * Uses icon-only actions per M3 design system rules.
 * No Button components - only icon buttons with tooltips.
 */
export function QuestionPopup({
  isOpen,
  onClose,
  question,
  variableName,
  description,
  progress,           // { current: number, max: number }
  collectedVariables, // [{ name: string, value: string }, ...]
  onSubmit,
}) {
  const [inputValue, setInputValue] = useState('');
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const textareaRef = useRef(null);
  
  // Focus textarea when popup opens
  useEffect(() => {
    let timeoutId;
    if (isOpen && textareaRef.current) {
      timeoutId = setTimeout(() => textareaRef.current?.focus(), 100);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isOpen]);
  
  // Clear input and reset submission state when question changes or dialog closes
  useEffect(() => {
    setInputValue('');
    setIsSubmittingAnswer(false);
  }, [question, isOpen]);
  
  const handleSubmit = () => {
    if (!inputValue.trim() || isSubmittingAnswer) return;
    setIsSubmittingAnswer(true);
    onSubmit(inputValue.trim());
    setInputValue('');
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  const progressDots = progress 
    ? Array.from({ length: Math.min(progress.max, 10) }, (_, i) => i < progress.current)
    : [];
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-md bg-surface-container-high border-outline-variant p-0 gap-0"
        hideCloseButton={true}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Accessibility description */}
        <DialogDescription className="sr-only">
          Answer the following question to continue the workflow
        </DialogDescription>
        
        {/* Header - 56px */}
        <div className="h-14 flex items-center gap-3 px-4 border-b border-outline-variant shrink-0">
          <MessageCircleQuestion className="h-5 w-5 text-on-surface-variant" />
          <DialogTitle className="text-title-sm text-on-surface font-medium flex-1">
            Question
          </DialogTitle>
          
          {/* Progress dots */}
          {progress && progress.max > 0 && (
            <div className="flex items-center gap-1.5">
              {progressDots.map((filled, i) => (
                <div key={i} className={cn(
                  "w-1.5 h-1.5 rounded-full transition-colors",
                  filled ? "bg-primary" : "bg-on-surface-variant/30"
                )} />
              ))}
              <span className="text-[10px] text-on-surface-variant ml-1">
                {progress.current}/{progress.max}
              </span>
            </div>
          )}
          
          {/* Close icon */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
              >
                <X className="h-4 w-4 text-on-surface-variant" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Close</TooltipContent>
          </Tooltip>
        </div>
        
        {/* Question */}
        <div className="p-4">
          <p className="text-body-sm text-on-surface">{question}</p>
          {description && (
            <p className="text-[10px] text-on-surface-variant mt-1">{description}</p>
          )}
          {variableName && (
            <p className="text-[10px] text-primary font-mono mt-2">
              → {`{{${variableName}}}`}
            </p>
          )}
        </div>
        
        {/* Input */}
        <div className="px-4 pb-2">
          <div className="flex items-end gap-2 p-2 bg-surface-container rounded-m3-md border border-outline-variant">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your response..."
              className="flex-1 min-h-[44px] max-h-[120px] resize-none bg-transparent text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
              rows={1}
              disabled={isSubmittingAnswer}
            />
            
            {/* Submit icon */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSubmit}
                  disabled={!inputValue.trim() || isSubmittingAnswer}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center rounded-m3-full shrink-0",
                    inputValue.trim() && !isSubmittingAnswer
                      ? "hover:bg-primary/10" 
                      : "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isSubmittingAnswer ? (
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  ) : (
                    <Send className={cn(
                      "h-4 w-4",
                      inputValue.trim() ? "text-primary" : "text-on-surface-variant"
                    )} />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Submit response</TooltipContent>
            </Tooltip>
          </div>
          
          {/* Keyboard hints */}
          <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-on-surface-variant/60">
            <span>
              <kbd className="px-1 py-0.5 rounded bg-surface-container font-mono text-[9px]">↵</kbd> submit
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-surface-container font-mono text-[9px]">⇧↵</kbd> new line
            </span>
          </div>
        </div>
        
        {/* Collected variables */}
        {collectedVariables && collectedVariables.length > 0 && (
          <div className="px-4 pb-4">
            <div className="h-px bg-outline-variant mb-3" />
            <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">Collected</span>
            <div className="mt-2 space-y-1.5">
              {collectedVariables.map((v, idx) => (
                <div key={v.name || idx} className="flex items-start gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-primary font-mono">{`{{${v.name}}}`}</span>
                    <span className="text-[10px] text-on-surface-variant ml-1 truncate block">
                      {v.value?.slice(0, 40)}{v.value?.length > 40 ? '...' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default QuestionPopup;
