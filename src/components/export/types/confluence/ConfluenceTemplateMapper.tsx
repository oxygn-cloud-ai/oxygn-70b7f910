// @ts-nocheck
import React, { useMemo } from 'react';
import { Variable, Check, AlertCircle, Eye } from 'lucide-react';
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

  // Helper to resolve a value from export data based on source
  const resolveSourceValue = (source) => {
    if (!source || !promptsData || promptsData.length === 0) return null;
    
    // Find the prompt data
    const promptData = promptsData.find(p => p.row_id === source.promptId);
    if (!promptData) return null;
    
    if (source.sourceType === 'field') {
      return promptData[source.sourceId] || null;
    } else if (source.sourceType === 'variable') {
      const promptVars = variablesData[source.promptId] || [];
      const variable = promptVars.find(v => v.variable_name === source.sourceId);
      return variable?.variable_value || variable?.default_value || null;
    }
    
    return null;
  };

  // Get preview value for a mapping
  const getPreviewValue = (mapping) => {
    if (!mapping) return null;
    
    if (mapping.type === 'static') {
      return mapping.value || null;
    } else if (mapping.type === 'source' && mapping.source) {
      return resolveSourceValue(mapping.source);
    } else if ((mapping.type === 'field' || mapping.type === 'variable') && mapping.promptId) {
      // Legacy format support
      const source = {
        promptId: mapping.promptId,
        sourceType: mapping.type === 'variable' ? 'variable' : 'field',
        sourceId: mapping.type === 'variable' ? mapping.variableName : mapping.fieldId
      };
      return resolveSourceValue(source);
    }
    
    return null;
  };

  // Count mapped and unmapped variables
  const mappingStats = useMemo(() => {
    const mapped = template.variables.filter(varName => {
      const mapping = mappings[varName];
      if (!mapping) return false;
      if (mapping.type === 'static') return !!mapping.value;
      if (mapping.type === 'source') return !!mapping.source;
      return false;
    }).length;
    
    return {
      mapped,
      total: template.variables.length,
      allMapped: mapped === template.variables.length
    };
  }, [template.variables, mappings]);

  return (
    <div className="border border-border/50 rounded-xl p-4 bg-card/50 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Variable className="h-4 w-4 text-primary" />
          </div>
          <div>
            <Label className="text-sm font-semibold">Map Template Variables</Label>
            <p className="text-xs text-muted-foreground">Set values for each template variable</p>
          </div>
        </div>
        
        {/* Mapping progress indicator */}
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
          mappingStats.allMapped 
            ? "bg-green-500/10 text-green-600" 
            : "bg-amber-500/10 text-amber-600"
        )}>
          {mappingStats.allMapped ? (
            <Check className="h-3 w-3" />
          ) : (
            <AlertCircle className="h-3 w-3" />
          )}
          {mappingStats.mapped}/{mappingStats.total} mapped
        </div>
      </div>
      
      <div className="space-y-2">
        {template.variables.map(varName => {
          const mapping = mappings[varName] || { type: 'static', value: '' };
          const previewValue = getPreviewValue(mapping);
          const isMapped = mapping.type === 'static' 
            ? !!mapping.value 
            : (mapping.type === 'source' ? !!mapping.source : false);
          
          return (
            <div 
              key={varName} 
              className={cn(
                "p-3 rounded-lg border transition-colors",
                isMapped 
                  ? "bg-muted/20 border-primary/20" 
                  : "bg-muted/10 border-border/30"
              )}
            >
              {/* Variable name header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs font-mono px-2 py-1 rounded",
                    isMapped ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {varName}
                  </span>
                  {isMapped && <Check className="h-3 w-3 text-green-500" />}
                </div>
              </div>
              
              {/* Mapping controls */}
              <div className="flex gap-2">
                {/* Mapping type selector */}
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
                    <SelectItem value="source">From Data</SelectItem>
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
                    placeholder="Select data source..."
                    className="flex-1"
                  />
                )}
              </div>
              
              {/* Preview value */}
              {previewValue && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground bg-background/50 rounded px-2 py-1.5 border border-border/20">
                  <Eye className="h-3 w-3 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">
                    {previewValue.length > 100 ? `${previewValue.substring(0, 100)}...` : previewValue}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <p className="text-xs text-muted-foreground">
        Each variable will be replaced with the mapped value when creating the page.
      </p>
    </div>
  );
};
