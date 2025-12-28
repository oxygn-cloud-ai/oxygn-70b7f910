/**
 * ActionConfigRenderer
 * 
 * Dynamically renders configuration fields based on action type schema.
 * Supports text, number, select, textarea, boolean, json_path, schema_keys, and prompt_picker field types.
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, ChevronRight, Folder } from 'lucide-react';
import { CONFIG_FIELD_TYPES } from '@/config/actionTypes';
import { usePromptLibrary } from '@/hooks/usePromptLibrary';
import { extractSchemaKeys } from '@/config/defaultSchemas';
import useTreeData from '@/hooks/useTreeData';
import { useSupabase } from '@/hooks/useSupabase';

const ActionConfigRenderer = ({ 
  schema = [], 
  config = {}, 
  onChange,
  disabled = false,
  currentSchema = null, // The current JSON schema for SCHEMA_KEYS field type
}) => {
  const supabase = useSupabase();
  const { items: libraryItems, isLoading: libraryLoading } = usePromptLibrary();
  const { treeData, isLoading: treeLoading } = useTreeData(supabase);

  const handleFieldChange = (key, value) => {
    onChange?.({
      ...config,
      [key]: value,
    });
  };

  // Extract keys from currentSchema for SCHEMA_KEYS field type
  const schemaKeys = React.useMemo(() => {
    if (!currentSchema) return [];
    return extractSchemaKeys(currentSchema);
  }, [currentSchema]);

  const renderSchemaKeysField = (field) => {
    const selectedKeys = config[field.key] || [];
    const fieldId = `action-config-${field.key}`;

    // If no schema available, fall back to text input
    if (schemaKeys.length === 0) {
      return (
        <div key={field.key} className="space-y-2">
          <Label htmlFor={fieldId} className="text-body-sm font-medium text-on-surface">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <Input
            id={fieldId}
            value={typeof selectedKeys === 'string' ? selectedKeys : selectedKeys.join(', ')}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.fallbackPattern || 'e.g., items, goals, tasks'}
            disabled={disabled}
            className="font-mono text-body-sm"
          />
          <p className="text-[10px] text-on-surface-variant">
            {field.helpText} (No schema detected - enter path manually)
          </p>
        </div>
      );
    }

    // Visual key picker
    const arrayKeys = schemaKeys.filter(k => k.isArray);
    
    return (
      <div key={field.key} className="space-y-2">
        <Label className="text-body-sm font-medium text-on-surface">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        
        {arrayKeys.length > 0 ? (
          <div className="space-y-2 p-2 bg-surface-container-low rounded-m3-sm">
            {arrayKeys.map((keyInfo) => {
              const isSelected = Array.isArray(selectedKeys) 
                ? selectedKeys.includes(keyInfo.key)
                : selectedKeys === keyInfo.key;
              
              return (
                <div 
                  key={keyInfo.key} 
                  className="flex items-center gap-2 p-2 rounded-m3-sm hover:bg-surface-container cursor-pointer"
                  onClick={() => {
                    if (disabled) return;
                    // For single selection (json_path), just set the value
                    handleFieldChange(field.key, keyInfo.key);
                  }}
                >
                  <Checkbox 
                    checked={isSelected}
                    disabled={disabled}
                    onCheckedChange={() => {
                      handleFieldChange(field.key, keyInfo.key);
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-body-sm font-mono text-primary">{keyInfo.key}</code>
                      <Badge variant="outline" className="text-[10px]">
                        {keyInfo.type}[]
                      </Badge>
                    </div>
                    {keyInfo.description && (
                      <p className="text-[10px] text-on-surface-variant truncate">
                        {keyInfo.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[10px] text-on-surface-variant italic">
            No array fields found in schema
          </p>
        )}
        
        {field.helpText && (
          <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
        )}
      </div>
    );
  };

  // Flatten tree for prompt picker
  const flattenTree = React.useCallback((nodes, depth = 0) => {
    const result = [];
    for (const node of nodes || []) {
      result.push({ ...node, depth });
      if (node.children?.length) {
        result.push(...flattenTree(node.children, depth + 1));
      }
    }
    return result;
  }, []);

  const flatPrompts = React.useMemo(() => flattenTree(treeData), [treeData, flattenTree]);

  const renderPromptPickerField = (field) => {
    const selectedId = config[field.key] || '';
    const fieldId = `action-config-${field.key}`;
    const selectedPrompt = flatPrompts.find(p => (p.row_id || p.id) === selectedId);

    return (
      <div key={field.key} className="space-y-2">
        <Label htmlFor={fieldId} className="text-body-sm font-medium text-on-surface">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        
        {treeLoading ? (
          <div className="text-body-sm text-on-surface-variant">Loading prompts...</div>
        ) : (
          <div className="space-y-2">
            {/* Current selection display */}
            {selectedPrompt && (
              <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-m3-sm border border-primary/20">
                <FileText className="h-3 w-3 text-primary" />
                <span className="text-body-sm text-on-surface flex-1 truncate">
                  {selectedPrompt.prompt_name || selectedPrompt.label || 'Unnamed'}
                </span>
                <button
                  type="button"
                  onClick={() => handleFieldChange(field.key, null)}
                  className="text-[10px] text-on-surface-variant hover:text-on-surface"
                  disabled={disabled}
                >
                  Clear
                </button>
              </div>
            )}
            
            {/* Prompt tree picker */}
            <ScrollArea className="h-40 border border-outline-variant rounded-m3-sm">
              <div className="p-1">
                {flatPrompts.map((prompt) => {
                  const id = prompt.row_id || prompt.id;
                  const isSelected = id === selectedId;
                  const hasChildren = prompt.children?.length > 0;
                  
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleFieldChange(field.key, id)}
                      disabled={disabled}
                      className={`w-full text-left px-2 py-1.5 rounded-m3-sm flex items-center gap-1.5 text-body-sm transition-colors ${
                        isSelected 
                          ? 'bg-primary/10 text-primary' 
                          : 'hover:bg-surface-container text-on-surface'
                      }`}
                      style={{ paddingLeft: `${8 + prompt.depth * 16}px` }}
                    >
                      {hasChildren ? (
                        <Folder className="h-3 w-3 text-on-surface-variant shrink-0" />
                      ) : (
                        <FileText className="h-3 w-3 text-on-surface-variant shrink-0" />
                      )}
                      <span className="truncate flex-1">
                        {prompt.prompt_name || prompt.label || 'Unnamed'}
                      </span>
                      {isSelected && (
                        <ChevronRight className="h-3 w-3 text-primary shrink-0" />
                      )}
                    </button>
                  );
                })}
                {flatPrompts.length === 0 && (
                  <div className="p-2 text-body-sm text-on-surface-variant italic">
                    No prompts available
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
        
        {field.helpText && (
          <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
        )}
      </div>
    );
  };

  const renderField = (field) => {
    // Check dependsOn condition
    if (field.dependsOn) {
      const dependencyValue = config[field.dependsOn.key];
      if (dependencyValue !== field.dependsOn.value) {
        return null; // Hide field if dependency not met
      }
    }

    const value = config[field.key] ?? field.defaultValue ?? '';
    const fieldId = `action-config-${field.key}`;

    switch (field.type) {
      case CONFIG_FIELD_TYPES.PROMPT_PICKER:
        return renderPromptPickerField(field);

      case CONFIG_FIELD_TYPES.SCHEMA_KEYS:
        return renderSchemaKeysField(field);

      case CONFIG_FIELD_TYPES.TEXT:
      case CONFIG_FIELD_TYPES.JSON_PATH:
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={fieldId} className="text-body-sm font-medium text-on-surface">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={fieldId}
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.type === CONFIG_FIELD_TYPES.JSON_PATH ? 'e.g., items or data.results' : ''}
              disabled={disabled}
              className="font-mono text-body-sm"
            />
            {field.helpText && (
              <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
            )}
          </div>
        );

      case CONFIG_FIELD_TYPES.NUMBER:
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={fieldId} className="text-body-sm font-medium text-on-surface">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={fieldId}
              type="number"
              value={value}
              onChange={(e) => handleFieldChange(field.key, parseInt(e.target.value, 10) || 0)}
              min={field.min}
              max={field.max}
              disabled={disabled}
            />
            {field.helpText && (
              <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
            )}
          </div>
        );

      case CONFIG_FIELD_TYPES.TEXTAREA:
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={fieldId} className="text-body-sm font-medium text-on-surface">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={fieldId}
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              disabled={disabled}
              rows={3}
            />
            {field.helpText && (
              <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
            )}
          </div>
        );

      case CONFIG_FIELD_TYPES.BOOLEAN:
        return (
          <div key={field.key} className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor={fieldId} className="text-body-sm font-medium text-on-surface">
                {field.label}
              </Label>
              {field.helpText && (
                <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
              )}
            </div>
            <Switch
              id={fieldId}
              checked={value === true || value === 'true'}
              onCheckedChange={(checked) => handleFieldChange(field.key, checked)}
              disabled={disabled}
            />
          </div>
        );

      case CONFIG_FIELD_TYPES.SELECT:
        // Handle library prompt source
        if (field.source === 'prompt_library') {
          return (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={fieldId} className="text-body-sm font-medium text-on-surface">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Select
                value={value || '_none'}
                onValueChange={(v) => handleFieldChange(field.key, v === '_none' ? null : v)}
                disabled={disabled || libraryLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select library prompt..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {libraryItems?.map((item) => (
                    <SelectItem key={item.row_id} value={item.row_id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {field.helpText && (
                <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
              )}
            </div>
          );
        }

        // Handle static options
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={fieldId} className="text-body-sm font-medium text-on-surface">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select
              value={value}
              onValueChange={(v) => handleFieldChange(field.key, v)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.helpText && (
              <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (!schema || schema.length === 0) {
    return (
      <p className="text-body-sm text-on-surface-variant italic">
        No configuration required for this action.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {schema.map(renderField)}
    </div>
  );
};

export default ActionConfigRenderer;
