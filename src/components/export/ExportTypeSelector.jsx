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
        <h3 className="text-title-small font-semibold text-on-surface">Choose export destination</h3>
        <p className="text-label-medium text-on-surface-variant">Select where you want to export your prompt data</p>
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
                "group relative flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-medium-2 ease-standard",
                config.enabled && isSelected && "border-primary bg-primary/8 shadow-elevation-1",
                config.enabled && !isSelected && "border-outline-variant/50 hover:border-primary/30 hover:bg-on-surface/4",
                !config.enabled && "border-outline-variant/30 bg-on-surface/4 cursor-not-allowed"
              )}
            >
              {/* M3 Icon container */}
              <div className={cn(
                "h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-short-4 ease-standard",
                config.enabled && isSelected && "bg-primary/20 scale-105",
                config.enabled && !isSelected && "bg-surface-container-high group-hover:bg-surface-container-highest",
                !config.enabled && "bg-surface-container-low"
              )}>
                <Icon className={cn(
                  "h-6 w-6 transition-colors duration-short-4 ease-standard",
                  config.enabled && isSelected && "text-primary",
                  config.enabled && !isSelected && "text-on-surface-variant group-hover:text-on-surface",
                  !config.enabled && "text-on-surface-variant/50"
                )} />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    "text-body-large font-semibold transition-colors",
                    config.enabled && isSelected && "text-on-surface",
                    config.enabled && !isSelected && "text-on-surface",
                    !config.enabled && "text-on-surface-variant"
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
                  "text-body-medium transition-colors",
                  config.enabled ? "text-on-surface-variant" : "text-on-surface-variant/60"
                )}>
                  {config.description}
                </p>
              </div>
              
              {/* M3 Selection indicator */}
              {config.enabled && (
                <div
                  className={cn(
                    "h-6 w-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-short-4 ease-standard",
                    isSelected
                      ? "border-primary bg-primary scale-100"
                      : "border-outline-variant group-hover:border-primary/50 scale-90"
                  )}
                >
                  {isSelected && <Check className="h-4 w-4 text-on-primary" />}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Helper text */}
      <p className="text-label-medium text-on-surface-variant text-center pt-2">
        More export destinations coming soon
      </p>
    </div>
  );
};
