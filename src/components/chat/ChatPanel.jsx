import React, { useRef, useEffect } from 'react';
import { Bot, MessageSquare, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useApiCallContext } from '@/contexts/ApiCallContext';
import { M3IconButton } from '@/components/ui/m3-icon-button';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import ThinkingIndicator from './ThinkingIndicator';
import EmptyChat from './EmptyChat';

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
  const { pendingCallsCount } = useApiCallContext();
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
      <div className="h-full flex items-center justify-center bg-surface-container-lowest">
        <div className="text-center text-on-surface-variant">
          <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-3">
            <Bot className="h-6 w-6 opacity-50" />
          </div>
          <p className="text-title-small font-medium">Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-surface-container-lowest overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-outline-variant bg-surface-container backdrop-blur-sm shrink-0">
        {/* Conversations button - icon only */}
        {onToggleThreads && (
          <div className="relative">
            <M3IconButton
              size="small"
              tooltip="Conversations"
              onClick={onToggleThreads}
            >
              <MessageSquare className="h-5 w-5" />
            </M3IconButton>
            {threadCount > 0 && (
              <span className="absolute -top-1 -right-1 text-[9px] bg-primary text-on-primary px-1 py-0.5 rounded-full min-w-[14px] text-center font-medium">
                {threadCount}
              </span>
            )}
          </div>
        )}

        {/* Title next to drawer icon */}
        <div className="flex items-center gap-1.5">
          <Bot className="h-4 w-4 text-primary" />
          <h3 className="text-label-large font-semibold text-on-surface">{conversationName}</h3>
        </div>

        <div className="flex-1" />
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
          <div className="divide-y divide-outline-variant/30">
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
