import React from 'react';
import { Variable, FileText } from 'lucide-react';
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
  // Build available mapping sources
  const fieldOptions = STANDARD_FIELDS.filter(f => selectedFields.includes(f.id));
  
  const variableOptions = [];
  Object.entries(selectedVariables).forEach(([promptId, varNames]) => {
    const prompt = promptsData.find(p => p.row_id === promptId);
    const vars = variablesData[promptId] || [];
    varNames.forEach(varName => {
      const variable = vars.find(v => v.variable_name === varName);
      if (variable) {
        variableOptions.push({
          promptId,
          promptName: prompt?.prompt_name || 'Unknown',
          variableName: varName
        });
      }
    });
  });

  if (!template?.variables?.length) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Variable className="h-4 w-4 text-primary" />
        <Label className="text-sm font-medium">Map Template Variables</Label>
      </div>
      
      <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
        {template.variables.map(varName => {
          const mapping = mappings[varName] || { type: 'static', value: '' };
          
          return (
            <div key={varName} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  {varName}
                </span>
              </div>
              
              <div className="flex gap-2">
                {/* Mapping type selector */}
                <Select
                  value={mapping.type}
                  onValueChange={(type) => onUpdateMapping(varName, { ...mapping, type })}
                >
                  <SelectTrigger className="w-32 bg-background text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="static">Static text</SelectItem>
                    <SelectItem value="field">Prompt field</SelectItem>
                    {variableOptions.length > 0 && (
                      <SelectItem value="variable">Variable</SelectItem>
                    )}
                    <SelectItem value="all">All prompts</SelectItem>
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
                
                {mapping.type === 'field' && (
                  <Select
                    value={mapping.fieldId || ''}
                    onValueChange={(fieldId) => onUpdateMapping(varName, { ...mapping, fieldId })}
                  >
                    <SelectTrigger className="flex-1 bg-background text-sm">
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldOptions.map(field => (
                        <SelectItem key={field.id} value={field.id}>
                          <div className="flex items-center gap-2">
                            <FileText className="h-3 w-3" />
                            {field.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                {mapping.type === 'variable' && (
                  <Select
                    value={mapping.variableName ? `${mapping.promptId}:${mapping.variableName}` : ''}
                    onValueChange={(value) => {
                      const [promptId, variableName] = value.split(':');
                      onUpdateMapping(varName, { ...mapping, promptId, variableName });
                    }}
                  >
                    <SelectTrigger className="flex-1 bg-background text-sm">
                      <SelectValue placeholder="Select variable..." />
                    </SelectTrigger>
                    <SelectContent>
                      {variableOptions.map(opt => (
                        <SelectItem 
                          key={`${opt.promptId}:${opt.variableName}`} 
                          value={`${opt.promptId}:${opt.variableName}`}
                        >
                          <div className="flex items-center gap-2">
                            <Variable className="h-3 w-3" />
                            <span className="truncate">{opt.promptName} → {opt.variableName}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                {mapping.type === 'all' && (
                  <Select
                    value={mapping.fieldId || ''}
                    onValueChange={(fieldId) => onUpdateMapping(varName, { ...mapping, fieldId })}
                  >
                    <SelectTrigger className="flex-1 bg-background text-sm">
                      <SelectValue placeholder="Concatenate field from all..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldOptions.map(field => (
                        <SelectItem key={field.id} value={field.id}>
                          All → {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      <p className="text-xs text-muted-foreground">
        Map template variables to prompt data. Variables will be replaced when exporting.
      </p>
    </div>
  );
};
