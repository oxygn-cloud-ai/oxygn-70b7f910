import React, { useRef, useEffect } from 'react';
import { Bot, Trash2, Paperclip, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
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

const WorkbenchChatPanel = ({
  activeThread,
  messages,
  isLoading,
  isStreaming,
  streamingMessage,
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
  }, [messages, streamingMessage]);

  if (!activeThread) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select or create a thread to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{activeThread.title || 'Untitled Thread'}</h3>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {filesCount > 0 && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  <Paperclip className="h-2.5 w-2.5 mr-0.5" />
                  {filesCount}
                </Badge>
              )}
              {pagesCount > 0 && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  <FileText className="h-2.5 w-2.5 mr-0.5" />
                  {pagesCount}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {messages.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear conversation?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete all messages in this thread. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onClearMessages}>
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
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="text-center max-w-sm">
              <Bot className="h-10 w-10 mx-auto mb-3 text-primary/50" />
              <h4 className="text-sm font-medium mb-1">Start a conversation</h4>
              <p className="text-xs text-muted-foreground">
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
            
            {/* Streaming message */}
            {isStreaming && streamingMessage && (
              <MessageBubble
                message={{ role: 'assistant', content: streamingMessage }}
                conversationName="Workbench AI"
              />
            )}
            
            {/* Thinking indicator */}
            {isStreaming && !streamingMessage && (
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
