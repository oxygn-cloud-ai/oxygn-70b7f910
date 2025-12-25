/**
 * ActionConfigRenderer
 * 
 * Dynamically renders configuration fields based on action type schema.
 * Supports text, number, select, textarea, boolean, and json_path field types.
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CONFIG_FIELD_TYPES } from '@/config/actionTypes';
import { usePromptLibrary } from '@/hooks/usePromptLibrary';

const ActionConfigRenderer = ({ 
  schema = [], 
  config = {}, 
  onChange,
  disabled = false,
}) => {
  const { items: libraryItems, isLoading: libraryLoading } = usePromptLibrary();

  const handleFieldChange = (key, value) => {
    onChange?.({
      ...config,
      [key]: value,
    });
  };

  const renderField = (field) => {
    const value = config[field.key] ?? field.defaultValue ?? '';
    const fieldId = `action-config-${field.key}`;

    switch (field.type) {
      case CONFIG_FIELD_TYPES.TEXT:
      case CONFIG_FIELD_TYPES.JSON_PATH:
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={fieldId} className="text-sm font-medium">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={fieldId}
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.type === CONFIG_FIELD_TYPES.JSON_PATH ? 'e.g., items or data.results' : ''}
              disabled={disabled}
              className="font-mono text-sm"
            />
            {field.helpText && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
          </div>
        );

      case CONFIG_FIELD_TYPES.NUMBER:
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={fieldId} className="text-sm font-medium">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
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
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
          </div>
        );

      case CONFIG_FIELD_TYPES.TEXTAREA:
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={fieldId} className="text-sm font-medium">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Textarea
              id={fieldId}
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              disabled={disabled}
              rows={3}
            />
            {field.helpText && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
          </div>
        );

      case CONFIG_FIELD_TYPES.BOOLEAN:
        return (
          <div key={field.key} className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor={fieldId} className="text-sm font-medium">
                {field.label}
              </Label>
              {field.helpText && (
                <p className="text-xs text-muted-foreground">{field.helpText}</p>
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
              <Label htmlFor={fieldId} className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
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
                <p className="text-xs text-muted-foreground">{field.helpText}</p>
              )}
            </div>
          );
        }

        // Handle static options
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={fieldId} className="text-sm font-medium">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
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
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (!schema || schema.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
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
