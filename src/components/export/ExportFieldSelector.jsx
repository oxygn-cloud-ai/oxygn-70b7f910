import React, { useState } from 'react';
import { Check, Loader2, Variable, ChevronDown, ChevronRight, FileText, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export const ExportFieldSelector = ({
  promptsData,
  variablesData,
  selectedFields,
  selectedVariables,
  isLoadingPrompts,
  isLoadingVariables,
  onToggleField,
  onToggleVariable,
  STANDARD_FIELDS
}) => {
  const [isFieldsExpanded, setIsFieldsExpanded] = useState(true);
  const [isVariablesExpanded, setIsVariablesExpanded] = useState(true);
  const [expandedPrompts, setExpandedPrompts] = useState([]);

  const togglePromptExpand = (promptId) => {
    setExpandedPrompts(prev => 
      prev.includes(promptId) ? prev.filter(id => id !== promptId) : [...prev, promptId]
    );
  };

  if (isLoadingPrompts) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        <span className="text-sm text-muted-foreground">Loading fields...</span>
      </div>
    );
  }

  const totalVarCount = Object.values(selectedVariables).flat().length;

  return (
    <div className="space-y-4">
      {/* Standard Fields Card */}
      <Collapsible open={isFieldsExpanded} onOpenChange={setIsFieldsExpanded}>
        <div className="border border-border/50 rounded-xl overflow-hidden bg-card/50">
          <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <ListChecks className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-foreground">Standard Fields</h3>
                <p className="text-xs text-muted-foreground">Core prompt data to export</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-normal">
                {selectedFields.length} / {STANDARD_FIELDS.length}
              </Badge>
              {isFieldsExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="px-4 pb-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STANDARD_FIELDS.map(field => {
                  const isSelected = selectedFields.includes(field.id);
                  
                  return (
                    <button
                      key={field.id}
                      onClick={() => onToggleField(field.id)}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                        isSelected
                          ? "border-primary/30 bg-primary/5"
                          : "border-border/50 hover:border-primary/20 hover:bg-muted/30"
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 mt-0.5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0",
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-muted-foreground/30"
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground">{field.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{field.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Prompt Variables Card */}
      <Collapsible open={isVariablesExpanded} onOpenChange={setIsVariablesExpanded}>
        <div className="border border-border/50 rounded-xl overflow-hidden bg-card/50">
          <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Variable className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-foreground">Prompt Variables</h3>
                <p className="text-xs text-muted-foreground">Custom variables from prompts</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isLoadingVariables && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              <Badge variant="secondary" className="font-normal">
                {totalVarCount} selected
              </Badge>
              {isVariablesExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="px-4 pb-4 pt-2">
              {Object.keys(variablesData).length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border/50 rounded-lg bg-muted/20">
                  <Variable className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No variables found in selected prompts
                </div>
              ) : (
                <div className="space-y-2">
                  {promptsData.map(prompt => {
                    const variables = variablesData[prompt.row_id] || [];
                    if (variables.length === 0) return null;
                    
                    const promptSelectedVars = selectedVariables[prompt.row_id] || [];
                    const isExpanded = expandedPrompts.includes(prompt.row_id);
                    
                    return (
                      <Collapsible 
                        key={prompt.row_id} 
                        open={isExpanded} 
                        onOpenChange={() => togglePromptExpand(prompt.row_id)}
                      >
                        <div className="border border-border/30 rounded-lg overflow-hidden">
                          <CollapsibleTrigger className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-2">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm font-medium text-foreground truncate">
                                {prompt.prompt_name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={promptSelectedVars.length > 0 ? "default" : "secondary"} 
                                className="text-compact px-1.5 py-0 h-5"
                              >
                                {promptSelectedVars.length} / {variables.length}
                              </Badge>
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </div>
                          </CollapsibleTrigger>
                          
                          <CollapsibleContent>
                            <div className="px-3 pb-3 pt-1">
                              <div className="flex flex-wrap gap-1.5">
                                {variables.map(variable => {
                                  const isSelected = promptSelectedVars.includes(variable.variable_name);
                                  
                                  return (
                                    <button
                                      key={variable.variable_name}
                                      onClick={() => onToggleVariable(prompt.row_id, variable.variable_name)}
                                      className={cn(
                                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all",
                                        isSelected
                                          ? "bg-primary text-primary-foreground shadow-sm"
                                          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                                      )}
                                    >
                                      <Variable className="h-3 w-3" />
                                      <span>{variable.variable_name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Summary */}
      <div className="flex items-center justify-between px-1 pt-2">
        <span className="text-xs text-muted-foreground">
          {selectedFields.length} field{selectedFields.length !== 1 ? 's' : ''} and {totalVarCount} variable{totalVarCount !== 1 ? 's' : ''} selected
        </span>
      </div>
    </div>
  );
};
