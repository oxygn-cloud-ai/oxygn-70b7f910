import React from 'react';
import { FileText, Search, FolderOpen, Bot, Inbox, AlertCircle, Plus } from 'lucide-react';
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
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      {/* M3 Icon Container with surface tint */}
      <div className="w-16 h-16 rounded-full bg-primary/8 flex items-center justify-center mb-6 animate-scale-in">
        <Icon className="h-8 w-8 text-primary" />
      </div>

      {/* M3 Typography - Headline Small */}
      <h3 className="text-headline-small text-on-surface mb-2">{title}</h3>

      {/* M3 Typography - Body Medium */}
      <p className="text-body-medium text-on-surface-variant max-w-[280px] mb-6">{description}</p>

      {/* M3 FAB Action */}
      {onAction && (actionIcon || actionLabel) && (
        actionIcon ? (
          <Button
            variant="fab"
            size="fab"
            onClick={onAction}
            aria-label={actionAriaLabel || actionLabel || 'Action'}
            className="animate-fade-in"
          >
            {actionIcon}
          </Button>
        ) : (
          <Button 
            variant="fabExtended" 
            onClick={onAction}
            className="animate-fade-in"
          >
            <Plus className="h-5 w-5 mr-2" />
            {actionLabel}
          </Button>
        )
      )}

      {/* M3 Tip with subtle styling */}
      {tip && (
        <p className="text-label-medium text-on-surface-variant mt-6 flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container-low">
          <span className="text-primary">💡</span>
          <span>{tip}</span>
        </p>
      )}
    </div>
  );
}

export default EmptyState;
