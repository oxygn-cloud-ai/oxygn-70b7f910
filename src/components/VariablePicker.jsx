import React, { useState } from 'react';
import { Braces, Clock, User, FileText, ChevronRight } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TOOLTIPS } from '@/config/labels';
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from '@/lib/utils';
import {
  SYSTEM_VARIABLES,
  SYSTEM_VARIABLE_TYPES,
  getSystemVariableNames,
} from '@/config/systemVariables';

/**
 * Compact variable picker with icon trigger
 * Shows system variables and user-defined variables in a popover
 */
const VariablePicker = ({ 
  onInsert, 
  userVariables = [], 
  className,
  side = 'bottom',
  align = 'end',
}) => {
  const [open, setOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);

  const handleInsert = (varName) => {
    onInsert(varName);
    setOpen(false);
  };

  // Group system variables by category
  const systemVarGroups = {
    datetime: {
      label: 'Date & Time',
      icon: Clock,
      vars: ['q.today', 'q.now', 'q.year', 'q.month'],
    },
    user: {
      label: 'User',
      icon: User,
      vars: ['q.user.name', 'q.user.email'],
    },
    prompt: {
      label: 'Prompt Context',
      icon: FileText,
      vars: ['q.toplevel.prompt.name', 'q.parent.prompt.name'],
    },
    policy: {
      label: 'Policy',
      icon: Braces,
      vars: ['q.policy.name', 'q.policy.version', 'q.policy.owner', 'q.policy.effective.date', 'q.policy.review.date', 'q.topic'],
    },
    other: {
      label: 'Other',
      icon: Braces,
      vars: ['q.client.name', 'q.jurisdiction'],
    },
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const renderVariable = (varName) => {
    const sysVar = SYSTEM_VARIABLES[varName];
    const isStatic = sysVar?.type === SYSTEM_VARIABLE_TYPES.STATIC;
    
    return (
      <button
        key={varName}
        onClick={() => handleInsert(varName)}
        className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded flex items-center justify-between group"
      >
        <span className="font-mono text-foreground">{`{{${varName}}}`}</span>
        {isStatic && (
          <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">auto</span>
        )}
      </button>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "h-6 w-6 rounded flex items-center justify-center",
                  "text-muted-foreground hover:text-foreground hover:bg-muted",
                  "transition-colors",
                  className
                )}
              >
                <Braces className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {TOOLTIPS.variables.insert}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent 
        side={side} 
        align={align} 
        className="w-64 p-0"
      >
        <ScrollArea className="max-h-[300px]">
          <div className="p-1">
            {/* System Variable Groups */}
            {Object.entries(systemVarGroups).map(([key, group]) => {
              const Icon = group.icon;
              const isExpanded = expandedSection === key;
              const hasVars = group.vars.some(v => SYSTEM_VARIABLES[v]);
              
              if (!hasVars) return null;
              
              return (
                <div key={key} className="mb-1">
                  <button
                    onClick={() => toggleSection(key)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded"
                  >
                    <ChevronRight className={cn(
                      "h-3 w-3 transition-transform",
                      isExpanded && "rotate-90"
                    )} />
                    <Icon className="h-3.5 w-3.5" />
                    <span>{group.label}</span>
                  </button>
                  
                  {isExpanded && (
                    <div className="ml-4 mt-0.5 border-l border-border pl-2">
                      {group.vars.filter(v => SYSTEM_VARIABLES[v]).map(renderVariable)}
                    </div>
                  )}
                </div>
              );
            })}

            {/* User-Defined Variables */}
            {userVariables.length > 0 && (
              <div className="mb-1">
                <button
                  onClick={() => toggleSection('user-defined')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded"
                >
                  <ChevronRight className={cn(
                    "h-3 w-3 transition-transform",
                    expandedSection === 'user-defined' && "rotate-90"
                  )} />
                  <FileText className="h-3.5 w-3.5" />
                  <span>Template Variables</span>
                  <span className="ml-auto text-[10px] bg-muted px-1 rounded">{userVariables.length}</span>
                </button>
                
                {expandedSection === 'user-defined' && (
                  <div className="ml-4 mt-0.5 border-l border-border pl-2">
                    {userVariables.map(v => (
                      <button
                        key={v.name || v}
                        onClick={() => handleInsert(v.name || v)}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                      >
                        <span className="font-mono text-foreground">{`{{${v.name || v}}}`}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default VariablePicker;
