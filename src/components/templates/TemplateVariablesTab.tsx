import React, { useMemo, useState, useCallback } from 'react';
import { toast } from '@/components/ui/sonner';
import { Plus, Trash2, AlertCircle, CheckCircle2, X, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TOOLTIPS } from '@/config/labels';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface VariableDefinition {
  name: string;
  type?: string;
  default?: string;
  description?: string;
}

interface TemplateStructure {
  _id?: string;
  prompt_name?: string;
  input_admin_prompt?: string;
  input_user_prompt?: string;
  children?: TemplateStructure[];
  [key: string]: unknown;
}

interface VariableType {
  value: string;
  label: string;
}

interface TemplateVariablesTabProps {
  structure: TemplateStructure;
  variableDefinitions: VariableDefinition[];
  onChange: (variables: VariableDefinition[]) => void;
  onStructureChange?: (structure: TemplateStructure) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const VARIABLE_TYPES: VariableType[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'select', label: 'Selection' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const TemplateVariablesTab: React.FC<TemplateVariablesTabProps> = ({ 
  structure, 
  variableDefinitions, 
  onChange, 
  onStructureChange 
}) => {
  const [newVarName, setNewVarName] = useState<string>('');
  const [editingVar, setEditingVar] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const handleRefreshVariables = useCallback(() => {
    // Re-detect variables from structure
    const variables = new Set<string>();
    const variablePattern = /\{\{([^}]+)\}\}/g;

    const extractFromObject = (obj: unknown): void => {
      if (!obj) return;
      if (typeof obj === 'string') {
        const matches = obj.matchAll(variablePattern);
        for (const match of matches) {
          const varName = match[1].trim();
          if (!varName.startsWith('q.') && !varName.includes('.')) {
            variables.add(varName);
          }
        }
      } else if (Array.isArray(obj)) {
        obj.forEach(extractFromObject);
      } else if (typeof obj === 'object') {
        Object.values(obj as Record<string, unknown>).forEach(extractFromObject);
      }
    };

    extractFromObject(structure);
    const currentlyUsed = Array.from(variables);

    // Remove variables that are no longer used in prompts
    const filteredDefinitions = variableDefinitions.filter(v => 
      currentlyUsed.includes(v.name)
    );

    if (filteredDefinitions.length !== variableDefinitions.length) {
      onChange(filteredDefinitions);
    }

    setRefreshKey(k => k + 1);
  }, [structure, variableDefinitions, onChange]);

  // Extract all variables from structure (refreshKey forces re-calculation)
  const detectedVariables = useMemo(() => {
    const variables = new Set<string>();
    const variablePattern = /\{\{([^}]+)\}\}/g;

    const extractFromObject = (obj: unknown): void => {
      if (!obj) return;
      if (typeof obj === 'string') {
        const matches = obj.matchAll(variablePattern);
        for (const match of matches) {
          const varName = match[1].trim();
          // Exclude system and chained variables
          if (!varName.startsWith('q.') && !varName.includes('.')) {
            variables.add(varName);
          }
        }
      } else if (Array.isArray(obj)) {
        obj.forEach(extractFromObject);
      } else if (typeof obj === 'object') {
        Object.values(obj as Record<string, unknown>).forEach(extractFromObject);
      }
    };

    extractFromObject(structure);
    return Array.from(variables);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure, refreshKey]);

  // Find undefined and unused variables
  const definedNames = variableDefinitions.map(v => v.name);
  const undefinedVars = detectedVariables.filter(v => !definedNames.includes(v));
  const unusedVars = definedNames.filter(v => !detectedVariables.includes(v));

  const handleAddVariable = (name?: string) => {
    const varName = name || newVarName.trim();
    if (!varName) return;
    
    // Check for duplicates
    if (definedNames.includes(varName)) {
      return;
    }

    const newVar: VariableDefinition = {
      name: varName,
      description: '',
      default: '',
      type: 'text',
    };

    onChange([...variableDefinitions, newVar]);
    setNewVarName('');
  };

