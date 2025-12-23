import React from 'react';
import { Check, Loader2, Variable } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  if (isLoadingPrompts) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Standard Fields */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Standard Fields</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {STANDARD_FIELDS.map(field => {
            const isSelected = selectedFields.includes(field.id);
            
            return (
              <button
                key={field.id}
                onClick={() => onToggleField(field.id)}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <div
                  className={cn(
                    "h-4 w-4 mt-0.5 rounded border flex items-center justify-center transition-colors flex-shrink-0",
                    isSelected
                      ? "bg-primary border-primary"
                      : "border-border"
                  )}
                >
                  {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{field.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{field.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Prompt Variables */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">Prompt Variables</h3>
          {isLoadingVariables && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        
        {Object.keys(variablesData).length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
            No variables found in selected prompts
          </div>
        ) : (
          <div className="space-y-4">
            {promptsData.map(prompt => {
              const variables = variablesData[prompt.row_id] || [];
              if (variables.length === 0) return null;
              
              const promptSelectedVars = selectedVariables[prompt.row_id] || [];
              
              return (
                <div key={prompt.row_id} className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {prompt.prompt_name}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {variables.map(variable => {
                      const isSelected = promptSelectedVars.includes(variable.variable_name);
                      
                      return (
                        <button
                          key={variable.variable_name}
                          onClick={() => onToggleVariable(prompt.row_id, variable.variable_name)}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-colors",
                            isSelected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Variable className="h-3 w-3" />
                          <span>{variable.variable_name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="text-xs text-muted-foreground pt-4 border-t border-border">
        {selectedFields.length} field{selectedFields.length !== 1 ? 's' : ''} and{' '}
        {Object.values(selectedVariables).flat().length} variable
        {Object.values(selectedVariables).flat().length !== 1 ? 's' : ''} selected
      </div>
    </div>
  );
};
