import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Globe, FileText, Code, Search, ExternalLink, Bot } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useSupabase } from '../hooks/useSupabase';
import { useSettings } from '../hooks/useSettings';
import { useModels } from '../hooks/useModels';
import { toast } from '@/components/ui/sonner';
import { ALL_SETTINGS, ALL_TOOLS } from '@/config/modelCapabilities';
import type { LucideIcon } from 'lucide-react';

const TOOL_ICONS: Record<string, LucideIcon> = {
  web_search: Globe,
  confluence: FileText,
  code_interpreter: Code,
  file_search: Search,
};

interface ModelData {
  row_id: string;
  model_id: string;
  model_name?: string;
  provider?: string;
  is_active?: boolean;
}

interface SettingsPanelProps {
  localData: Record<string, unknown>;
  selectedItemData: { row_id: string };
  models: ModelData[];
  handleChange: (key: string, value: unknown) => void;
  handleSave?: () => void;
  handleReset?: () => void;
  hasUnsavedChanges?: boolean;
}

const SettingsPanel = ({ 
  localData, 
  selectedItemData, 
  models, 
  handleChange, 
}: SettingsPanelProps) => {
  const supabase = useSupabase();
  const { settings } = useSettings(supabase);
  const { isSettingSupported, isToolSupported } = useModels();

  // Get default model from global settings
  const defaultModel = useMemo(() => {
    return (settings as Record<string, { value?: string }> | null)?.default_model?.value || (models[0]?.model_id) || '';
  }, [settings, models]);

  // Get the currently selected model (prompt's model or default)
  const currentModel = (localData.model as string) || defaultModel;
  const currentModelData = models.find((m: ModelData) => m.model_id === currentModel || m.model_name === currentModel);
  
  // Get provider for current model
  const currentProvider = currentModelData?.provider || 'openai';
  const isManusModel = currentProvider === 'manus';

  // Group models by provider
  const modelsByProvider = useMemo(() => {
    const grouped: Record<string, ModelData[]> = {};
    models.forEach((model: ModelData) => {
      const provider = model.provider || 'openai';
      if (!grouped[provider]) grouped[provider] = [];
      grouped[provider].push(model);
    });
    return grouped;
  }, [models]);

  // Settings to display - filter based on provider
  const visibleSettings = isManusModel 
    ? ['task_mode']
    : ['temperature', 'max_tokens', 'max_completion_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'reasoning_effort'];
  
  // Tools to display - Manus doesn't use these tools
  const toolKeys = isManusModel ? [] : ['web_search', 'confluence', 'code_interpreter', 'file_search'];

  const handleToggleChange = async (fieldName: string, checked: boolean) => {
    handleChange(`${fieldName}_on`, checked);
    
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ [`${fieldName}_on`]: checked })
        .eq('row_id', selectedItemData.row_id);

      if (error) throw error;

      // Set default value if enabling
      if (checked && !localData[fieldName]) {
        const settingInfo = ALL_SETTINGS[fieldName as keyof typeof ALL_SETTINGS] as { defaultValue?: string } | undefined;
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

  const handleToolToggle = async (toolName: string, checked: boolean) => {
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

  const handleModelChange = async (value: string) => {
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

  // For Input fields - only update local state, save on blur
  const handleInputChange = (fieldName: string, value: string) => {
    handleChange(fieldName, value);
  };

  // For Select fields - save immediately (no blur event)
  const handleSelectChange = async (fieldName: string, value: string) => {
    handleChange(fieldName, value);
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ [fieldName]: value })
        .eq('row_id', selectedItemData.row_id);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving field:', error);
      toast.error(`Failed to save ${fieldName}`);
    }
  };

  const handleValueBlur = async (fieldName: string) => {
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

  const defaultModelData = models.find((m: ModelData) => m.model_id === defaultModel);
  const defaultModelName = defaultModelData?.model_name || defaultModel;

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {/* Model Selection */}
        <div className="flex items-center gap-2">
          <Select
            value={localData.model_on && localData.model ? (localData.model as string) : '__default__'}
            onValueChange={handleModelChange}
          >
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">
                Default ({defaultModelName})
              </SelectItem>
              
              {/* OpenAI Models */}
              {modelsByProvider.openai?.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-[10px] text-on-surface-variant uppercase px-2 py-1">OpenAI</SelectLabel>
                  {modelsByProvider.openai.filter((m: ModelData) => m.is_active).map((model: ModelData) => (
                    <SelectItem key={model.row_id} value={model.model_id}>
                      {model.model_name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              
              {/* Manus Models */}
              {modelsByProvider.manus?.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-[10px] text-on-surface-variant uppercase px-2 py-1">Manus</SelectLabel>
                  {modelsByProvider.manus.filter((m: ModelData) => m.is_active).map((model: ModelData) => (
                    <SelectItem key={model.row_id} value={model.model_id}>
                      <div className="flex items-center gap-2">
                        <Bot className="h-3 w-3 text-primary" />
                        {model.model_name}
                        <span className="text-[9px] bg-primary/10 text-primary px-1 py-0.5 rounded">Agentic</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              
              {/* Other providers */}
              {Object.entries(modelsByProvider)
                .filter(([provider]) => !['openai', 'manus'].includes(provider))
                .map(([provider, providerModels]) => (
                  <SelectGroup key={provider}>
                    <SelectLabel className="text-[10px] text-on-surface-variant uppercase px-2 py-1">{provider}</SelectLabel>
                    {(providerModels as ModelData[]).filter((m: ModelData) => m.is_active).map((model: ModelData) => (
                      <SelectItem key={model.row_id} value={model.model_id}>
                        {model.model_name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))
              }
            </SelectContent>
          </Select>
        </div>

        {/* Manus Info Banner */}
        {isManusModel && (
          <div className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-md text-[10px] text-on-surface-variant">
            <Bot className="h-4 w-4 text-primary flex-shrink-0" />
            <span>Manus tasks run asynchronously and may take several minutes to complete.</span>
          </div>
        )}

        {/* Tools Row - Hidden for Manus models */}
        {toolKeys.length > 0 && (
          <div className="flex items-center gap-1 p-1.5 bg-muted/30 rounded-md border border-border/50">
            {toolKeys.map(toolKey => {
              const tool = ALL_TOOLS[toolKey as keyof typeof ALL_TOOLS];
              const IconComponent = TOOL_ICONS[toolKey];
              const isEnabled = localData[`${toolKey}_on`] || false;
              const supported = isToolSupported(toolKey, currentModel);
              
              // Special case: confluence is always supported (it's not model-dependent)
              const actuallySupported = toolKey === 'confluence' ? true : supported;
              
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
        )}

        {/* Settings Grid - 2 columns */}
        <div className="grid grid-cols-2 gap-2">
        {visibleSettings.map(settingKey => {
            const setting = ALL_SETTINGS[settingKey as keyof typeof ALL_SETTINGS] as { label: string; shortLabel: string; details: string; docUrl?: string; type: string; defaultValue?: string; min?: number; max?: number; step?: number; options?: Array<{ value: string; label: string }> } | undefined;
            if (!setting) return null;
            const supported = isSettingSupported(settingKey, currentModel);
            const isEnabled = localData[`${settingKey}_on`] || false;
            const value = (localData[settingKey] as string) || '';
            
            return (
              <div 
                key={settingKey}
                className={cn(
                  "flex items-center gap-1.5 p-1.5 rounded border transition-colors",
                  supported 
                    ? "bg-background border-border/50" 
                    : "bg-muted/30 border-muted opacity-50"
                )}
              >
                <Switch
                  checked={isEnabled as boolean}
                  onCheckedChange={(checked) => supported && handleToggleChange(settingKey, checked)}
                  disabled={!supported}
                  className="h-4 w-7 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted"
                />
                
                <div className="flex-1 min-w-0">
                {setting.type === 'select' ? (
                    <Select
                      value={value || setting.defaultValue}
                      onValueChange={(v) => handleSelectChange(settingKey, v)}
                      disabled={!isEnabled || !supported}
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
                      onChange={(e) => handleInputChange(settingKey, e.target.value)}
                      onBlur={() => handleValueBlur(settingKey)}
                      disabled={!isEnabled || !supported}
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
                      {!supported && (
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
