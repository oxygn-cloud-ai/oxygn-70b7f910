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
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">
            Conversations
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                  onClick={onCreateThread}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New conversation</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-8 text-sm bg-background/50"
          />
        </div>
      </div>

      {/* Thread list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            [1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))
          ) : filteredThreads.length === 0 ? (
            <div className="text-center py-8 px-4">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {searchQuery ? 'No matching conversations' : 'No conversations yet'}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {searchQuery ? 'Try a different search' : 'Start chatting to create one'}
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
                    'group relative p-3 rounded-lg cursor-pointer transition-all',
                    activeThread?.row_id === thread.row_id
                      ? 'bg-primary/10 border-l-2 border-l-primary shadow-sm'
                      : 'hover:bg-muted/50 border-l-2 border-l-transparent'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare className={cn(
                      "h-4 w-4 mt-0.5 shrink-0",
                      activeThread?.row_id === thread.row_id ? "text-primary" : "text-muted-foreground"
                    )} />
                    <div className="flex-1 min-w-0">
                      {editingThreadId === thread.row_id ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-6 text-xs"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(thread.row_id);
                              if (e.key === 'Escape') handleCancelRename();
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            onClick={() => handleSaveRename(thread.row_id)}
                          >
                            <Check className="h-3 w-3 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            onClick={handleCancelRename}
                          >
                            <X className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="text-sm font-medium truncate text-foreground">
                            {thread.name || 'Untitled'}
                          </div>
                          {thread.preview && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {thread.preview}
                            </p>
                          )}
                          {thread.last_message_at && (
                            <p className="text-[10px] text-muted-foreground/70 mt-1">
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
                      "absolute right-2 top-2 flex items-center gap-0.5 transition-opacity",
                      "opacity-0 group-hover:opacity-100"
                    )}>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 hover:bg-muted"
                              onClick={(e) => handleStartRename(thread, e)}
                            >
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Rename</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteThread(thread.row_id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
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