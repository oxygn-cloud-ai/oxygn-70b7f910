import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Variable, Sparkles, AlertCircle, CheckCircle2, Info, Copy, Check, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import VariablePicker from './VariablePicker';
import PromptReferencePicker from './PromptReferencePicker';

interface PromptVariable {
  variable_name: string;
  variable_value?: string;
  variable_description?: string;
}

interface PromptFieldProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  label?: string;
  className?: string;
  minHeight?: string;
  maxHeight?: string;
  variables?: PromptVariable[];
  systemVariables?: Record<string, string>;
  promptRowId?: string;
  familyRowId?: string;
  showVariableButton?: boolean;
  showReferenceButton?: boolean;
  disabled?: boolean;
  error?: string;
  hint?: string;
}

// Pattern to match variables like {{variable_name}} or {{q.ref[UUID].field}}
const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

const PromptField: React.FC<PromptFieldProps> = ({
  value,
  onChange,
  onBlur,
  placeholder = 'Enter your prompt...',
  label,
  className,
  minHeight = '120px',
  maxHeight = '400px',
  variables = [],
  systemVariables = {},
  promptRowId,
  familyRowId,
  showVariableButton = true,
  showReferenceButton = true,
  disabled = false,
  error,
  hint,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const [showReferencePicker, setShowReferencePicker] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Extract all variables used in the prompt
  const usedVariables = useMemo(() => {
    const matches: string[] = [];
    let match;
    const regex = new RegExp(VARIABLE_PATTERN);
    while ((match = regex.exec(value)) !== null) {
      matches.push(match[1].trim());
    }
    return [...new Set(matches)];
  }, [value]);

  // Check which variables are defined
  const variableStatus = useMemo(() => {
    const status: Record<string, 'defined' | 'system' | 'reference' | 'undefined'> = {};
    
    usedVariables.forEach(varName => {
      if (varName.startsWith('q.')) {
        status[varName] = 'reference';
      } else if (systemVariables[varName] !== undefined) {
        status[varName] = 'system';
      } else if (variables.some(v => v.variable_name === varName)) {
        status[varName] = 'defined';
      } else {
        status[varName] = 'undefined';
      }
    });
    
    return status;
  }, [usedVariables, variables, systemVariables]);

  const undefinedCount = useMemo(() => {
    return Object.values(variableStatus).filter(s => s === 'undefined').length;
  }, [variableStatus]);

  // Insert variable at cursor position
  const insertVariable = useCallback((varName: string) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const start = cursorPosition ?? textarea.selectionStart;
    const end = cursorPosition ?? textarea.selectionEnd;
    
    const insertion = `{{${varName}}}`;
    const newValue = value.substring(0, start) + insertion + value.substring(end);
    
    onChange(newValue);
    
    // Set cursor position after insertion
    requestAnimationFrame(() => {
      textarea.focus();
      const newPosition = start + insertion.length;
      textarea.setSelectionRange(newPosition, newPosition);
    });
    
    setShowVariablePicker(false);
    setShowReferencePicker(false);
  }, [value, onChange, cursorPosition]);

  const handleCopyVariable = (varName: string) => {
    navigator.clipboard.writeText(`{{${varName}}}`);
    setCopiedVar(varName);
    setTimeout(() => setCopiedVar(null), 1500);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (onBlur) onBlur();
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl + Shift + V to open variable picker
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'v') {
      e.preventDefault();
      setCursorPosition(textareaRef.current?.selectionStart ?? null);
      setShowVariablePicker(true);
    }
  };

  return (
    <TooltipProvider>
      <div className={cn("space-y-1.5", className)}>
        {/* Header */}
        {(label || showVariableButton || showReferenceButton) && (
          <div className="flex items-center justify-between">
            {label && (
              <label className="text-xs font-medium text-muted-foreground">
                {label}
              </label>
            )}
            <div className="flex items-center gap-1">
              {/* Variable stats */}
              {usedVariables.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] hover:bg-muted transition-colors">
                      <Variable className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{usedVariables.length}</span>
                      {undefinedCount > 0 && (
                        <AlertCircle className="h-3 w-3 text-amber-500" />
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="end">
                    <div className="space-y-2">
                      <p className="text-xs font-medium">Variables Used</p>
                      <div className="space-y-1 max-h-40 overflow-auto">
                        {usedVariables.map(varName => {
                          const status = variableStatus[varName];
                          return (
                            <div 
                              key={varName}
                              className="flex items-center justify-between gap-2 p-1.5 rounded bg-muted/50"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {status === 'undefined' ? (
                                  <AlertCircle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                                ) : status === 'reference' ? (
                                  <Sparkles className="h-3 w-3 text-purple-500 flex-shrink-0" />
                                ) : (
                                  <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                                )}
                                <code className="text-[10px] truncate">{varName}</code>
                              </div>
                              <button
                                onClick={() => handleCopyVariable(varName)}
                                className="p-0.5 hover:bg-muted rounded"
                              >
                                {copiedVar === varName ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3 text-muted-foreground" />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      {undefinedCount > 0 && (
                        <p className="text-[10px] text-amber-500">
                          {undefinedCount} undefined variable{undefinedCount > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {/* Variable picker button */}
              {showVariableButton && (
                <Popover open={showVariablePicker} onOpenChange={setShowVariablePicker}>
                  <PopoverTrigger asChild>
                    <button
                      onClick={() => {
                        setCursorPosition(textareaRef.current?.selectionStart ?? null);
                      }}
                      disabled={disabled}
                      className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Variable className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Insert variable (⌘⇧V)</p>
                        </TooltipContent>
                      </Tooltip>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0" align="end">
                    <VariablePicker
                      onSelect={insertVariable}
                      variables={variables}
                      systemVariables={systemVariables}
                    />
                  </PopoverContent>
                </Popover>
              )}

              {/* Reference picker button */}
              {showReferenceButton && familyRowId && (
                <Popover open={showReferencePicker} onOpenChange={setShowReferencePicker}>
                  <PopoverTrigger asChild>
                    <button
                      onClick={() => {
                        setCursorPosition(textareaRef.current?.selectionStart ?? null);
                      }}
                      disabled={disabled}
                      className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Reference another prompt</p>
                        </TooltipContent>
                      </Tooltip>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="end">
                    <PromptReferencePicker
                      onSelect={(ref) => insertVariable(ref)}
                      familyRowId={familyRowId}
                      currentPromptRowId={promptRowId}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        )}

        {/* Textarea */}
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "resize-none font-mono text-sm transition-colors",
              error && "border-destructive focus-visible:ring-destructive",
              isFocused && !error && "border-primary"
            )}
            style={{
              minHeight,
              maxHeight,
            }}
          />
        </div>

        {/* Footer */}
        {(error || hint) && (
          <div className="flex items-start gap-1.5">
            {error ? (
              <>
                <AlertCircle className="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                <span className="text-[10px] text-destructive">{error}</span>
              </>
            ) : hint ? (
              <>
                <Info className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span className="text-[10px] text-muted-foreground">{hint}</span>
              </>
            ) : null}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default PromptField;