  const handleUpdateVariable = (index: number, updates: Partial<VariableDefinition>) => {
    const updated = [...variableDefinitions];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const handleDeleteVariable = (index: number) => {
    const updated = variableDefinitions.filter((_, i) => i !== index);
    onChange(updated);
  };

  // Remove all occurrences of a variable from the template structure
  const handleRemoveVariableFromStructure = useCallback((varName: string) => {
    console.log('[TemplateVariablesTab] handleRemoveVariableFromStructure called with:', varName);
    console.log('[TemplateVariablesTab] onStructureChange exists:', !!onStructureChange);
    console.log('[TemplateVariablesTab] structure:', JSON.stringify(structure, null, 2));
    
    if (!onStructureChange) {
      console.error('[TemplateVariablesTab] onStructureChange is not defined!');
      toast.error('Cannot remove variable: structure change handler missing');
      return;
    }
    
    // Escape special regex characters in variable name
    const escapedName = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\{\\{\\s*${escapedName}\\s*\\}\\}`, 'g');
    console.log('[TemplateVariablesTab] Using pattern:', pattern.toString());
    
    let replacementCount = 0;
    
    const removeFromObject = (obj: unknown): unknown => {
      if (!obj) return obj;
      if (typeof obj === 'string') {
        const newValue = obj.replace(pattern, '');
        if (newValue !== obj) {
          replacementCount++;
          console.log(`[TemplateVariablesTab] Replaced in string: "${obj}" -> "${newValue}"`);
        }
        return newValue;
      }
      if (Array.isArray(obj)) {
        return obj.map(removeFromObject);
      }
      if (typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
          result[key] = removeFromObject(value);
        }
        return result;
      }
      return obj;
    };
    
    const newStructure = removeFromObject(structure) as TemplateStructure;
    console.log('[TemplateVariablesTab] New structure:', JSON.stringify(newStructure, null, 2));
    console.log('[TemplateVariablesTab] Total replacements:', replacementCount);
    
    onStructureChange(newStructure);
    
    if (replacementCount > 0) {
      toast.success(`Removed {{${varName}}} from ${replacementCount} location(s)`);
    } else {
      toast.info(`No occurrences of {{${varName}}} found to remove`);
    }
  }, [structure, onStructureChange]);

  return (
    <TooltipProvider>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <h3 className="text-title-sm font-medium text-on-surface">Template Variables</h3>
        
        {/* Undefined Variables Warning */}
        {undefinedVars.length > 0 && (
          <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
            <div className="flex items-start justify-between w-full">
              <div className="flex gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                <div>
                  <AlertTitle className="text-amber-600 dark:text-amber-400">Undefined Variables</AlertTitle>
                  <AlertDescription className="text-amber-600/80 dark:text-amber-400/80">
                    <p className="mb-2 text-body-sm">The following variables are used in prompts but not defined:</p>
                    <div className="flex flex-wrap gap-2">
                      {undefinedVars.map(v => (
                        <div key={v} className="flex items-center gap-1 bg-amber-500/10 rounded-m3-full pl-2 pr-1 py-0.5">
                          <span className="text-body-sm font-mono text-amber-600 dark:text-amber-400">{`{{${v}}}`}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleAddVariable(v)}
                                className="h-5 w-5 flex items-center justify-center rounded-m3-full hover:bg-amber-500/20"
                              >
                                <Plus className="h-3 w-3 text-amber-500" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Define this variable</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleRemoveVariableFromStructure(v)}
                                className="h-5 w-5 flex items-center justify-center rounded-m3-full hover:bg-red-500/20"
                              >
                                <X className="h-3 w-3 text-red-500" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Remove from all prompts</TooltipContent>
                          </Tooltip>
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleRefreshVariables}
                    className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container shrink-0"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{TOOLTIPS.templates.actions.refreshVariables}</TooltipContent>
              </Tooltip>
            </div>
          </Alert>
        )}

        {unusedVars.length > 0 && (
          <Alert className="border-outline-variant">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-on-surface">Unused Variables</AlertTitle>
            <AlertDescription className="text-on-surface-variant">
              <p className="mb-2 text-body-sm">These variables are defined but not used in any prompts:</p>
              <div className="flex flex-wrap gap-2">
                {unusedVars.map(v => (
                  <Badge key={v} variant="secondary" className="text-[10px]">
                    {`{{${v}}}`}
                  </Badge>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Add Variable */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-label-sm">Add Variable</CardTitle>
            <CardDescription className="text-[10px]">Define a new variable for use in prompts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={newVarName}
                onChange={(e) => setNewVarName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder="variable_name"
                className="flex-1 font-mono bg-surface-container"
                onKeyDown={(e) => e.key === 'Enter' && handleAddVariable()}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleAddVariable()}
                    disabled={!newVarName.trim()}
                    className={`w-8 h-8 flex items-center justify-center rounded-m3-full transition-colors ${
                      newVarName.trim() 
                        ? 'text-primary hover:bg-surface-container' 
                        : 'text-on-surface-variant opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{TOOLTIPS.templates.actions.addVariable}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-[10px] text-on-surface-variant mt-2">
              Use letters, numbers, and underscores only. Variables can be inserted as {`{{variable_name}}`}.
            </p>
          </CardContent>
        </Card>

        {/* Variables Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-label-sm">Defined Variables ({variableDefinitions.length})</CardTitle>
            <CardDescription className="text-[10px]">Configure variable details, defaults, and descriptions</CardDescription>
          </CardHeader>
          <CardContent>
            {variableDefinitions.length === 0 ? (
              <div className="text-center py-8 text-on-surface-variant">
                <p className="text-body-sm">No variables defined yet.</p>
                <p className="text-[10px] mt-1">Add variables above or click undefined variables to add them.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-label-sm">Name</TableHead>
                    <TableHead className="text-label-sm">Type</TableHead>
                    <TableHead className="text-label-sm">Default</TableHead>
                    <TableHead className="text-label-sm">Description</TableHead>
                    <TableHead className="w-16 text-label-sm">Status</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variableDefinitions.map((variable, index) => (
                    <TableRow key={variable.name}>
                      <TableCell className="font-mono text-body-sm text-on-surface">
                        {editingVar === index ? (
                          <Input
                            value={variable.name}
                            onChange={(e) => handleUpdateVariable(index, { 
                              name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') 
                            })}
                            className="h-8 w-32 bg-surface-container"
                          />
                        ) : (
                          `{{${variable.name}}}`
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={variable.type || 'text'}
                          onValueChange={(v) => handleUpdateVariable(index, { type: v })}
                        >
                          <SelectTrigger className="h-8 w-24 bg-surface-container">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VARIABLE_TYPES.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={variable.default || ''}
                          onChange={(e) => handleUpdateVariable(index, { default: e.target.value })}
                          placeholder="No default"
                          className="h-8 w-32 bg-surface-container"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={variable.description || ''}
                          onChange={(e) => handleUpdateVariable(index, { description: e.target.value })}
                          placeholder="Description..."
                          className="h-8 bg-surface-container"
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger>
                            {detectedVariables.includes(variable.name) ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-on-surface-variant" />
                            )}
                          </TooltipTrigger>
                          <TooltipContent>
                            {detectedVariables.includes(variable.name) 
                              ? TOOLTIPS.templates.variables.used 
                              : TOOLTIPS.templates.variables.unused}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleDeleteVariable(index)}
                          className="w-8 h-8 flex items-center justify-center rounded-m3-full text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default TemplateVariablesTab;
