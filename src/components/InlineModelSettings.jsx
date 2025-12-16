import React, { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Info, ExternalLink } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ALL_SETTINGS, isSettingSupported } from '@/config/modelCapabilities';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const InlineModelSettings = ({ 
  model, 
  defaults, 
  onUpdateDefault,
  isExpanded,
  onToggleExpand
}) => {
  const modelDefaults = defaults || {};

  const handleCheckChange = useCallback(async (field, checked) => {
    await onUpdateDefault(model.model_id, `${field}_on`, checked);
    
    if (checked && !modelDefaults[field]) {
      const defaultValues = {
        temperature: '0.7',
        max_tokens: '2048',
        top_p: '1',
        frequency_penalty: '0',
        presence_penalty: '0',
        n: '1',
        stream: false,
        response_format: '{"type": "text"}',
      };
      if (defaultValues[field] !== undefined) {
        await onUpdateDefault(model.model_id, field, defaultValues[field]);
      }
    }
  }, [model.model_id, modelDefaults, onUpdateDefault]);

  const handleValueChange = useCallback(async (field, value) => {
    await onUpdateDefault(model.model_id, field, value);
  }, [model.model_id, onUpdateDefault]);

  const settingKeys = Object.keys(ALL_SETTINGS);
  const enabledCount = settingKeys.filter(key => modelDefaults[`${key}_on`]).length;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleExpand}
        className="h-8 w-8"
      >
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>
      {enabledCount > 0 && !isExpanded && (
        <span className="text-xs text-muted-foreground ml-1">
          ({enabledCount})
        </span>
      )}
    </>
  );
};

export const ModelSettingsPanel = ({ 
  model, 
  defaults, 
  onUpdateDefault 
}) => {
  const modelDefaults = defaults || {};

  const handleCheckChange = useCallback(async (field, checked) => {
    await onUpdateDefault(model.model_id, `${field}_on`, checked);
    
    if (checked && !modelDefaults[field]) {
      const defaultValues = {
        temperature: '0.7',
        max_tokens: '2048',
        top_p: '1',
        frequency_penalty: '0',
        presence_penalty: '0',
        n: '1',
        stream: false,
        response_format: '{"type": "text"}',
      };
      if (defaultValues[field] !== undefined) {
        await onUpdateDefault(model.model_id, field, defaultValues[field]);
      }
    }
  }, [model.model_id, modelDefaults, onUpdateDefault]);

  const handleValueChange = useCallback(async (field, value) => {
    await onUpdateDefault(model.model_id, field, value);
  }, [model.model_id, onUpdateDefault]);

  const settingKeys = Object.keys(ALL_SETTINGS);

  const defaultValues = {
    temperature: '0.7',
    max_tokens: '2048',
    top_p: '1',
    frequency_penalty: '0',
    presence_penalty: '0',
    n: '1',
    stream: 'false',
    response_format: '{"type": "text"}',
    stop: '',
    logit_bias: '',
    o_user: '',
  };

  return (
    <div className="p-4 bg-muted/30 border-t">
      <p className="text-sm text-muted-foreground mb-3">
        Default settings for new prompts using this model
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {settingKeys.map(field => {
          const settingInfo = ALL_SETTINGS[field];
          const isSupported = isSettingSupported(field, model.model_id, model.provider);
          const isEnabled = modelDefaults[`${field}_on`] || false;
          const value = modelDefaults[field] !== undefined && modelDefaults[field] !== null 
            ? modelDefaults[field] 
            : (isEnabled ? defaultValues[field] || '' : '');

          return (
            <div 
              key={field}
              className={cn(
                "p-2 rounded-lg border transition-all",
                !isSupported 
                  ? "bg-muted/50 border-muted opacity-50" 
                  : "bg-background border-border"
              )}
            >
              <div className="flex items-center space-x-2 mb-1">
                <Checkbox
                  id={`${model.model_id}-${field}-checkbox`}
                  checked={isEnabled}
                  onCheckedChange={(checked) => handleCheckChange(field, checked)}
                  disabled={!isSupported}
                  className="h-3.5 w-3.5"
                />
                <label 
                  htmlFor={`${model.model_id}-${field}`}
                  className={cn(
                    "text-xs font-medium flex-grow",
                    !isSupported ? "text-muted-foreground" : "text-foreground"
                  )}
                >
                  {settingInfo.label}
                </label>
                
                {settingInfo.details && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-4 w-4 text-muted-foreground p-0">
                        <Info className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64" side="top">
                      <div className="space-y-2">
                        <h4 className="font-medium text-xs">{settingInfo.label}</h4>
                        <p className="text-xs text-muted-foreground">{settingInfo.details}</p>
                        {settingInfo.docUrl && (
                          <a 
                            href={settingInfo.docUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Docs <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              
              <Input
                id={`${model.model_id}-${field}`}
                value={value}
                onChange={(e) => handleValueChange(field, e.target.value)}
                disabled={!isEnabled || !isSupported}
                className="w-full h-7 text-xs"
                placeholder={!isSupported ? "N/A" : (defaultValues[field] || "Enter value")}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InlineModelSettings;
