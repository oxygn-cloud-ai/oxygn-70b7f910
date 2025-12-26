import React, { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Globe, FileText, Code, Search, ExternalLink } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useSupabase } from '../hooks/useSupabase';
import { useSettings } from '../hooks/useSettings';
import { toast } from '@/components/ui/sonner';
import { 
  ALL_SETTINGS, 
  ALL_TOOLS, 
  getModelCapabilities, 
  getModelTools,
  isSettingSupported, 
  isToolSupported 
} from '../config/modelCapabilities';

const TOOL_ICONS = {
  web_search: Globe,
  confluence: FileText,
  code_interpreter: Code,
  file_search: Search,
};

const SettingsPanel = ({ 
  localData, 
  selectedItemData, 
  models, 
  handleChange, 
  handleSave, 
  handleReset, 
  hasUnsavedChanges 
}) => {
  const supabase = useSupabase();
  const { settings, isLoading: settingsLoading } = useSettings(supabase);

  // Get default model from global settings
  const defaultModel = useMemo(() => {
    return settings?.default_model?.value || models[0]?.model_id || '';
  }, [settings, models]);

  // Get the currently selected model (prompt's model or default)
  const currentModel = localData.model || defaultModel;
  const currentModelData = models.find(m => m.model_id === currentModel || m.model_name === currentModel);
  const currentProvider = currentModelData?.provider || 'openai';

  // Settings to display (excluding hidden ones like response_format)
  const visibleSettings = ['temperature', 'max_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'reasoning_effort'];
  
  // Tools to display
  const toolKeys = ['web_search', 'confluence', 'code_interpreter', 'file_search'];

  const handleToggleChange = async (fieldName, checked) => {
    handleChange(`${fieldName}_on`, checked);
    
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ [`${fieldName}_on`]: checked })
        .eq('row_id', selectedItemData.row_id);

      if (error) throw error;

      // Set default value if enabling
      if (checked && !localData[fieldName]) {
        const settingInfo = ALL_SETTINGS[fieldName];
        if (settingInfo?.defaultValue) {
          handleChange(fieldName, settingInfo.defaultValue);
          await supabase
            .from(import.meta.env.VITE_PROMPTS_TBL)
            .update({ [fieldName]: settingInfo.defaultValue })
            .eq('row_id', selectedItemData.row_id);
        }
      }
    } catch (error) {
      console.error('Error updating field:', error);
      toast.error(`Failed to save ${fieldName}`);
    }
  };

  const handleToolToggle = async (toolName, checked) => {
    const fieldName = `${toolName}_on`;
    handleChange(fieldName, checked);
    
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ [fieldName]: checked })
        .eq('row_id', selectedItemData.row_id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating tool:', error);
      toast.error(`Failed to update ${toolName}`);
    }
  };

  const handleModelChange = async (value) => {
    const useDefault = value === '__default__';
    handleChange('model', useDefault ? '' : value);
    handleChange('model_on', !useDefault);
    
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ 
          model: useDefault ? null : value,
          model_on: !useDefault
        })
        .eq('row_id', selectedItemData.row_id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating model:', error);
      toast.error('Failed to update model');
    }
  };

  const handleValueChange = async (fieldName, value) => {
    handleChange(fieldName, value);
  };

  const handleValueBlur = async (fieldName) => {
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ [fieldName]: localData[fieldName] })
        .eq('row_id', selectedItemData.row_id);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving field:', error);
      toast.error(`Failed to save ${fieldName}`);
    }
  };

  const defaultModelData = models.find(m => m.model_id === defaultModel);
  const defaultModelName = defaultModelData?.model_name || defaultModel;

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {/* Model Selection */}
        <div className="flex items-center gap-2">
          <Select
            value={localData.model_on && localData.model ? localData.model : '__default__'}
            onValueChange={handleModelChange}
          >
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">
                Default ({defaultModelName})
              </SelectItem>
              {models.map((model) => (
                <SelectItem key={model.row_id} value={model.model_id}>
                  {model.model_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tools Row */}
        <div className="flex items-center gap-1 p-1.5 bg-muted/30 rounded-md border border-border/50">
          {toolKeys.map(toolKey => {
            const tool = ALL_TOOLS[toolKey];
            const IconComponent = TOOL_ICONS[toolKey];
            const isEnabled = localData[`${toolKey}_on`] || false;
            const isSupported = isToolSupported(toolKey, currentModel, currentProvider);
            
            // Special case: confluence is always supported (it's not model-dependent)
            const actuallySupported = toolKey === 'confluence' ? true : isSupported;
            
            return (
              <Tooltip key={toolKey}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => actuallySupported && handleToolToggle(toolKey, !isEnabled)}
                    disabled={!actuallySupported}
                    className={cn(
                      "flex items-center justify-center h-7 w-7 rounded transition-colors",
                      isEnabled && actuallySupported
                        ? "bg-primary/20 text-primary"
                        : "bg-background text-muted-foreground hover:bg-muted",
                      !actuallySupported && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    <IconComponent className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px]">
                  <p className="text-xs font-medium">{tool.label}</p>
                  <p className="text-xs text-muted-foreground">{tool.description}</p>
                  {!actuallySupported && (
                    <p className="text-xs text-destructive mt-1">Not supported by this model</p>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Settings Grid - 2 columns */}
        <div className="grid grid-cols-2 gap-2">
          {visibleSettings.map(settingKey => {
            const setting = ALL_SETTINGS[settingKey];
            const isSupported = isSettingSupported(settingKey, currentModel, currentProvider);
            const isEnabled = localData[`${settingKey}_on`] || false;
            const value = localData[settingKey] || '';
            
            return (
              <div 
                key={settingKey}
                className={cn(
                  "flex items-center gap-1.5 p-1.5 rounded border transition-colors",
                  isSupported 
                    ? "bg-background border-border/50" 
                    : "bg-muted/30 border-muted opacity-50"
                )}
              >
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => isSupported && handleToggleChange(settingKey, checked)}
                  disabled={!isSupported}
                  className="h-4 w-7 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted"
                />
                
                <div className="flex-1 min-w-0">
                  {setting.type === 'select' ? (
                    <Select
                      value={value || setting.defaultValue}
                      onValueChange={(v) => handleValueChange(settingKey, v)}
                      disabled={!isEnabled || !isSupported}
                    >
                      <SelectTrigger className="h-6 text-[10px] px-1.5 border-0 bg-transparent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {setting.options?.map(opt => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={setting.type === 'number' ? 'number' : 'text'}
                      value={value}
                      onChange={(e) => handleValueChange(settingKey, e.target.value)}
                      onBlur={() => handleValueBlur(settingKey)}
                      disabled={!isEnabled || !isSupported}
                      placeholder={setting.shortLabel}
                      className="h-6 text-[10px] px-1.5 border-0 bg-transparent"
                      min={setting.min}
                      max={setting.max}
                      step={setting.step}
                    />
                  )}
                </div>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <Info className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" side="top">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">{setting.label}</h4>
                      <p className="text-xs text-muted-foreground">{setting.details}</p>
                      {setting.docUrl && (
                        <a 
                          href={setting.docUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          API Docs
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {!isSupported && (
                        <p className="text-xs text-destructive">Not supported by {currentModel}</p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default SettingsPanel;
