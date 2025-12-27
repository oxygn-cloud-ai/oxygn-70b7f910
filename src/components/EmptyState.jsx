import React from 'react';
import { FileText, Search, FolderOpen, Bot, Inbox, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";

const iconMap = {
  file: FileText,
  search: Search,
  folder: FolderOpen,
  bot: Bot,
  inbox: Inbox,
  alert: AlertCircle,
};

export function EmptyState({
  icon = 'inbox',
  title = 'No items',
  description = 'Get started by creating your first item.',
  actionLabel,
  actionIcon,
  actionAriaLabel,
  onAction,
  tip,
  className = '',
}) {
  const Icon = iconMap[icon] || Inbox;

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      {/* Icon */}
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground max-w-[240px] mb-4">{description}</p>

      {/* Action */}
      {onAction && (actionIcon || actionLabel) && (
        actionIcon ? (
          <button
            type="button"
            onClick={onAction}
            aria-label={actionAriaLabel || actionLabel || 'Action'}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {actionIcon}
          </button>
        ) : (
          <Button variant="secondary" onClick={onAction}>
            {actionLabel}
          </Button>
        )
      )}

      {/* Tip */}
      {tip && (
        <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
          <span className="text-primary">💡</span>
          <span>Tip: {tip}</span>
        </p>
      )}
    </div>
  );
}

export default EmptyState;
