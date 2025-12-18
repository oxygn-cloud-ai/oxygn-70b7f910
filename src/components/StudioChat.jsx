import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, User, Bot, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const MessageBubble = ({ message }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  return (
    <div
      className={cn(
        'group flex gap-3 p-4 transition-colors',
        isUser ? 'bg-muted/30' : 'bg-background hover:bg-muted/10'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'shrink-0 h-8 w-8 rounded-full flex items-center justify-center',
          isUser 
            ? 'bg-primary/10 text-primary' 
            : 'bg-accent/10 text-accent'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">
            {isUser ? 'You' : 'Assistant'}
          </span>
          {/* Copy button - show on hover */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3 text-primary" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground" />
            )}
          </Button>
        </div>
        <div className="text-sm whitespace-pre-wrap break-words text-foreground">
          {message.content}
        </div>
      </div>
    </div>
  );
};

const StudioChat = ({
  messages,
  onSendMessage,
  isLoadingMessages,
  isSending,
  disabled,
  placeholder = 'Type your message...',
  assistantName = 'Assistant',
}) => {
  const [inputValue, setInputValue] = useState('');
  const scrollAreaRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isSending || disabled) return;

    onSendMessage(inputValue.trim());
    setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (disabled) {
    return (
      <div className="h-full flex items-center justify-center bg-background/50">
        <div className="text-center text-muted-foreground">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <Bot className="h-6 w-6 opacity-50" />
          </div>
          <p className="font-medium">Select an assistant to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-sm font-medium text-foreground">
          Chat with {assistantName}
        </span>
      </div>

      {/* Messages area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1">
        {isLoadingMessages ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center text-muted-foreground max-w-xs">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <p className="font-medium text-foreground mb-1">Start a conversation</p>
              <p className="text-sm">
                Your messages will include context from child prompts.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isSending && (
              <div className="flex gap-3 p-4 bg-background">
                <div className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-accent/10 text-accent">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    Assistant
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-border p-3 bg-card/30">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isSending}
            className="min-h-[44px] max-h-[200px] resize-none bg-background border-border focus:ring-primary focus:border-primary"
            rows={1}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!inputValue.trim() || isSending}
            className="shrink-0 h-[44px] w-[44px] bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

export default StudioChat;
