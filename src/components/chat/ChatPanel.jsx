import React, { useRef, useEffect } from 'react';
import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
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
  assistantName = 'Assistant',
  contextItems = [],
  onRemoveContext,
  childPromptsCount = 0,
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
          <p className="font-medium">Select an assistant to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <motion.div
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-card"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{assistantName}</h3>
          <p className="text-[10px] text-muted-foreground">Online • Ready to help</p>
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
            assistantName={assistantName} 
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
              />
            ))}
            {isSending && <ThinkingIndicator />}
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