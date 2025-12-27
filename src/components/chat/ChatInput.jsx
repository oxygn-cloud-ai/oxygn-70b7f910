import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Paperclip, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { TOOLTIPS } from '@/config/labels';
import { motion, AnimatePresence } from 'framer-motion';

// M3 Expressive Icon Button component
const M3IconButton = ({ children, onClick, disabled, className, type = 'button', variant = 'standard', ...props }) => {
  const variants = {
    standard: 'text-on-surface-variant hover:bg-on-surface/8 active:bg-on-surface/12',
    filled: 'bg-primary text-on-primary hover:shadow-md active:shadow-sm',
    filledTonal: 'bg-secondary-container text-on-secondary-container hover:shadow-sm',
    outlined: 'border border-outline text-on-surface-variant hover:bg-on-surface/8',
  };

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.92 }}
      className={cn(
        'inline-flex items-center justify-center rounded-full transition-all duration-200',
        'h-10 w-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'disabled:opacity-38 disabled:pointer-events-none',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
};

// M3 Expressive FAB Send Button
const M3FABSend = ({ onClick, disabled, isSending, hasContent, type = 'submit' }) => {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      initial={false}
      animate={{
        scale: hasContent ? 1 : 0.9,
        backgroundColor: hasContent ? 'hsl(var(--primary))' : 'hsl(var(--surface-container-highest))',
      }}
      whileHover={{ scale: disabled ? 1 : 1.08, boxShadow: hasContent ? '0 6px 16px -4px hsl(var(--primary) / 0.4)' : 'none' }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'relative inline-flex items-center justify-center transition-all duration-200',
        'h-14 w-14 rounded-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'disabled:opacity-38 disabled:pointer-events-none',
        hasContent 
          ? 'text-on-primary shadow-lg' 
          : 'text-on-surface-variant'
      )}
    >
      {/* Ripple effect layer */}
      <span className="absolute inset-0 rounded-[16px] overflow-hidden">
        <span className={cn(
          'absolute inset-0 transition-opacity duration-200',
          hasContent ? 'bg-on-primary/0 hover:bg-on-primary/8' : 'bg-on-surface/0 hover:bg-on-surface/8'
        )} />
      </span>
      
      {/* Icon */}
      <AnimatePresence mode="wait">
        {isSending ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, rotate: -90 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: 90 }}
            transition={{ duration: 0.2 }}
          >
            <Loader2 className="h-6 w-6 animate-spin" />
          </motion.div>
        ) : (
          <motion.div
            key="send"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.2 }}
          >
            <Send className="h-6 w-6" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

// M3 Context Chip
const M3ContextChip = ({ item, onRemove }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg',
        'bg-secondary-container text-on-secondary-container',
        'text-label-medium font-medium'
      )}
    >
      <Sparkles className="h-4 w-4" />
      <span>{item.name}</span>
      {onRemove && (
        <M3IconButton
          variant="standard"
          onClick={() => onRemove(item.id)}
          className="h-6 w-6 -mr-1 text-on-secondary-container"
        >
          <X className="h-3.5 w-3.5" />
        </M3IconButton>
      )}
    </motion.div>
  );
};

const ChatInput = ({
  onSend,
  isSending,
  disabled,
  placeholder = 'Type your message...',
  contextItems = [],
  onRemoveContext,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
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

  const hasContent = inputValue.trim().length > 0;

  return (
    <div className="bg-surface-container-low border-t border-outline-variant">
      {/* Context chips */}
      <AnimatePresence>
        {contextItems.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pt-3 pb-0 overflow-hidden"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-label-small text-on-surface-variant uppercase tracking-wider">
                Context
              </span>
              {contextItems.map((item, index) => (
                <M3ContextChip
                  key={index}
                  item={item}
                  onRemove={onRemoveContext}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="p-4">
        <motion.div 
          animate={{
            boxShadow: isFocused 
              ? '0 4px 12px -2px hsl(var(--primary) / 0.15)' 
              : '0 1px 3px 0 hsl(var(--shadow) / 0.1)'
          }}
          className={cn(
            'flex items-end gap-3 p-3 rounded-[28px] transition-all duration-200',
            'bg-surface-container border-2',
            isFocused ? 'border-primary' : 'border-transparent'
          )}
        >
          {/* Attachment button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <M3IconButton
                  variant="standard"
                  disabled
                  className="shrink-0 mb-0.5"
                >
                  <Paperclip className="h-5 w-5" />
                </M3IconButton>
              </TooltipTrigger>
              <TooltipContent 
                side="top"
                className="bg-inverse-surface text-inverse-on-surface rounded-lg px-3 py-2 text-body-small"
              >
                {TOOLTIPS.chat.attachments}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={isSending || disabled}
            className={cn(
              'flex-1 min-h-[48px] max-h-[200px] py-3 resize-none border-0 bg-transparent',
              'text-body-large text-on-surface',
              'focus-visible:ring-0 focus-visible:ring-offset-0',
              'placeholder:text-on-surface-variant/60'
            )}
            rows={1}
          />

          {/* FAB Send button */}
          <M3FABSend
            type="submit"
            disabled={!hasContent || isSending || disabled}
            isSending={isSending}
            hasContent={hasContent}
          />
        </motion.div>

        {/* Keyboard hints */}
        <div className="flex items-center justify-center gap-6 mt-3">
          <span className="text-label-small text-on-surface-variant/50 flex items-center gap-1.5">
            <kbd className="px-2 py-1 rounded-md bg-surface-container-high text-on-surface-variant font-mono text-[11px]">
              ↵
            </kbd>
            <span>send</span>
          </span>
          <span className="text-label-small text-on-surface-variant/50 flex items-center gap-1.5">
            <kbd className="px-2 py-1 rounded-md bg-surface-container-high text-on-surface-variant font-mono text-[11px]">
              ⇧ ↵
            </kbd>
            <span>new line</span>
          </span>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;