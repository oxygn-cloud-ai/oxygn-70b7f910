import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import type { ChatThread } from '@/types/chat';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ThreadDropdownProps {
  threads: ChatThread[];
  activeThread: ChatThread | null;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => void;
  onDeleteThread: (threadId: string) => void;
}

export const ThreadDropdown = ({ 
  threads, 
  activeThread, 
  onSelectThread, 
  onCreateThread, 
  onDeleteThread 
}: ThreadDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-m3-sm bg-surface-container hover:bg-surface-container-high text-body-sm text-on-surface"
      >
        <span className="truncate max-w-[120px]">
          {activeThread?.name || 'Select chat'}
        </span>
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-surface-container-high rounded-m3-md shadow-lg border border-outline-variant z-20 py-1 max-h-64 overflow-auto">
          <button
            onClick={() => {
              onCreateThread?.();
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-body-sm text-primary hover:bg-surface-container"
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </button>
          
          {threads.length > 0 && <div className="h-px bg-outline-variant my-1" />}
          
          {threads.map(thread => (
            <div 
              key={thread.row_id}
              className={`flex items-center justify-between px-3 py-1.5 hover:bg-surface-container group ${
                activeThread?.row_id === thread.row_id ? 'bg-surface-container' : ''
              }`}
            >
              <button
                onClick={() => {
                  onSelectThread?.(thread.row_id);
                  setIsOpen(false);
                }}
                className="flex-1 text-left text-body-sm text-on-surface truncate"
              >
                {thread.name || 'Untitled'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirmId(thread.row_id);
                }}
                className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:text-destructive hover:bg-surface-container"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this chat thread and its history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (deleteConfirmId) {
                onDeleteThread?.(deleteConfirmId);
                setDeleteConfirmId(null);
                setIsOpen(false);
              }
            }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
