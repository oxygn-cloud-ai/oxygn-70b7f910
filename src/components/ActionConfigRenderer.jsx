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
import { extractSchemaKeys } from '@/utils/schemaUtils';
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

  // Multi-select schema keys (for selecting multiple keys)
  const renderSchemaKeysField = (field) => {
    const selectedKeys = config[field.key] || [];
    const fieldId = `action-config-${field.key}`;

    return (
      <div key={field.key} className="space-y-2">
        <Label htmlFor={fieldId} className="text-label-sm text-on-surface-variant">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {field.helpText && (
          <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
        )}
        
        {schemaKeys.length === 0 ? (
          <p className="text-[10px] text-on-surface-variant italic">
            No schema keys available. Define a JSON schema first.
          </p>
        ) : (
          <div className="space-y-1 p-2 bg-surface-container rounded-m3-sm">
            {schemaKeys.map((schemaKey) => (
              <label 
                key={schemaKey.key} 
                className="flex items-center gap-2 cursor-pointer hover:bg-surface-container-high p-1 rounded"
              >
                <Checkbox
                  checked={selectedKeys.includes(schemaKey.key)}
                  onCheckedChange={(checked) => {
                    const newKeys = checked
                      ? [...selectedKeys, schemaKey.key]
                      : selectedKeys.filter(k => k !== schemaKey.key);
                    handleFieldChange(field.key, newKeys);
                  }}
                  disabled={disabled}
                />
                <span className="text-body-sm text-on-surface">{schemaKey.key}</span>
                <Badge variant="outline" className="text-[9px]">{schemaKey.type}</Badge>
                {schemaKey.isArray && (
                  <Badge variant="secondary" className="text-[9px]">array</Badge>
                )}
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Single-select schema key (for picking ONE key like json_path)
  const renderSingleSchemaKeyField = (field) => {
    // Handle value as string or first element of array
    const rawValue = config[field.key];
    const selectedKey = Array.isArray(rawValue) ? rawValue[0] : (rawValue || '');
    const fieldId = `action-config-${field.key}`;
    
    // Filter to only array types for json_path
    const arrayKeys = schemaKeys.filter(k => k.isArray);
    const displayKeys = arrayKeys.length > 0 ? arrayKeys : schemaKeys;

    // If no schema keys, show fallback text input
    if (schemaKeys.length === 0) {
      return (
        <div key={field.key} className="space-y-2">
          <Label htmlFor={fieldId} className="text-label-sm text-on-surface-variant">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          {field.helpText && (
            <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
          )}
          <Input
            id={fieldId}
            value={selectedKey}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder || "e.g., sections or items"}
            disabled={disabled}
            className="h-8 text-body-sm font-mono"
          />
          <p className="text-[10px] text-on-surface-variant italic">
            No schema defined. Enter the array path manually.
          </p>
        </div>
      );
    }

    return (
      <div key={field.key} className="space-y-2">
        <Label htmlFor={fieldId} className="text-label-sm text-on-surface-variant">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {field.helpText && (
          <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
        )}
        
        <Select
          value={selectedKey}
          onValueChange={(value) => handleFieldChange(field.key, value)}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 text-body-sm">
            <SelectValue placeholder="Select array field..." />
          </SelectTrigger>
          <SelectContent>
            {displayKeys.map((schemaKey) => (
              <SelectItem key={schemaKey.key} value={schemaKey.key}>
                {schemaKey.key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderPromptPickerField = (field) => {
    const selectedValue = config[field.key] || '';
    const fieldId = `action-config-${field.key}`;

    // Flatten tree to get all prompts
    const flattenTree = (nodes, parentName = '') => {
      return nodes.reduce((acc, node) => {
        const fullName = parentName ? `${parentName} / ${node.prompt_name}` : node.prompt_name;
        acc.push({ ...node, fullName });
        if (node.children?.length > 0) {
          acc.push(...flattenTree(node.children, fullName));
        }
        return acc;
      }, []);
    };

    const allPrompts = flattenTree(treeData);

    return (
      <div key={field.key} className="space-y-2">
        <Label htmlFor={fieldId} className="text-label-sm text-on-surface-variant">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {field.helpText && (
          <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
        )}
        
        <Select
          value={selectedValue}
          onValueChange={(value) => handleFieldChange(field.key, value)}
          disabled={disabled || treeLoading}
        >
          <SelectTrigger className="h-8 text-body-sm">
            <SelectValue placeholder={treeLoading ? "Loading..." : "Select a prompt..."} />
          </SelectTrigger>
          <SelectContent>
            <ScrollArea className="max-h-[200px]">
              {allPrompts.map((prompt) => (
                <SelectItem key={prompt.row_id} value={prompt.row_id}>
                  {prompt.fullName}
                </SelectItem>
              ))}
            </ScrollArea>
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderLibraryPickerField = (field) => {
    const selectedValue = config[field.key] || '';
    const fieldId = `action-config-${field.key}`;

    return (
      <div key={field.key} className="space-y-2">
        <Label htmlFor={fieldId} className="text-label-sm text-on-surface-variant">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {field.helpText && (
          <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
        )}
        
        <Select
          value={selectedValue}
          onValueChange={(value) => handleFieldChange(field.key, value === '_none' ? null : value)}
          disabled={disabled || libraryLoading}
        >
          <SelectTrigger className="h-8 text-body-sm">
            <SelectValue placeholder={libraryLoading ? "Loading..." : "Select from library..."} />
          </SelectTrigger>
          <SelectContent>
            <ScrollArea className="max-h-[200px]">
              <SelectItem value="_none">
                <span className="text-on-surface-variant">None</span>
              </SelectItem>
              {libraryItems.map((item) => (
                <SelectItem key={item.row_id} value={item.row_id}>
                  {item.name}
                </SelectItem>
              ))}
            </ScrollArea>
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderField = (field) => {
    const fieldId = `action-config-${field.key}`;
    const value = config[field.key] ?? field.defaultValue ?? '';
    
    // Handle dependsOn - only show field if dependency is met
    if (field.dependsOn) {
      const dependencyValue = config[field.dependsOn.key];
      if (dependencyValue !== field.dependsOn.value) {
        return null; // Don't render this field
      }
    }

    switch (field.type) {
      case CONFIG_FIELD_TYPES.SCHEMA_KEYS:
        return renderSchemaKeysField(field);

      case CONFIG_FIELD_TYPES.SCHEMA_KEY:
        return renderSingleSchemaKeyField(field);

      case CONFIG_FIELD_TYPES.PROMPT_PICKER:
        return renderPromptPickerField(field);

      case CONFIG_FIELD_TYPES.LIBRARY_PICKER:
        return renderLibraryPickerField(field);

      case CONFIG_FIELD_TYPES.SELECT: {
        // Normalize options: support both string arrays AND {value, label} objects
        const normalizedOptions = (field.options || []).map(opt => 
          typeof opt === 'string' ? { value: opt, label: opt } : opt
        );

        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={fieldId} className="text-label-sm text-on-surface-variant">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {field.helpText && (
              <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
            )}
            <Select
              value={value}
              onValueChange={(v) => handleFieldChange(field.key, v)}
              disabled={disabled}
            >
              <SelectTrigger className="h-8 text-body-sm">
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}...`} />
              </SelectTrigger>
              <SelectContent>
                {normalizedOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      }

      case CONFIG_FIELD_TYPES.BOOLEAN:
        return (
          <div key={field.key} className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor={fieldId} className="text-body-sm text-on-surface">
                {field.label}
              </Label>
              {field.helpText && (
                <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
              )}
            </div>
            <Switch
              id={fieldId}
              checked={!!value}
              onCheckedChange={(checked) => handleFieldChange(field.key, checked)}
              disabled={disabled}
            />
          </div>
        );

      case CONFIG_FIELD_TYPES.NUMBER:
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={fieldId} className="text-label-sm text-on-surface-variant">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {field.helpText && (
              <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
            )}
            <Input
              id={fieldId}
              type="number"
              value={value}
              onChange={(e) => handleFieldChange(field.key, parseInt(e.target.value, 10) || 0)}
              min={field.min}
              max={field.max}
              disabled={disabled}
              className="h-8 text-body-sm"
            />
          </div>
        );

      case CONFIG_FIELD_TYPES.TEXTAREA:
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={fieldId} className="text-label-sm text-on-surface-variant">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {field.helpText && (
              <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
            )}
            <Textarea
              id={fieldId}
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              disabled={disabled}
              className="text-body-sm min-h-[80px]"
            />
          </div>
        );

      case CONFIG_FIELD_TYPES.JSON_PATH:
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={fieldId} className="text-label-sm text-on-surface-variant">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {field.helpText && (
              <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
            )}
            <Input
              id={fieldId}
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder || "e.g., sections or items"}
              disabled={disabled}
              className="h-8 text-body-sm font-mono"
            />
            <p className="text-[10px] text-on-surface-variant">
              Use dot notation for nested paths (e.g., <code>response.sections</code>)
            </p>
          </div>
        );

      case CONFIG_FIELD_TYPES.TEXT:
      default:
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={fieldId} className="text-label-sm text-on-surface-variant">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {field.helpText && (
              <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
            )}
            <Input
              id={fieldId}
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              disabled={disabled}
              className="h-8 text-body-sm"
            />
          </div>
        );
    }
  };

  if (!schema || schema.length === 0) {
    return (
      <p className="text-[10px] text-on-surface-variant italic">
        No configuration options for this action.
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
