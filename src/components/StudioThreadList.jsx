import React from 'react';
import { Plus, Trash2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';

const StudioThreadList = ({
  threads,
  activeThreadId,
  onSwitchThread,
  onCreateThread,
  onDeleteThread,
  isLoading,
  disabled,
}) => {
  const handleDelete = (e, threadRowId) => {
    e.stopPropagation();
    onDeleteThread(threadRowId);
  };

  if (isLoading) {
    return (
      <div className="h-full border-r border-border bg-background/50 p-3 space-y-2">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-medium text-muted-foreground">Threads</div>
          <Skeleton className="h-7 w-7" />
        </div>
        {[1, 2].map(i => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="h-full border-r border-border bg-background/50 flex flex-col">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">Threads</div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onCreateThread}
                disabled={disabled}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New Thread</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {threads.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8 px-2">
              {disabled
                ? 'Select an assistant to view threads'
                : 'No threads yet. Start a conversation!'}
            </div>
          ) : (
            threads.map((thread) => {
              const isActive = activeThreadId === thread.row_id;

              return (
                <div
                  key={thread.row_id}
                  onClick={() => onSwitchThread(thread.row_id)}
                  className={cn(
                    'group flex items-start gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted/50 text-foreground'
                  )}
                >
                  <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {thread.name || 'Untitled Thread'}
                    </div>
                    {thread.last_message_at && (
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })}
                      </div>
                    )}
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => handleDelete(e, thread.row_id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete Thread</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default StudioThreadList;
