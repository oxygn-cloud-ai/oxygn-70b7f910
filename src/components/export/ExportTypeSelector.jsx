import React from 'react';
import { FileText, Table2, CheckSquare, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const EXPORT_TYPE_CONFIG = {
  confluence: {
    icon: FileText,
    title: 'Confluence Page',
    description: 'Export to a new Confluence page with optional template mapping',
    enabled: true
  },
  spreadsheet: {
    icon: Table2,
    title: 'Spreadsheet',
    description: 'Export to CSV or Excel format',
    enabled: false,
    comingSoon: true
  },
  jira: {
    icon: CheckSquare,
    title: 'Jira Issue',
    description: 'Create Jira issues from prompt data',
    enabled: false,
    comingSoon: true
  }
};

export const ExportTypeSelector = ({
  selectedType,
  onSelectType,
  EXPORT_TYPES
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-foreground">Choose export destination</h3>
      
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
                "flex items-start gap-4 p-4 rounded-lg border text-left transition-all",
                config.enabled && isSelected && "border-primary bg-primary/5 ring-1 ring-primary",
                config.enabled && !isSelected && "border-border hover:border-primary/50 hover:bg-muted/50",
                !config.enabled && "border-border bg-muted/30 cursor-not-allowed opacity-60"
              )}
            >
              <div className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                isSelected ? "bg-primary/20" : "bg-muted"
              )}>
                <Icon className={cn(
                  "h-5 w-5",
                  isSelected ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm font-medium",
                    isSelected ? "text-foreground" : config.enabled ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {config.title}
                  </span>
                  {config.comingSoon && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {config.description}
                </p>
              </div>
              
              {config.enabled && (
                <div
                  className={cn(
                    "h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-border"
                  )}
                >
                  {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
