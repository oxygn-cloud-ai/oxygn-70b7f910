import React, { useRef, useEffect } from 'react';
import { Bot, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import ThinkingIndicator from './ThinkingIndicator';
import EmptyChat from './EmptyChat';
import { motion } from 'framer-motion';

const ChatPanel = ({
  messages,
  onSendMessage,
  isLoadingMessages,
  isSending,
  disabled,
  placeholder,
  conversationName = 'AI',
  contextItems = [],
  onRemoveContext,
  childPromptsCount = 0,
  onToggleThreads,
  activeThreadName,
  threadCount = 0,
}) => {
  const { userProfile } = useAuth();
  const scrollAreaRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isSending]);

  const handleSendSuggestion = (suggestion) => {
    onSendMessage(suggestion);
  };

  if (disabled) {
    return (
      <div className="h-full flex items-center justify-center bg-background/50">
        <div className="text-center text-muted-foreground">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <Bot className="h-6 w-6 opacity-50" />
          </div>
          <p className="font-medium">Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/50 backdrop-blur-sm">
        {/* Conversations button - icon only */}
        {onToggleThreads && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 !text-muted-foreground hover:!text-foreground hover:!bg-sidebar-accent"
            onClick={onToggleThreads}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {threadCount > 0 && (
              <span className="absolute -top-1 -right-1 text-[9px] bg-primary text-primary-foreground px-1 py-0.5 rounded-full min-w-[14px] text-center">
                {threadCount}
              </span>
            )}
          </Button>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          <div className="relative">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Bot className="h-3 w-3 text-primary-foreground" />
            </div>
            <motion.div
              className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border-2 border-card"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground">{conversationName}</h3>
            <p className="text-[9px] text-muted-foreground">Online</p>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1">
        {isLoadingMessages ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <EmptyChat 
            conversationName={conversationName} 
            onSendSuggestion={handleSendSuggestion}
            childPromptsCount={childPromptsCount}
          />
        ) : (
          <div className="divide-y divide-border/30">
            {messages.map((message) => (
              <MessageBubble 
                key={message.id} 
                message={message} 
                userProfile={userProfile}
                conversationName={conversationName}
              />
            ))}
            {isSending && <ThinkingIndicator conversationName={conversationName} />}
          </div>
        )}
      </ScrollArea>

      {/* Input area */}
      <ChatInput
        onSend={onSendMessage}
        isSending={isSending}
        disabled={disabled}
        placeholder={placeholder}
        contextItems={contextItems}
        onRemoveContext={onRemoveContext}
      />
    </div>
  );
};

export default ChatPanel;