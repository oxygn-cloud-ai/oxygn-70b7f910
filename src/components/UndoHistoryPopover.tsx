import { useState } from 'react';
import { History, Trash2, RotateCcw, Move, Command } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUndo } from '@/contexts/UndoContext';
import { cn } from '@/lib/utils';

interface UndoAction {
  id: string;
  type: string;
  itemName?: string;
  timestamp: number;
  [key: string]: unknown;
}

interface UndoHistoryPopoverProps {
  onUndo: (action: UndoAction) => Promise<void>;
}

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getActionIcon = (type: string) => {
  switch (type) {
    case 'delete':
      return <Trash2 className="h-4 w-4 text-red-500" />;
    case 'move':
      return <Move className="h-4 w-4 text-amber-500" />;
    default:
      return <RotateCcw className="h-4 w-4 text-on-surface-variant" />;
  }
};

const getActionLabel = (type: string) => {
  switch (type) {
    case 'delete':
      return 'Deleted';
    case 'move':
      return 'Moved';
    default:
      return 'Changed';
  }
};

export function UndoHistoryPopover({ onUndo }: UndoHistoryPopoverProps) {
  const { undoStack, clearAllUndo, hasUndo } = useUndo();
  const [isOpen, setIsOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleUndo = async (action: UndoAction) => {
    setLoadingId(action.id);
    try {
      await onUndo(action);
    } finally {
      setLoadingId(null);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  const sortedStack = [...undoStack].reverse();

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <motion.button
              type="button"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-9 h-9 relative flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors duration-200"
            >
              <History className="h-4 w-4" />
              <AnimatePresence>
                {hasUndo && (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-[10px] font-medium text-on-primary flex items-center justify-center"
                  >
                    {undoStack.length}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent className="text-[10px]">
          <div className="flex items-center gap-1">
            <span>Undo history</span>
            <span className="flex items-center gap-0.5 text-on-surface-variant">
              <Command className="h-2.5 w-2.5" />Z
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
      <PopoverContent 
        side="bottom" 
        align="end" 
        className="w-80 p-0 bg-surface-container-high border-outline-variant"
        sideOffset={8}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant">
          <h4 className="text-body-sm font-medium text-on-surface">
            Undo History {hasUndo && <span className="text-on-surface-variant">({undoStack.length})</span>}
          </h4>
          {hasUndo && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={clearAllUndo}
                  className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Clear history</TooltipContent>
            </Tooltip>
          )}
        </div>
        <ScrollArea className="max-h-[320px]">
          {!hasUndo ? (
            <div className="flex flex-col items-center justify-center py-8 text-on-surface-variant">
              <History className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-body-sm">No actions to undo</p>
              <p className="text-[10px] mt-1">Delete or move prompts to see them here</p>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant">
              <AnimatePresence>
                {sortedStack.map((action, index) => (
                  <motion.div
                    key={action.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.02 }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 hover:bg-surface-container transition-colors group",
                      loadingId === action.id && "opacity-50 pointer-events-none"
                    )}
                  >
                    <div className="flex-shrink-0">
                      {getActionIcon(action.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm text-on-surface truncate font-medium">
                        {action.itemName}
                      </p>
                      <p className="text-[10px] text-on-surface-variant">
                        {getActionLabel(action.type)} • {formatTime(action.timestamp)}
                      </p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => handleUndo(action)}
                          disabled={loadingId === action.id}
                          className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant opacity-0 group-hover:opacity-100 hover:bg-primary/10 hover:text-primary transition-all"
                        >
                          {loadingId === action.id ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </motion.div>
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-[10px]">Undo this action</TooltipContent>
                    </Tooltip>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
        {hasUndo && (
          <div className="px-3 py-2 border-t border-outline-variant bg-surface-container">
            <p className="text-[10px] text-on-surface-variant text-center flex items-center justify-center gap-1">
              Press <Command className="h-2.5 w-2.5" />Z to undo last action
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
