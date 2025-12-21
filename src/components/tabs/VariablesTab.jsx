import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, Lock, Variable } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePromptVariables } from '../../hooks/usePromptVariables';

const VariablesTab = ({ selectedItemData, projectRowId }) => {
  const { 
    variables, 
    isLoading, 
    addVariable, 
    updateVariable, 
    deleteVariable 
  } = usePromptVariables(projectRowId);
  
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const systemVariables = selectedItemData?.last_ai_call_metadata || {};

  const handleAdd = async () => {
    if (!newName.trim()) return;
    
    const result = await addVariable(newName.trim(), newValue, newDescription);
    if (result) {
      setIsAdding(false);
      setNewName('');
      setNewValue('');
      setNewDescription('');
    }
  };

  const handleStartEdit = (variable) => {
    setEditingId(variable.row_id);
    setEditValue(variable.variable_value || '');
  };

  const handleSaveEdit = async (rowId) => {
    await updateVariable(rowId, { variable_value: editValue });
    setEditingId(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  return (
    <div className="space-y-6">
      {/* User Variables Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Variable className="h-4 w-4" />
                User Variables
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Define custom variables using {"{{variableName}}"} syntax in your prompts
              </CardDescription>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="sm" 
                    onClick={() => setIsAdding(true)}
                    disabled={isAdding}
                    className="h-7 w-7 p-0 !text-muted-foreground hover:!text-foreground hover:!bg-sidebar-accent"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add variable</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add new variable form */}
          {isAdding && (
            <div className="p-3 border border-dashed border-primary/50 rounded-lg bg-primary/5 space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Variable name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <Input
                  placeholder="Value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="flex-1"
                />
              </div>
              <Input
                placeholder="Description (optional)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 !text-muted-foreground hover:!text-foreground hover:!bg-sidebar-accent" onClick={() => setIsAdding(false)}>
                  <X className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 !text-primary hover:!bg-sidebar-accent" onClick={handleAdd} disabled={!newName.trim()}>
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Variables list */}
          {isLoading ? (
            <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>
          ) : variables.length === 0 && !isAdding ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              No variables defined. Add a variable to use in your prompts.
            </div>
          ) : (
            <div className="space-y-2">
              {variables.map(variable => (
                <div 
                  key={variable.row_id} 
                  className="flex items-center gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                >
                  <Badge variant="outline" className="font-mono text-xs">
                    {`{{${variable.variable_name}}}`}
                  </Badge>
                  
                  {editingId === variable.row_id ? (
                    <>
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 h-7 text-sm"
                        autoFocus
                      />
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 !text-primary hover:!bg-sidebar-accent" onClick={() => handleSaveEdit(variable.row_id)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 !text-muted-foreground hover:!text-foreground hover:!bg-sidebar-accent" onClick={handleCancelEdit}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm truncate">
                        {variable.variable_value || <span className="text-muted-foreground italic">No value</span>}
                      </span>
                      {variable.variable_description && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="text-xs text-muted-foreground">?</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">{variable.variable_description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 !text-muted-foreground hover:!text-foreground hover:!bg-sidebar-accent" onClick={() => handleStartEdit(variable)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0 !text-muted-foreground hover:!text-destructive hover:!bg-sidebar-accent" 
                        onClick={() => deleteVariable(variable.row_id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* System Variables Section (Read-only) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            System Variables
            <Badge variant="secondary" className="text-xs">Read-only</Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Automatically populated from the last AI call. Access with {"{{q.variableName}}"} syntax.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(systemVariables).length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              No AI calls have been made yet. Run a generation to populate system variables.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(systemVariables).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                  <Badge variant="outline" className="font-mono text-xs bg-muted">
                    {`{{q.${key}}}`}
                  </Badge>
                  <span className="text-xs text-muted-foreground truncate">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VariablesTab;
