import React, { useEffect } from 'react';
import { History, User, Bot, Loader2 } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { M3IconButton } from '@/components/ui/m3-icon-button';
import { TOOLTIPS } from '@/config/labels';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const ThreadHistory = ({
  messages,
  isLoading,
  onFetchMessages,
  threadRowId,
}) => {
  useEffect(() => {
    if (threadRowId) {
      onFetchMessages(threadRowId);
    }
  }, [threadRowId, onFetchMessages]);

  const formatContent = (content) => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((c) => {
          if (c.type === 'text') return c.text?.value || '';
          return '[attachment]';
        })
        .join('\n');
    }
    return JSON.stringify(content);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <M3IconButton size="small" tooltip={TOOLTIPS.threads.viewHistory}>
          <History className="h-5 w-5" />
        </M3IconButton>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] bg-surface-container-high border-outline-variant">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-headline-small text-on-surface">
            <History className="h-5 w-5" />
            Thread History
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-on-surface-variant text-body-medium">
              No messages in this thread yet.
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={message.id || index}
                  className={`flex gap-3 ${
                    message.role === 'assistant' ? 'bg-surface-container-highest' : ''
                  } rounded-xl p-3 transition-colors duration-medium-1`}
                >
                  <div className="flex-shrink-0">
                    {message.role === 'user' ? (
                      <div className="h-10 w-10 rounded-full bg-primary-container flex items-center justify-center">
                        <User className="h-5 w-5 text-on-primary-container" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-secondary-container flex items-center justify-center">
                        <Bot className="h-5 w-5 text-on-secondary-container" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-label-large font-medium text-on-surface">
                        {message.role === 'user' ? 'You' : 'AI'}
                      </span>
                      {message.created_at && (
                        <span className="text-label-small text-on-surface-variant">
                          {typeof message.created_at === 'number' 
                            ? new Date(message.created_at * 1000).toLocaleString()
                            : new Date(message.created_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="text-body-medium text-on-surface whitespace-pre-wrap">
                      {formatContent(message.content)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ThreadHistory;
