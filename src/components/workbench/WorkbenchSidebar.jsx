import React, { useState } from 'react';
import { Plus, MessageSquare, MoreHorizontal, Edit2, Trash2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { trackEvent } from '@/lib/posthog';

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
      trackEvent('workbench_thread_renamed', { thread_id: editingId });
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
    <div className="h-full flex flex-col bg-card/50 border-r border-border">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Threads</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onCreateThread()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Thread List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {threads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No threads yet</p>
              <Button
                variant="link"
                size="sm"
                className="mt-1"
                onClick={() => onCreateThread()}
              >
                Create your first thread
              </Button>
            </div>
          ) : (
            threads.map((thread) => (
              <div
                key={thread.row_id}
                className={cn(
                  "group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors",
                  activeThread?.row_id === thread.row_id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted/50"
                )}
                onClick={() => onSelectThread(thread)}
              >
                <MessageSquare className="h-4 w-4 shrink-0 opacity-60" />
                
                {editingId === thread.row_id ? (
                  <div className="flex-1 flex items-center gap-1">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="h-6 text-xs"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveEdit();
                      }}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelEdit();
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {thread.title || 'Untitled'}
                      </p>
                      {thread.updated_at && (
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(thread.updated_at), { addSuffix: true })}
                        </p>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleStartEdit(thread)}>
                          <Edit2 className="h-3.5 w-3.5 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => onDeleteThread(thread.row_id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default WorkbenchSidebar;
