/**
 * ActionConfigRenderer
 * 
 * Dynamically renders configuration fields based on action type schema.
 * Supports text, number, select, textarea, boolean, json_path, and schema_keys field types.
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CONFIG_FIELD_TYPES } from '@/config/actionTypes';
import { usePromptLibrary } from '@/hooks/usePromptLibrary';
import { extractSchemaKeys } from '@/config/defaultSchemas';

const ActionConfigRenderer = ({ 
  schema = [], 
  config = {}, 
  onChange,
  disabled = false,
  currentSchema = null, // The current JSON schema for SCHEMA_KEYS field type
}) => {
  const { items: libraryItems, isLoading: libraryLoading } = usePromptLibrary();

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

  const renderField = (field) => {
    const value = config[field.key] ?? field.defaultValue ?? '';
    const fieldId = `action-config-${field.key}`;

    switch (field.type) {
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
