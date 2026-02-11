import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Info, ExternalLink } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ALL_SETTINGS } from '@/config/modelCapabilities';
import { useModels } from '@/hooks/useModels';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ModelInfo {
  model_id: string;
  model_name?: string;
}

interface ModelDefaults {
  [key: string]: string | boolean | undefined;
}

interface InlineModelSettingsProps {
  model: ModelInfo;
  defaults: ModelDefaults | null;
  onUpdateDefault: (modelId: string, field: string, value: string | boolean) => Promise<void>;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const InlineModelSettings: React.FC<InlineModelSettingsProps> = ({ 
  model: _model, 
  defaults, 
  onUpdateDefault: _onUpdateDefault,
  isExpanded,
  onToggleExpand
}) => {
  const modelDefaults = defaults || {};

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

interface ModelSettingsPanelProps {
  model: ModelInfo;
  defaults: ModelDefaults | null;
  onUpdateDefault: (modelId: string, field: string, value: string | boolean) => Promise<void>;
}

export const ModelSettingsPanel: React.FC<ModelSettingsPanelProps> = ({ 
  model, 
  defaults, 
  onUpdateDefault 
}) => {
  const modelDefaults = defaults || {};
  const { isSettingSupported } = useModels();
  
  // Local state for input values to enable blur-based saving
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  const handleCheckChange = useCallback(async (field: string, checked: boolean) => {
    await onUpdateDefault(model.model_id, `${field}_on`, checked);
    
    if (checked && !modelDefaults[field]) {
      // Use default value from ALL_SETTINGS config
      const settingConfig = ALL_SETTINGS[field as keyof typeof ALL_SETTINGS];
      if (settingConfig?.defaultValue !== undefined) {
        await onUpdateDefault(model.model_id, field, settingConfig.defaultValue);
      }
    }
  }, [model.model_id, modelDefaults, onUpdateDefault]);

  const handleValueChange = useCallback((field: string, value: string) => {
    setLocalValues(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleValueBlur = useCallback(async (field: string) => {
    const value = localValues[field];
    if (value !== undefined && value !== modelDefaults[field]) {
      await onUpdateDefault(model.model_id, field, value);
    }
  }, [model.model_id, localValues, modelDefaults, onUpdateDefault]);

  const settingKeys = Object.keys(ALL_SETTINGS) as (keyof typeof ALL_SETTINGS)[];

  // Build default values from ALL_SETTINGS config
  const getDefaultValue = (field: keyof typeof ALL_SETTINGS): string => {
    const settingConfig = ALL_SETTINGS[field];
    return settingConfig?.defaultValue ?? '';
  };

  return (
    <div className="p-4 bg-muted/30 border-t">
      <p className="text-sm text-muted-foreground mb-3">
        Default settings for new prompts using this model
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {settingKeys.map(field => {
          const settingInfo = ALL_SETTINGS[field];
          const supported = isSettingSupported(field, model.model_id);
          const isEnabled = modelDefaults[`${field}_on`] || false;
          const dbValue = modelDefaults[field] !== undefined && modelDefaults[field] !== null 
            ? String(modelDefaults[field])
            : (isEnabled ? getDefaultValue(field) : '');
          // Use local value if exists, otherwise use database value
          const value = localValues[field] !== undefined ? localValues[field] : dbValue;

          return (
            <div 
              key={field}
              className={cn(
                "p-2 rounded-lg border transition-all",
                !supported 
                  ? "bg-muted/50 border-muted opacity-50" 
                  : "bg-background border-border"
              )}
            >
              <div className="flex items-center space-x-2 mb-1">
                <Checkbox
                  id={`${model.model_id}-${field}-checkbox`}
                  checked={Boolean(isEnabled)}
                  onCheckedChange={(checked) => handleCheckChange(field, Boolean(checked))}
                  disabled={!supported}
                  className="h-3.5 w-3.5"
                />
                <label 
                  htmlFor={`${model.model_id}-${field}`}
                  className={cn(
                    "text-xs font-medium flex-grow",
                    !supported ? "text-muted-foreground" : "text-foreground"
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
                onBlur={() => handleValueBlur(field)}
                disabled={!isEnabled || !supported}
                className="w-full h-7 text-xs"
                placeholder={!supported ? "N/A" : (getDefaultValue(field) || "Enter value")}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InlineModelSettings;
