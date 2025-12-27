import React, { useState } from 'react';
import { Plus, Trash2, MessageSquare, Search, Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { M3IconButton } from '@/components/ui/m3-icon-button';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

// M3 Motion tokens
const m3Motion = {
  emphasized: {
    initial: { opacity: 0, y: 8, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -4, scale: 0.98 },
  },
  duration: { enter: 0.35, exit: 0.2 },
  easing: { enter: [0.05, 0.7, 0.1, 1], exit: [0.3, 0, 0.8, 0.15] },
};

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
    <div className="h-full flex flex-col bg-surface-container-low dark:bg-surface-container-lowest">
      {/* Header - M3 Surface Container */}
      <div className="px-4 py-3 border-b border-outline-variant space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-title-small font-medium text-on-surface">
            Conversations
          </span>
          <div className="flex items-center gap-1">
            <M3IconButton
              size="small"
              tooltip="New conversation"
              onClick={onCreateThread}
            >
              <Plus />
            </M3IconButton>
            {onClose && (
              <M3IconButton
                size="small"
                tooltip="Close"
                onClick={onClose}
              >
                <X />
              </M3IconButton>
            )}
          </div>
        </div>

        {/* M3 Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-on-surface-variant" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 pl-10 text-body-medium bg-surface-container-highest dark:bg-surface-container-high rounded-full border-0 focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
      </div>

      {/* Thread list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            [1, 2, 3].map(i => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))
          ) : filteredThreads.length === 0 ? (
            <motion.div 
              className="text-center py-8 px-4"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.05, 0.7, 0.1, 1] }}
            >
              <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="h-7 w-7 text-on-surface-variant/50" />
              </div>
              <p className="text-title-small font-medium text-on-surface">
                {searchQuery ? 'No matches found' : 'No conversations yet'}
              </p>
              <p className="text-body-small text-on-surface-variant mt-1">
                {searchQuery ? 'Try a different search term' : 'Start a new conversation'}
              </p>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredThreads.map((thread, index) => (
                <motion.div
                  key={thread.row_id}
                  layout
                  initial={m3Motion.emphasized.initial}
                  animate={m3Motion.emphasized.animate}
                  exit={m3Motion.emphasized.exit}
                  transition={{
                    duration: m3Motion.duration.enter,
                    ease: m3Motion.easing.enter,
                    delay: index * 0.03,
                  }}
                  onClick={() => onSelectThread(thread.row_id)}
                  className={cn(
                    'group relative px-3 py-3 rounded-xl cursor-pointer',
                    'transition-all duration-medium-2 ease-standard',
                    activeThread?.row_id === thread.row_id
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'hover:bg-surface-container-highest dark:hover:bg-surface-container-high'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* M3 Icon container */}
                    <div className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                      "transition-colors duration-medium-1",
                      activeThread?.row_id === thread.row_id
                        ? "bg-on-secondary-container/12"
                        : "bg-surface-container-high dark:bg-surface-container"
                    )}>
                      <MessageSquare className={cn(
                        "h-5 w-5",
                        activeThread?.row_id === thread.row_id 
                          ? "text-on-secondary-container" 
                          : "text-on-surface-variant"
                      )} />
                    </div>
                    
                    <div className="flex-1 min-w-0 py-0.5">
                      {editingThreadId === thread.row_id ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8 text-body-medium bg-surface-container-highest"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(thread.row_id);
                              if (e.key === 'Escape') handleCancelRename();
                            }}
                          />
                          <M3IconButton
                            size="small"
                            variant="filledTonal"
                            onClick={() => handleSaveRename(thread.row_id)}
                          >
                            <Check className="text-primary" />
                          </M3IconButton>
                          <M3IconButton
                            size="small"
                            onClick={handleCancelRename}
                          >
                            <X />
                          </M3IconButton>
                        </div>
                      ) : (
                        <>
                          <p className="text-body-large font-medium truncate leading-tight">
                            {thread.name || 'Untitled'}
                          </p>
                          {thread.last_message_at && (
                            <p className="text-body-small text-on-surface-variant mt-0.5">
                              {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions - M3 Icon Buttons */}
                  {editingThreadId !== thread.row_id && (
                    <motion.div 
                      className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5",
                        "opacity-0 group-hover:opacity-100 transition-opacity duration-short-4"
                      )}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                    >
                      <M3IconButton
                        size="small"
                        tooltip="Rename"
                        onClick={(e) => handleStartRename(thread, e)}
                      >
                        <Pencil />
                      </M3IconButton>
                      <M3IconButton
                        size="small"
                        tooltip="Delete"
                        className="hover:bg-error-container hover:text-on-error-container"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteThread(thread.row_id);
                        }}
                      >
                        <Trash2 />
                      </M3IconButton>
                    </motion.div>
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
