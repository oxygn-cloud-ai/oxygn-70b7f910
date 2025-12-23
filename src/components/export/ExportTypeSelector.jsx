import React from 'react';
import { FileText, Table2, CheckSquare, Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const EXPORT_TYPE_CONFIG = {
  confluence: {
    icon: FileText,
    title: 'Confluence Page',
    description: 'Export to a new Confluence page with optional template mapping',
    enabled: true,
    color: 'primary'
  },
  spreadsheet: {
    icon: Table2,
    title: 'Spreadsheet',
    description: 'Export to CSV or Excel format for data analysis',
    enabled: false,
    comingSoon: true,
    color: 'emerald'
  },
  jira: {
    icon: CheckSquare,
    title: 'Jira Issue',
    description: 'Create Jira issues from prompt data automatically',
    enabled: false,
    comingSoon: true,
    color: 'blue'
  }
};

export const ExportTypeSelector = ({
  selectedType,
  onSelectType,
  EXPORT_TYPES
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">Choose export destination</h3>
        <p className="text-xs text-muted-foreground">Select where you want to export your prompt data</p>
      </div>
      
      <div className="grid grid-cols-1 gap-3">
        {Object.entries(EXPORT_TYPE_CONFIG).map(([typeKey, config]) => {
          const isSelected = selectedType === typeKey;
          const Icon = config.icon;
          
          return (
            <button
              key={typeKey}
              onClick={() => config.enabled && onSelectType(typeKey)}
              disabled={!config.enabled}
              className={cn(
                "group relative flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all",
                config.enabled && isSelected && "border-primary bg-primary/5 shadow-sm",
                config.enabled && !isSelected && "border-border/50 hover:border-primary/30 hover:bg-muted/30",
                !config.enabled && "border-border/30 bg-muted/20 cursor-not-allowed"
              )}
            >
              {/* Icon container */}
              <div className={cn(
                "h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
                config.enabled && isSelected && "bg-primary/20 scale-105",
                config.enabled && !isSelected && "bg-muted group-hover:bg-muted/80",
                !config.enabled && "bg-muted/50"
              )}>
                <Icon className={cn(
                  "h-6 w-6 transition-colors",
                  config.enabled && isSelected && "text-primary",
                  config.enabled && !isSelected && "text-muted-foreground group-hover:text-foreground",
                  !config.enabled && "text-muted-foreground/50"
                )} />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    "text-base font-semibold transition-colors",
                    config.enabled && isSelected && "text-foreground",
                    config.enabled && !isSelected && "text-foreground",
                    !config.enabled && "text-muted-foreground"
                  )}>
                    {config.title}
                  </span>
                  {config.comingSoon && (
                    <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0 h-5">
                      <Lock className="h-2.5 w-2.5" />
                      Coming soon
                    </Badge>
                  )}
                </div>
                <p className={cn(
                  "text-sm transition-colors",
                  config.enabled ? "text-muted-foreground" : "text-muted-foreground/60"
                )}>
                  {config.description}
                </p>
              </div>
              
              {/* Selection indicator */}
              {config.enabled && (
                <div
                  className={cn(
                    "h-6 w-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all",
                    isSelected
                      ? "border-primary bg-primary scale-100"
                      : "border-muted-foreground/30 group-hover:border-primary/50 scale-90"
                  )}
                >
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground text-center pt-2">
        More export destinations coming soon
      </p>
    </div>
  );
};
