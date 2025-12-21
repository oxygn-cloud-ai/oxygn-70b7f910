import React, { useState } from 'react';
import { Plus, Trash2, MessageSquare, Search, Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const ThreadSidebar = ({
  threads,
  activeThread,
  isLoading,
  onSelectThread,
  onCreateThread,
  onDeleteThread,
  onRenameThread,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingThreadId, setEditingThreadId] = useState(null);
  const [editName, setEditName] = useState('');

  const filteredThreads = threads.filter(thread => 
    thread.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    thread.preview?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartRename = (thread, e) => {
    e.stopPropagation();
    setEditingThreadId(thread.row_id);
    setEditName(thread.name || '');
  };

  const handleSaveRename = (threadId) => {
    if (editName.trim()) {
      onRenameThread?.(threadId, editName.trim());
    }
    setEditingThreadId(null);
    setEditName('');
  };

  const handleCancelRename = () => {
    setEditingThreadId(null);
    setEditName('');
  };

  return (
    <div className="h-full flex flex-col bg-card/50 backdrop-blur-sm">
      {/* Header */}
      <div className="px-2 py-1.5 border-b border-border space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-foreground">
            Conversations
          </span>
          <div className="flex items-center gap-0.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 hover:bg-primary/10 hover:text-primary"
                    onClick={onCreateThread}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New conversation</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 hover:bg-muted"
                onClick={onClose}
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-xs bg-background/50"
          />
        </div>
      </div>

      {/* Thread list */}
      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-0.5">
          {isLoading ? (
            [1, 2, 3].map(i => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))
          ) : filteredThreads.length === 0 ? (
            <div className="text-center py-4 px-2">
              <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/50" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                {searchQuery ? 'No matches' : 'No conversations'}
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                {searchQuery ? 'Try different search' : 'Start chatting'}
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredThreads.map((thread) => (
                <motion.div
                  key={thread.row_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onClick={() => onSelectThread(thread.row_id)}
                  className={cn(
                    'group relative px-2 py-1.5 rounded-md cursor-pointer transition-all',
                    activeThread?.row_id === thread.row_id
                      ? 'bg-primary/10 border-l-2 border-l-primary'
                      : 'hover:bg-muted/50 border-l-2 border-l-transparent'
                  )}
                >
                  <div className="flex items-start gap-1.5">
                    <MessageSquare className={cn(
                      "h-3 w-3 mt-0.5 shrink-0",
                      activeThread?.row_id === thread.row_id ? "text-primary" : "text-muted-foreground"
                    )} />
                    <div className="flex-1 min-w-0">
                      {editingThreadId === thread.row_id ? (
                        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-5 text-[11px]"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(thread.row_id);
                              if (e.key === 'Escape') handleCancelRename();
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 shrink-0"
                            onClick={() => handleSaveRename(thread.row_id)}
                          >
                            <Check className="h-2.5 w-2.5 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 shrink-0"
                            onClick={handleCancelRename}
                          >
                            <X className="h-2.5 w-2.5 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="text-xs font-medium truncate text-foreground leading-tight">
                            {thread.name || 'Untitled'}
                          </div>
                          {thread.last_message_at && (
                            <p className="text-[10px] text-muted-foreground/70 leading-tight">
                              {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {editingThreadId !== thread.row_id && (
                    <div className={cn(
                      "absolute right-1 top-1 flex items-center gap-0.5 transition-opacity",
                      "opacity-0 group-hover:opacity-100"
                    )}>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 hover:bg-muted"
                              onClick={(e) => handleStartRename(thread, e)}
                            >
                              <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Rename</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteThread(thread.row_id);
                              }}
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ThreadSidebar;