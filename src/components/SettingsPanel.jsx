import React, { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Globe, FileText, Code, Search, ExternalLink } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useSupabase } from '../hooks/useSupabase';
import { useSettings } from '../hooks/useSettings';
import { toast } from '@/components/ui/sonner';
import { M3IconButton } from '@/components/ui/m3-icon-button';
import { 
  ALL_SETTINGS, 
  ALL_TOOLS, 
  getModelCapabilities, 
  getModelTools,
  isSettingSupported, 
  isToolSupported 
} from '@/config/modelCapabilities';

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
      <div className="space-y-4">
        {/* Model Selection - M3 Surface Container */}
        <div className="p-3 bg-surface-container dark:bg-surface-container-low rounded-xl">
          <Select
            value={localData.model_on && localData.model ? localData.model : '__default__'}
            onValueChange={handleModelChange}
          >
            <SelectTrigger className="h-10 text-body-medium bg-surface-container-highest dark:bg-surface-container-high border-outline-variant">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent className="bg-surface-container-high border-outline-variant">
              <SelectItem value="__default__" className="text-body-medium">
                Default ({defaultModelName})
              </SelectItem>
              {models.map((model) => (
                <SelectItem key={model.row_id} value={model.model_id} className="text-body-medium">
                  {model.model_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tools Row - M3 Surface Container */}
        <div className="flex items-center gap-2 p-3 bg-surface-container dark:bg-surface-container-low rounded-xl">
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
                      "flex items-center justify-center h-10 w-10 rounded-full",
                      "transition-all duration-medium-2 ease-standard",
                      isEnabled && actuallySupported
                        ? "bg-primary text-on-primary shadow-elevation-1"
                        : "bg-surface-container-highest dark:bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest/80",
                      !actuallySupported && "opacity-38 cursor-not-allowed"
                    )}
                  >
                    <IconComponent className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-inverse-surface text-inverse-on-surface max-w-[200px]">
                  <p className="text-label-medium font-medium">{tool.label}</p>
                  <p className="text-body-small opacity-80">{tool.description}</p>
                  {!actuallySupported && (
                    <p className="text-body-small text-error mt-1">Not supported by this model</p>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Settings Grid - M3 Surface Containers */}
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
                  "flex items-center gap-2 p-3 rounded-xl",
                  "transition-all duration-medium-2 ease-standard",
                  isSupported 
                    ? "bg-surface-container dark:bg-surface-container-low" 
                    : "bg-surface-container-low dark:bg-surface-container-lowest opacity-50"
                )}
              >
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => isSupported && handleToggleChange(settingKey, checked)}
                  disabled={!isSupported}
                  className="h-5 w-9 data-[state=checked]:bg-primary data-[state=unchecked]:bg-surface-container-highest"
                />
                
                <div className="flex-1 min-w-0">
                  {setting.type === 'select' ? (
                    <Select
                      value={value || setting.defaultValue}
                      onValueChange={(v) => handleValueChange(settingKey, v)}
                      disabled={!isEnabled || !isSupported}
                    >
                      <SelectTrigger className="h-8 text-body-small px-2 border-0 bg-transparent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-surface-container-high border-outline-variant">
                        {setting.options?.map(opt => (
                          <SelectItem key={opt.value} value={opt.value} className="text-body-small">
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
                      className="h-8 text-body-small px-2 border-0 bg-transparent"
                      min={setting.min}
                      max={setting.max}
                      step={setting.step}
                    />
                  )}
                </div>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <div>
                      <M3IconButton
                        size="small"
                        className="text-on-surface-variant"
                      >
                        <Info />
                      </M3IconButton>
                    </div>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-72 bg-surface-container-high dark:bg-surface-container border-outline-variant" 
                    side="top"
                  >
                    <div className="space-y-3">
                      <h4 className="text-title-small font-medium text-on-surface">{setting.label}</h4>
                      <p className="text-body-small text-on-surface-variant">{setting.details}</p>
                      {setting.docUrl && (
                        <a 
                          href={setting.docUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-label-medium text-primary hover:text-primary/80 transition-colors"
                        >
                          API Docs
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      {!isSupported && (
                        <p className="text-body-small text-error">Not supported by {currentModel}</p>
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
