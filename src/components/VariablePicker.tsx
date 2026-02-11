import { useState } from 'react';
import { Braces, Clock, User, FileText, ChevronRight, Link2 } from 'lucide-react';
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
} from '@/config/systemVariables';
import PromptReferencePicker from './PromptReferencePicker';
import type { LucideIcon } from 'lucide-react';

interface UserVariable {
  name: string;
}

interface VariablePickerProps {
  onInsert: (varName: string) => void;
  userVariables?: (UserVariable | string)[];
  className?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  familyRootPromptRowId?: string | null;
}

interface VarGroup {
  label: string;
  icon: LucideIcon;
  vars: string[];
}

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
  familyRootPromptRowId = null,
}: VariablePickerProps) => {
  const [open, setOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showPromptPicker, setShowPromptPicker] = useState(false);

  const handleInsert = (varName: string) => {
    onInsert(varName);
    setOpen(false);
  };

  // Group system variables by category
  const systemVarGroups: Record<string, VarGroup> = {
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
      vars: ['q.prompt.name', 'q.toplevel.prompt.name', 'q.parent.prompt.name'],
    },
    policy: {
      label: 'Policy',
      icon: Braces,
      vars: ['q.policy.version', 'q.policy.owner', 'q.policy.effective.date', 'q.policy.review.date', 'q.topic'],
    },
    other: {
      label: 'Other',
      icon: Braces,
      vars: ['q.client.name', 'q.jurisdiction'],
    },
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const renderVariable = (varName: string) => {
    const sysVar = (SYSTEM_VARIABLES as Record<string, { type?: string; label?: string; description?: string }>)[varName];
    const isStatic = sysVar?.type === SYSTEM_VARIABLE_TYPES.STATIC;
    
    return (
      <button
        key={varName}
        onMouseDown={(e) => e.preventDefault()}
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
                onMouseDown={(e) => e.preventDefault()}
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
            {/* Prompt References - Top Section */}
            <div className="mb-1">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  setShowPromptPicker(true);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 rounded"
              >
                <Link2 className="h-3.5 w-3.5" />
                <span>Prompt References</span>
                <ChevronRight className="h-3 w-3 ml-auto" />
              </button>
            </div>

            <div className="border-t border-border my-1" />

            {/* System Variable Groups */}
            {Object.entries(systemVarGroups).map(([key, group]) => {
              const Icon = group.icon;
              const isExpanded = expandedSection === key;
              const hasVars = group.vars.some(v => (SYSTEM_VARIABLES as Record<string, unknown>)[v]);
              
              if (!hasVars) return null;
              
              return (
                <div key={key} className="mb-1">
                  <button
                    onMouseDown={(e) => e.preventDefault()}
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
                      {group.vars.filter(v => (SYSTEM_VARIABLES as Record<string, unknown>)[v]).map(renderVariable)}
                    </div>
                  )}
                </div>
              );
            })}

            {/* User-Defined Variables */}
            {userVariables.length > 0 && (
              <div className="mb-1">
                <button
                  onMouseDown={(e) => e.preventDefault()}
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
                    {userVariables.map((v) => {
                      const name = typeof v === 'string' ? v : v.name;
                      return (
                        <button
                          key={name}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleInsert(name)}
                          className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                        >
                          <span className="font-mono text-foreground">{`{{${name}}}`}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>

      {/* Prompt Reference Picker Modal */}
      <PromptReferencePicker
        isOpen={showPromptPicker}
        onClose={() => setShowPromptPicker(false)}
        onInsert={(reference) => {
          onInsert(reference);
          setShowPromptPicker(false);
        }}
        familyRootPromptRowId={familyRootPromptRowId}
      />
    </Popover>
  );
};

export default VariablePicker;
