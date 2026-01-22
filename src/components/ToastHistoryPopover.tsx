import React, { useState, ReactNode } from 'react';
import { Bell, Trash2, CheckCircle, Info, XCircle, ChevronRight, Copy, Download, ArrowLeft, LucideIcon } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToastHistory } from '@/contexts/ToastHistoryContext';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type ToastVariant = 'destructive' | 'success' | 'default' | undefined;

interface ToastNotification {
  id?: string;
  variant?: ToastVariant;
  title?: string;
  description?: string;
  timestamp: Date;
  details?: string | Record<string, unknown>;
  errorCode?: string;
  source?: string;
  callStack?: string;
}

interface IconActionProps {
  icon: LucideIcon;
  onClick: () => void;
  tooltip: string;
  className?: string;
}

interface NotificationDetailProps {
  notification: ToastNotification;
  onBack: () => void;
  onCopy: (text: string) => Promise<boolean>;
  onRemove: () => void;
}

const getVariantIcon = (variant: ToastVariant): ReactNode => {
  switch (variant) {
    case 'destructive':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    default:
      return <Info className="h-4 w-4 text-on-surface-variant" />;
  }
};

const getVariantLabel = (variant: ToastVariant): string => {
  switch (variant) {
    case 'destructive':
      return 'Error';
    case 'success':
      return 'Success';
    default:
      return 'Info';
  }
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatFullTime = (date: Date): string => {
  return date.toLocaleString([], { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });
};

// Icon button component for consistent styling
const IconAction: React.FC<IconActionProps> = ({ icon: Icon, onClick, tooltip, className = '' }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "h-7 w-7 inline-flex items-center justify-center rounded-m3-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors",
            className
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[10px]">{tooltip}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

// Small icon for inline copy
const InlineCopyIcon: React.FC<{ onClick: () => void; tooltip: string }> = ({ onClick, tooltip }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className="h-5 w-5 inline-flex items-center justify-center rounded text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-container transition-colors flex-shrink-0"
        >
          <Copy className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[10px]">{tooltip}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

// Detail view for a single notification
const NotificationDetail: React.FC<NotificationDetailProps> = ({ notification, onBack, onCopy, onRemove }) => {
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const showFeedback = (message: string) => {
    setCopyFeedback(message);
    setTimeout(() => setCopyFeedback(null), 1500);
  };

  const handleCopyAll = async () => {
    const data = {
      type: notification.variant || 'info',
      title: notification.title || '',
      description: notification.description || '',
      timestamp: notification.timestamp.toISOString(),
      details: notification.details || null,
      errorCode: notification.errorCode || null,
      source: notification.source || null,
      callStack: notification.callStack || null,
    };
    const success = await onCopy(JSON.stringify(data, null, 2));
    showFeedback(success ? 'Copied!' : 'Failed');
  };

  const handleCopyField = async (label: string, value: string) => {
    const success = await onCopy(value);
    showFeedback(success ? `${label} copied` : 'Failed');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-outline-variant">
        <IconAction icon={ArrowLeft} onClick={onBack} tooltip="Back" />
        <h4 className="text-body-sm font-medium flex-1 text-on-surface">Details</h4>
        {copyFeedback && (
          <span className="text-[10px] text-green-500 animate-pulse">{copyFeedback}</span>
        )}
        <IconAction icon={Copy} onClick={handleCopyAll} tooltip="Copy all for support" />
        <IconAction 
          icon={Trash2} 
          onClick={onRemove} 
          tooltip="Remove" 
          className="text-red-500/70 hover:text-red-500 hover:bg-red-500/10" 
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Type & Time */}
          <div className="flex items-center gap-2">
            {getVariantIcon(notification.variant)}
            <span className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded",
              notification.variant === 'destructive' && "bg-red-500/10 text-red-500",
              notification.variant === 'success' && "bg-green-500/10 text-green-600",
              (!notification.variant || notification.variant === 'default') && "bg-surface-container text-on-surface-variant"
            )}>
              {getVariantLabel(notification.variant)}
            </span>
            <span className="text-[10px] text-on-surface-variant ml-auto">
              {formatFullTime(notification.timestamp)}
            </span>
          </div>

          {/* Title */}
          {notification.title && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-on-surface-variant font-medium">Title</label>
              <div className="flex items-start gap-2">
                <p className="text-body-sm font-medium flex-1 text-on-surface">{notification.title}</p>
                <InlineCopyIcon onClick={() => handleCopyField('Title', notification.title!)} tooltip="Copy title" />
              </div>
            </div>
          )}

          {/* Description */}
          {notification.description && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-on-surface-variant font-medium">Message</label>
              <div className="flex items-start gap-2">
                <p className="text-body-sm text-on-surface flex-1 whitespace-pre-wrap break-words">
                  {notification.description}
                </p>
                <InlineCopyIcon onClick={() => handleCopyField('Message', notification.description!)} tooltip="Copy message" />
              </div>
            </div>
          )}

          {/* Error Code */}
          {notification.errorCode && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-on-surface-variant font-medium">Error Code</label>
              <div className="flex items-center gap-2">
                <code className="text-[10px] bg-surface-container px-2 py-1 rounded font-mono text-on-surface">{notification.errorCode}</code>
                <InlineCopyIcon onClick={() => handleCopyField('Error code', notification.errorCode!)} tooltip="Copy error code" />
              </div>
            </div>
          )}

          {/* Source */}
          {notification.source && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-on-surface-variant font-medium">Source</label>
              <div className="flex items-center gap-2">
                <code className="text-[10px] bg-surface-container px-2 py-1 rounded font-mono flex-1 break-all text-on-surface">{notification.source}</code>
                <InlineCopyIcon onClick={() => handleCopyField('Source', notification.source!)} tooltip="Copy source" />
              </div>
            </div>
          )}

          {/* Details */}
          {notification.details && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-wide text-on-surface-variant font-medium">Additional Details</label>
                <InlineCopyIcon 
                  onClick={() => handleCopyField('Details', typeof notification.details === 'string' ? notification.details : JSON.stringify(notification.details, null, 2))} 
                  tooltip="Copy details" 
                />
              </div>
              <pre className="text-[10px] bg-surface-container p-2 rounded font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-32 text-on-surface">
                {typeof notification.details === 'string' 
                  ? notification.details 
                  : JSON.stringify(notification.details, null, 2)}
              </pre>
            </div>
          )}

          {/* Call Stack */}
          {notification.callStack && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-wide text-on-surface-variant font-medium">Call Stack</label>
                <InlineCopyIcon onClick={() => handleCopyField('Call stack', notification.callStack!)} tooltip="Copy call stack" />
              </div>
              <pre className="text-[10px] bg-surface-container p-2 rounded font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-40 text-on-surface-variant">
                {notification.callStack}
              </pre>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export function ToastHistoryPopover() {
  const { history, clearHistory, removeFromHistory, exportHistory, copyToClipboard } = useToastHistory();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const showFeedback = (message: string) => {
    setActionFeedback(message);
    setTimeout(() => setActionFeedback(null), 1500);
  };

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
    showFeedback('Exported!');
  };

  const handleRemoveSelected = () => {
    if (selectedIndex !== null) {
      removeFromHistory(selectedIndex);
      setSelectedIndex(null);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSelectedIndex(null);
      setActionFeedback(null);
    }
  };

  const selectedNotification = selectedIndex !== null ? history[selectedIndex] : null;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-8 w-8 relative inline-flex items-center justify-center rounded-m3-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
        >
          <Bell className="h-4 w-4" />
          {history.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-[10px] font-medium text-on-primary flex items-center justify-center">
              {history.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent 
        side="top" 
        align="end" 
        className="w-96 p-0 h-[400px] flex flex-col bg-surface-container-high border-outline-variant"
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
            <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant">
              <h4 className="text-body-sm font-medium text-on-surface">
                Notifications {history.length > 0 && <span className="text-on-surface-variant">({history.length})</span>}
              </h4>
              {actionFeedback && (
                <span className="text-[10px] text-green-500 animate-pulse">{actionFeedback}</span>
              )}
              {history.length > 0 && (
                <div className="flex gap-0.5">
                  <IconAction icon={Download} onClick={handleExportAll} tooltip="Export all" />
                  <IconAction icon={Trash2} onClick={clearHistory} tooltip="Clear all" />
                </div>
              )}
            </div>
            <ScrollArea className="flex-1">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-8 text-on-surface-variant">
                  <Bell className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-body-sm">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-outline-variant">
                  {history.map((item, index) => (
                    <button
                      key={`${item.id}-${index}`}
                      type="button"
                      className={cn(
                        "flex gap-3 p-3 hover:bg-surface-container transition-colors w-full text-left",
                        item.variant === 'destructive' && "bg-red-500/5"
                      )}
                      onClick={() => setSelectedIndex(index)}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getVariantIcon(item.variant)}
                      </div>
                      <div className="flex-1 min-w-0">
                        {item.title && (
                          <p className="text-body-sm font-medium truncate text-on-surface">{item.title}</p>
                        )}
                        {item.description && (
                          <p className="text-[10px] text-on-surface-variant line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        <p className="text-[10px] text-on-surface-variant/70 mt-1">
                          {formatTime(item.timestamp)}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-on-surface-variant flex-shrink-0 mt-0.5" />
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
