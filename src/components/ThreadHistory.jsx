import React, { useEffect } from 'react';
import { History, User, Bot, Loader2 } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
      <TooltipProvider>
        <Tooltip>
          <DialogTrigger asChild>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 !text-muted-foreground hover:!text-foreground hover:!bg-muted/50">
                <History className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
          </DialogTrigger>
          <TooltipContent>{TOOLTIPS.threads.viewHistory}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Thread History
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No messages in this thread yet.
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={message.id || index}
                  className={`flex gap-3 ${
                    message.role === 'assistant' ? 'bg-muted/50' : ''
                  } rounded-lg p-3`}
                >
                  <div className="flex-shrink-0">
                    {message.role === 'user' ? (
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {message.role === 'user' ? 'You' : 'Assistant'}
                      </span>
                      {message.created_at && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.created_at * 1000).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">
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
