import React from 'react';
import { Bell, Trash2, AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToastHistory } from '@/contexts/ToastHistoryContext';
import { cn } from '@/lib/utils';

const getVariantIcon = (variant) => {
  switch (variant) {
    case 'destructive':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    default:
      return <Info className="h-4 w-4 text-muted-foreground" />;
  }
};

const formatTime = (date) => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export function ToastHistoryPopover() {
  const { history, clearHistory } = useToastHistory();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 relative text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <Bell className="h-4 w-4" />
          {history.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
              {history.length > 9 ? '9+' : history.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        side="top" 
        align="end" 
        className="w-80 p-0"
        sideOffset={8}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <h4 className="text-sm font-medium">Notifications</h4>
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={clearHistory}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {history.map((toast, index) => (
                <div
                  key={`${toast.id}-${index}`}
                  className={cn(
                    "flex gap-3 p-3 hover:bg-muted/50 transition-colors",
                    toast.variant === 'destructive' && "bg-destructive/5"
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getVariantIcon(toast.variant)}
                  </div>
                  <div className="flex-1 min-w-0">
                    {toast.title && (
                      <p className="text-sm font-medium truncate">{toast.title}</p>
                    )}
                    {toast.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {toast.description}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {formatTime(toast.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
