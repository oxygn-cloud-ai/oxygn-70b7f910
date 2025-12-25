import React from 'react';
import { Variable } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { VariableSourcePicker } from './VariableSourcePicker';

export const ConfluenceTemplateMapper = ({
  template,
  mappings,
  promptsData,
  variablesData,
  selectedFields,
  selectedVariables,
  onUpdateMapping,
  STANDARD_FIELDS
}) => {
  if (!template?.variables?.length) {
    return null;
  }

  return (
    <div className="border border-border/50 rounded-xl p-4 bg-card/50 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Variable className="h-4 w-4 text-primary" />
        </div>
        <div>
          <Label className="text-sm font-semibold">Map Template Variables</Label>
          <p className="text-xs text-muted-foreground">Set values for each template variable</p>
        </div>
      </div>
      
      <div className="space-y-3">
        {template.variables.map(varName => {
          const mapping = mappings[varName] || { type: 'static', value: '' };
          
          return (
            <div key={varName} className="p-3 bg-muted/30 rounded-lg border border-border/30 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded">
                  {varName}
                </span>
              </div>
              
              <div className="flex gap-2">
                {/* Mapping type selector - simplified to just static and source */}
                <Select
                  value={mapping.type === 'source' || mapping.type === 'field' || mapping.type === 'variable' ? 'source' : 'static'}
                  onValueChange={(type) => {
                    if (type === 'static') {
                      onUpdateMapping(varName, { type: 'static', value: '' });
                    } else {
                      onUpdateMapping(varName, { type: 'source', source: null });
                    }
                  }}
                >
                  <SelectTrigger className="w-28 bg-background text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="static">Static</SelectItem>
                    <SelectItem value="source">Variable</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Value input based on type */}
                {mapping.type === 'static' && (
                  <Input
                    value={mapping.value || ''}
                    onChange={(e) => onUpdateMapping(varName, { ...mapping, value: e.target.value })}
                    placeholder="Enter value..."
                    className="flex-1 bg-background text-sm"
                  />
                )}
                
                {(mapping.type === 'source' || mapping.type === 'field' || mapping.type === 'variable') && (
                  <VariableSourcePicker
                    value={mapping.source || (mapping.promptId ? {
                      promptId: mapping.promptId,
                      sourceType: mapping.type === 'variable' ? 'variable' : 'field',
                      sourceId: mapping.type === 'variable' ? mapping.variableName : mapping.fieldId
                    } : null)}
                    onChange={(source) => onUpdateMapping(varName, { type: 'source', source })}
                    promptsData={promptsData}
                    variablesData={variablesData}
                    selectedFields={selectedFields}
                    selectedVariables={selectedVariables}
                    STANDARD_FIELDS={STANDARD_FIELDS}
                    placeholder="Select source..."
                    className="flex-1"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      <p className="text-xs text-muted-foreground">
        Map each template variable to a static value or a field/variable from a specific prompt.
      </p>
    </div>
  );
};
