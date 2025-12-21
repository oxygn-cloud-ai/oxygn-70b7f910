import React, { useState } from 'react';
import { Bell, Trash2, CheckCircle, Info, XCircle, ChevronRight, Copy, Download, X, ArrowLeft } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToastHistory } from '@/contexts/ToastHistoryContext';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';

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

const getVariantLabel = (variant) => {
  switch (variant) {
    case 'destructive':
      return 'Error';
    case 'success':
      return 'Success';
    default:
      return 'Info';
  }
};

const formatTime = (date) => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatFullTime = (date) => {
  return date.toLocaleString([], { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });
};

// Detail view for a single notification
const NotificationDetail = ({ notification, onBack, onCopy, onRemove }) => {
  const handleCopyAll = async () => {
    const data = {
      type: notification.variant || 'info',
      title: notification.title || '',
      description: notification.description || '',
      timestamp: notification.timestamp.toISOString(),
      details: notification.details || null,
      errorCode: notification.errorCode || null,
      source: notification.source || null,
      stackTrace: notification.stackTrace || null,
    };
    await onCopy(JSON.stringify(data, null, 2));
    toast.success('Copied to clipboard');
  };

  const handleCopyField = async (label, value) => {
    await onCopy(value);
    toast.success(`${label} copied`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h4 className="text-sm font-medium flex-1">Notification Details</h4>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopyAll} title="Copy all details">
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Type & Time */}
          <div className="flex items-center gap-2">
            {getVariantIcon(notification.variant)}
            <span className={cn(
              "text-xs font-medium px-2 py-0.5 rounded",
              notification.variant === 'destructive' && "bg-destructive/10 text-destructive",
              notification.variant === 'success' && "bg-green-500/10 text-green-600",
              (!notification.variant || notification.variant === 'default') && "bg-muted text-muted-foreground"
            )}>
              {getVariantLabel(notification.variant)}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              {formatFullTime(notification.timestamp)}
            </span>
          </div>

          {/* Title */}
          {notification.title && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Title</label>
              <div className="flex items-start gap-2">
                <p className="text-sm font-medium flex-1">{notification.title}</p>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 flex-shrink-0" 
                  onClick={() => handleCopyField('Title', notification.title)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Description */}
          {notification.description && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Message</label>
              <div className="flex items-start gap-2">
                <p className="text-sm text-foreground flex-1 whitespace-pre-wrap break-words">
                  {notification.description}
                </p>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 flex-shrink-0" 
                  onClick={() => handleCopyField('Message', notification.description)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Error Code */}
          {notification.errorCode && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Error Code</label>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{notification.errorCode}</code>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6" 
                  onClick={() => handleCopyField('Error code', notification.errorCode)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Source */}
          {notification.source && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Source</label>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono flex-1 break-all">{notification.source}</code>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 flex-shrink-0" 
                  onClick={() => handleCopyField('Source', notification.source)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Details */}
          {notification.details && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Additional Details</label>
              <div className="relative">
                <pre className="text-xs bg-muted p-2 rounded font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-32">
                  {typeof notification.details === 'string' 
                    ? notification.details 
                    : JSON.stringify(notification.details, null, 2)}
                </pre>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 absolute top-1 right-1" 
                  onClick={() => handleCopyField('Details', typeof notification.details === 'string' ? notification.details : JSON.stringify(notification.details, null, 2))}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Stack Trace */}
          {notification.stackTrace && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Stack Trace</label>
              <div className="relative">
                <pre className="text-[10px] bg-muted p-2 rounded font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-40 text-muted-foreground">
                  {notification.stackTrace}
                </pre>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 absolute top-1 right-1" 
                  onClick={() => handleCopyField('Stack trace', notification.stackTrace)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer actions */}
      <div className="border-t px-3 py-2 flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1 text-xs"
          onClick={handleCopyAll}
        >
          <Copy className="h-3 w-3 mr-1" />
          Copy for Support
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Remove
        </Button>
      </div>
    </div>
  );
};

export function ToastHistoryPopover() {
  const { history, clearHistory, removeFromHistory, exportHistory, copyToClipboard } = useToastHistory();
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleExportAll = async () => {
    const data = exportHistory();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notifications-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Notifications exported');
  };

  const handleRemoveSelected = () => {
    if (selectedIndex !== null) {
      removeFromHistory(selectedIndex);
      setSelectedIndex(null);
    }
  };

  const handleOpenChange = (open) => {
    setIsOpen(open);
    if (!open) {
      setSelectedIndex(null);
    }
  };

  const selectedNotification = selectedIndex !== null ? history[selectedIndex] : null;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 relative text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <Bell className="h-4 w-4" />
          {history.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
              {history.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        side="top" 
        align="end" 
        className="w-96 p-0 h-[400px] flex flex-col"
        sideOffset={8}
      >
        {selectedNotification ? (
          <NotificationDetail 
            notification={selectedNotification}
            onBack={() => setSelectedIndex(null)}
            onCopy={copyToClipboard}
            onRemove={handleRemoveSelected}
          />
        ) : (
          <>
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <h4 className="text-sm font-medium">
                Notifications {history.length > 0 && <span className="text-muted-foreground">({history.length})</span>}
              </h4>
              {history.length > 0 && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={handleExportAll}
                    title="Export all notifications"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Export
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={clearHistory}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                </div>
              )}
            </div>
            <ScrollArea className="flex-1">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
                  <Bell className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                <div className="divide-y">
                  {history.map((item, index) => (
                    <button
                      key={`${item.id}-${index}`}
                      className={cn(
                        "flex gap-3 p-3 hover:bg-muted/50 transition-colors w-full text-left",
                        item.variant === 'destructive' && "bg-destructive/5"
                      )}
                      onClick={() => setSelectedIndex(index)}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getVariantIcon(item.variant)}
                      </div>
                      <div className="flex-1 min-w-0">
                        {item.title && (
                          <p className="text-sm font-medium truncate">{item.title}</p>
                        )}
                        {item.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {formatTime(item.timestamp)}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}