import React, { useMemo, useState, useCallback } from 'react';
import { Plus, Trash2, AlertCircle, CheckCircle2, Edit2, X, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TOOLTIPS } from '@/config/labels';

const VARIABLE_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'select', label: 'Selection' },
];

/**
 * Variables tab for managing template variables
 */
const TemplateVariablesTab = ({ structure, variableDefinitions, onChange }) => {
  const [newVarName, setNewVarName] = useState('');
  const [editingVar, setEditingVar] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefreshVariables = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  // Extract all variables from structure (refreshKey forces re-calculation)
  const detectedVariables = useMemo(() => {
    const variables = new Set();
    const variablePattern = /\{\{([^}]+)\}\}/g;

    const extractFromObject = (obj) => {
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
        Object.values(obj).forEach(extractFromObject);
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

  const handleAddVariable = (name) => {
    const varName = name || newVarName.trim();
    if (!varName) return;
    
    // Check for duplicates
    if (definedNames.includes(varName)) {
      return;
    }

    const newVar = {
      name: varName,
      description: '',
      default: '',
      type: 'text',
    };

    onChange([...variableDefinitions, newVar]);
    setNewVarName('');
  };

  const handleUpdateVariable = (index, updates) => {
    const updated = [...variableDefinitions];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const handleDeleteVariable = (index) => {
    const updated = variableDefinitions.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <TooltipProvider>
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <h3 className="text-lg font-medium">Template Variables</h3>
      
      {/* Undefined Variables Warning */}
      {undefinedVars.length > 0 && (
        <Alert variant="warning" className="border-amber-500/50 bg-amber-500/10">
          <div className="flex items-start justify-between w-full">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
              <div>
                <AlertTitle className="text-amber-600 dark:text-amber-400">Undefined Variables</AlertTitle>
                <AlertDescription className="text-amber-600/80 dark:text-amber-400/80">
                  <p className="mb-2">The following variables are used in prompts but not defined:</p>
                  <div className="flex flex-wrap gap-2">
                    {undefinedVars.map(v => (
                      <Badge 
                        key={v} 
                        variant="outline" 
                        className="cursor-pointer hover:bg-amber-500/20"
                        onClick={() => handleAddVariable(v)}
                      >
                        {`{{${v}}}`}
                        <Plus className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </AlertDescription>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefreshVariables}
                  className="h-7 w-7 shrink-0"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{TOOLTIPS.templates.actions.refreshVariables}</TooltipContent>
            </Tooltip>
          </div>
        </Alert>
      )}

      {unusedVars.length > 0 && (
        <Alert className="border-muted">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unused Variables</AlertTitle>
          <AlertDescription>
            <p className="mb-2">These variables are defined but not used in any prompts:</p>
            <div className="flex flex-wrap gap-2">
              {unusedVars.map(v => (
                <Badge key={v} variant="secondary">
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
          <CardTitle className="text-base">Add Variable</CardTitle>
          <CardDescription>Define a new variable for use in prompts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={newVarName}
              onChange={(e) => setNewVarName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder="variable_name"
              className="flex-1 font-mono"
              onKeyDown={(e) => e.key === 'Enter' && handleAddVariable()}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleAddVariable()}
                  disabled={!newVarName.trim()}
                  className={`p-2 rounded-md transition-colors ${
                    newVarName.trim() 
                      ? 'text-primary hover:bg-primary/10' 
                      : 'text-muted-foreground opacity-50 cursor-not-allowed'
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
          <p className="text-xs text-muted-foreground mt-2">
            Use letters, numbers, and underscores only. Variables can be inserted as {`{{variable_name}}`}.
          </p>
        </CardContent>
      </Card>

      {/* Variables Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Defined Variables ({variableDefinitions.length})</CardTitle>
          <CardDescription>Configure variable details, defaults, and descriptions</CardDescription>
        </CardHeader>
        <CardContent>
          {variableDefinitions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No variables defined yet.</p>
              <p className="text-sm mt-1">Add variables above or click undefined variables to add them.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-16">Status</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variableDefinitions.map((variable, index) => (
                  <TableRow key={variable.name}>
                    <TableCell className="font-mono text-sm">
                      {editingVar === index ? (
                        <Input
                          value={variable.name}
                          onChange={(e) => handleUpdateVariable(index, { 
                            name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') 
                          })}
                          className="h-8 w-32"
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
                        <SelectTrigger className="h-8 w-24">
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
                        className="h-8 w-32"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={variable.description || ''}
                        onChange={(e) => handleUpdateVariable(index, { description: e.target.value })}
                        placeholder="Description..."
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger>
                          {detectedVariables.includes(variable.name) ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
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
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteVariable(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
