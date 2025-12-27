import React, { useRef, useEffect } from 'react';
import { Bot, Trash2, Paperclip, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { M3IconButton } from '@/components/ui/m3-icon-button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import MessageBubble from '@/components/chat/MessageBubble';
import ChatInput from '@/components/chat/ChatInput';
import ThinkingIndicator from '@/components/chat/ThinkingIndicator';
import ToolActivityIndicator from './ToolActivityIndicator';

const WorkbenchChatPanel = ({
  activeThread,
  messages,
  isLoading,
  isStreaming,
  streamingMessage,
  toolActivity = [],
  isExecutingTools = false,
  onSendMessage,
  onClearMessages,
  filesCount = 0,
  pagesCount = 0
}) => {
  const scrollAreaRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, streamingMessage, toolActivity]);

  if (!activeThread) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-container-lowest">
        <div className="text-center text-on-surface-variant">
          <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-body-medium">Select or create a thread to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-surface-container-lowest">
      {/* Header */}
      <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between bg-surface-container">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-elevation-1">
            <Bot className="h-5 w-5 text-on-primary" />
          </div>
          <div>
            <h3 className="text-title-small font-semibold text-on-surface">{activeThread.title || 'Untitled Thread'}</h3>
            <div className="flex items-center gap-2 text-label-small text-on-surface-variant">
              {filesCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-secondary-container text-on-secondary-container">
                  <Paperclip className="h-3 w-3 mr-0.5" />
                  {filesCount}
                </Badge>
              )}
              {pagesCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-secondary-container text-on-secondary-container">
                  <FileText className="h-3 w-3 mr-0.5" />
                  {pagesCount}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {messages.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <M3IconButton size="small" tooltip="Clear conversation">
                <Trash2 className="h-5 w-5" />
              </M3IconButton>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-surface-container-high border-outline-variant">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-headline-small text-on-surface">Clear conversation?</AlertDialogTitle>
                <AlertDialogDescription className="text-body-medium text-on-surface-variant">
                  This will delete all messages in this thread. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-surface-container text-on-surface border-outline-variant">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onClearMessages} className="bg-error text-on-error hover:bg-error/90">
                  Clear
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="text-center max-w-sm">
              <div className="h-12 w-12 rounded-full bg-primary-container flex items-center justify-center mx-auto mb-3">
                <Bot className="h-6 w-6 text-on-primary-container" />
              </div>
              <h4 className="text-title-small font-medium text-on-surface mb-1">Start a conversation</h4>
              <p className="text-body-small text-on-surface-variant">
                I can help you work with your prompts, library items, attached files, and Confluence pages.
              </p>
            </div>
          </div>
        ) : (
          <div className="py-2">
            {messages.map((message) => (
              <MessageBubble
                key={message.row_id}
                message={message}
                conversationName="Workbench AI"
              />
            ))}
            
            {/* Tool activity indicator */}
            {isStreaming && toolActivity.length > 0 && (
              <ToolActivityIndicator 
                toolCalls={toolActivity} 
                isExecuting={isExecutingTools}
              />
            )}
            
            {/* Streaming message */}
            {isStreaming && streamingMessage && (
              <MessageBubble
                message={{ role: 'assistant', content: streamingMessage }}
                conversationName="Workbench AI"
              />
            )}
            
            {/* Thinking indicator - only show when no tool activity and no streaming content */}
            {isStreaming && !streamingMessage && toolActivity.length === 0 && (
              <div className="px-3 py-2">
                <ThinkingIndicator />
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <ChatInput
        onSend={onSendMessage}
        isSending={isStreaming}
        disabled={!activeThread}
        placeholder="Ask about your prompts, library, or attached resources..."
      />
    </div>
  );
};

export default WorkbenchChatPanel;
