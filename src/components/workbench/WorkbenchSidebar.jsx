import React, { useState } from 'react';
import { Plus, MessageSquare, MoreHorizontal, Edit2, Trash2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { M3IconButton } from '@/components/ui/m3-icon-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

const WorkbenchSidebar = ({
  threads,
  activeThread,
  onSelectThread,
  onCreateThread,
  onUpdateThread,
  onDeleteThread
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const handleStartEdit = (thread) => {
    setEditingId(thread.row_id);
    setEditValue(thread.title || 'Untitled');
  };

  const handleSaveEdit = async () => {
    if (editingId && editValue.trim()) {
      await onUpdateThread(editingId, { title: editValue.trim() });
    }
    setEditingId(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface-container-low dark:bg-surface-container-lowest border-r border-outline-variant">
      {/* Header - M3 Surface */}
      <div className="p-4 border-b border-outline-variant flex items-center justify-between">
        <h2 className="text-title-medium font-medium text-on-surface">Threads</h2>
        <M3IconButton
          size="small"
          tooltip="New thread"
          onClick={() => onCreateThread()}
        >
          <Plus />
        </M3IconButton>
      </div>

      {/* Thread List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {threads.length === 0 ? (
            <motion.div 
              className="text-center py-12 px-4"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.05, 0.7, 0.1, 1] }}
            >
              <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-8 w-8 text-on-surface-variant/50" />
              </div>
              <p className="text-title-small font-medium text-on-surface">No threads yet</p>
              <p className="text-body-small text-on-surface-variant mt-1 mb-4">
                Create your first thread to get started
              </p>
              <button
                onClick={() => onCreateThread()}
                className="text-label-large text-primary hover:text-primary/80 transition-colors duration-short-4"
              >
                Create thread
              </button>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {threads.map((thread, index) => (
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
                  className={cn(
                    "group flex items-center gap-3 p-3 rounded-xl cursor-pointer",
                    "transition-all duration-medium-2 ease-standard",
                    activeThread?.row_id === thread.row_id
                      ? "bg-secondary-container text-on-secondary-container"
                      : "hover:bg-surface-container-highest dark:hover:bg-surface-container-high"
                  )}
                  onClick={() => onSelectThread(thread)}
                >
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
                  
                  {editingId === thread.row_id ? (
                    <div className="flex-1 flex items-center gap-1">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="h-8 text-body-medium bg-surface-container-highest"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                      <M3IconButton
                        size="small"
                        variant="filledTonal"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveEdit();
                        }}
                      >
                        <Check className="text-primary" />
                      </M3IconButton>
                      <M3IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelEdit();
                        }}
                      >
                        <X />
                      </M3IconButton>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-body-large font-medium truncate">
                          {thread.title || 'Untitled'}
                        </p>
                        {thread.updated_at && (
                          <p className="text-body-small text-on-surface-variant">
                            {formatDistanceToNow(new Date(thread.updated_at), { addSuffix: true })}
                          </p>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-short-4"
                          >
                            <M3IconButton size="small">
                              <MoreHorizontal />
                            </M3IconButton>
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-surface-container-high border-outline-variant">
                          <DropdownMenuItem 
                            onClick={() => handleStartEdit(thread)}
                            className="gap-2 text-body-medium"
                          >
                            <Edit2 className="h-5 w-5" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2 text-body-medium text-error focus:text-error"
                            onClick={() => onDeleteThread(thread.row_id)}
                          >
                            <Trash2 className="h-5 w-5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
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

export default WorkbenchSidebar;
