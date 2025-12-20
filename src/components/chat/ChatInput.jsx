import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Paperclip, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';

const ChatInput = ({
  onSend,
  isSending,
  disabled,
  placeholder = 'Type your message...',
  contextItems = [],
  onRemoveContext,
}) => {
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [inputValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isSending || disabled) return;
    onSend(inputValue.trim());
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t border-border bg-gradient-to-t from-card/80 to-card/40 backdrop-blur-md">
      {/* Context pills */}
      <AnimatePresence>
        {contextItems.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pt-3 pb-0 overflow-hidden"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Context:</span>
              {contextItems.map((item, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="gap-1.5 pr-1 bg-accent/10 text-accent hover:bg-accent/20"
                >
                  <Sparkles className="h-3 w-3" />
                  <span className="text-xs">{item.name}</span>
                  {onRemoveContext && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 ml-0.5 hover:bg-accent/20 rounded-full"
                      onClick={() => onRemoveContext(item.id)}
                    >
                      <X className="h-2.5 w-2.5" />
                    </Button>
                  )}
                </Badge>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="p-3">
        <div className={cn(
          "flex items-end gap-2 p-2 rounded-xl border bg-background/80",
          "shadow-sm transition-all",
          "focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50"
        )}>
          {/* Attachment button (placeholder) */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                  disabled
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Attachments coming soon</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isSending || disabled}
            className={cn(
              "min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent",
              "focus-visible:ring-0 focus-visible:ring-offset-0",
              "placeholder:text-muted-foreground/60"
            )}
            rows={1}
          />

          {/* Send button */}
          <motion.div
            whileTap={{ scale: 0.95 }}
          >
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim() || isSending || disabled}
              className={cn(
                "h-9 w-9 shrink-0 rounded-lg transition-all",
                inputValue.trim() 
                  ? "bg-primary hover:bg-primary/90 shadow-md" 
                  : "bg-muted text-muted-foreground"
              )}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </motion.div>
        </div>

        {/* Keyboard hint */}
        <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-muted-foreground/60">
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">↵</kbd> to send
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">⇧ ↵</kbd> new line
          </span>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;