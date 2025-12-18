import React, { useState, useEffect, useMemo } from 'react';
import { useAssistant } from '../hooks/useAssistant';
import { useAssistantFiles } from '../hooks/useAssistantFiles';
import { useAssistantToolDefaults } from '../hooks/useAssistantToolDefaults';
import { useOpenAIModels } from '../hooks/useOpenAIModels';
import { useSettings } from '../hooks/useSettings';
import { useSupabase } from '../hooks/useSupabase';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Bot, Trash2, Upload, RefreshCw, Power, X, FileText, Info, Loader2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { ALL_SETTINGS, isSettingSupported } from '../config/modelCapabilities';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const AssistantPanel = ({ promptRowId, selectedItemData }) => {
  const supabase = useSupabase();
  const { assistant, isLoading, isInstantiating, updateAssistant, instantiate, destroy, sync, reInstantiate } = useAssistant(promptRowId);
  const { files, isUploading, uploadFile, deleteFile } = useAssistantFiles(assistant?.row_id);
  const { defaults: toolDefaults } = useAssistantToolDefaults();
  const { models } = useOpenAIModels();
  const { settings } = useSettings(supabase);

  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [useGlobalDefaults, setUseGlobalDefaults] = useState(true);
  const [codeInterpreter, setCodeInterpreter] = useState(true);
  const [fileSearch, setFileSearch] = useState(true);
  const [modelOverride, setModelOverride] = useState('');
  const [temperature, setTemperature] = useState('');
  const [maxTokens, setMaxTokens] = useState('');
  const [topP, setTopP] = useState('');
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  // Get default model from global settings
  const defaultModel = useMemo(() => {
    return settings?.default_model?.value || models?.[0]?.model_id || '';
  }, [settings, models]);

  // Get current effective model
  const currentModel = modelOverride || selectedItemData?.model || defaultModel;
  const currentModelData = models?.find(m => m.model_id === currentModel || m.model_name === currentModel);
  const currentProvider = currentModelData?.provider || 'openai';

  useEffect(() => {
    if (assistant) {
      setName(assistant.name || '');
      setInstructions(assistant.instructions || '');
      setUseGlobalDefaults(assistant.use_global_tool_defaults ?? true);
      setCodeInterpreter(assistant.code_interpreter_enabled ?? toolDefaults?.code_interpreter_enabled ?? true);
      setFileSearch(assistant.file_search_enabled ?? toolDefaults?.file_search_enabled ?? true);
      setModelOverride(assistant.model_override || '');
      setTemperature(assistant.temperature_override || '');
      setMaxTokens(assistant.max_tokens_override || '');
      setTopP(assistant.top_p_override || '');
    }
  }, [assistant, toolDefaults]);

  const handleSave = async (field, value) => {
    await updateAssistant({ [field]: value });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
      e.target.value = '';
    }
  };

  const handleReInstantiate = async () => {
    await reInstantiate();
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!assistant) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-muted-foreground">
          <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Loading assistant configuration...</p>
        </div>
      </div>
    );
  }

  const isActive = assistant.status === 'active';
  const isDestroyed = assistant.status === 'destroyed';
  const isError = assistant.status === 'error';

  // Settings that OpenAI Assistants API supports at assistant level
  const assistantLevelSettings = ['temperature', 'top_p', 'response_format'];
  // Settings passed at run time
  const runTimeSettings = ['max_tokens', 'frequency_penalty', 'presence_penalty', 'stop', 'n', 'stream', 'logit_bias', 'o_user'];

  const SettingRow = ({ field, value, setValue, onSave, type = 'input', min, max, step }) => {
    const settingInfo = ALL_SETTINGS[field];
    const isSupported = isSettingSupported(field, currentModel, currentProvider);
    
    if (!settingInfo) return null;

    return (
      <div className={`${!isSupported ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <Label className="text-xs">{settingInfo.label}</Label>
            {(settingInfo.details || settingInfo.docUrl) && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-4 w-4 text-muted-foreground hover:text-foreground">
                    <Info className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 bg-popover" side="top">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">{settingInfo.label}</h4>
                    {settingInfo.details && <p className="text-xs text-muted-foreground">{settingInfo.details}</p>}
                    {settingInfo.docUrl && (
                      <a href={settingInfo.docUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        Documentation <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
          {type === 'slider' && <span className="text-xs text-muted-foreground">{value || 'Default'}</span>}
        </div>
        {!isSupported ? (
          <p className="text-xs text-muted-foreground italic">Not supported by this model</p>
        ) : type === 'slider' ? (
          <Slider
            value={[parseFloat(value) || (field === 'top_p' ? 1 : field === 'temperature' ? 1 : 0)]}
            min={min} max={max} step={step}
            onValueChange={([v]) => setValue(v.toString())}
            onValueCommit={([v]) => onSave(v.toString())}
          />
        ) : type === 'switch' ? (
          <Switch checked={!!value} onCheckedChange={(v) => { setValue(v); onSave(v); }} />
        ) : (
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => onSave(value || null)}
            placeholder="Default"
            className="h-8 text-sm"
          />
        )}
        <p className="text-[10px] text-muted-foreground mt-0.5">{settingInfo.description}</p>
      </div>
    );
  };

  return (
    <div className="space-y-4 p-4 h-[calc(100vh-8rem)] overflow-auto">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <span className="font-semibold">Assistant Configuration</span>
          <Badge variant={isActive ? 'default' : isDestroyed ? 'destructive' : isError ? 'destructive' : 'secondary'}>
            {isActive ? '● Active' : isDestroyed ? '○ Destroyed' : isError ? '✕ Error' : '○ Not Instantiated'}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {isDestroyed && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleReInstantiate} disabled={isInstantiating}>
                    {isInstantiating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Re-enable Assistant</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {isActive && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={destroy}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Destroy Assistant</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Name & Instructions */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Name & Instructions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Assistant Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => handleSave('name', name)} placeholder="My Assistant" />
          </div>
          <div>
            <Label className="flex items-center gap-1">
              Instructions
              <TooltipProvider><Tooltip><TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs"><p>Use template variables like {'{{input_admin_prompt}}'} to inject prompt field values.</p></TooltipContent>
              </Tooltip></TooltipProvider>
            </Label>
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} onBlur={() => handleSave('instructions', instructions)} placeholder="You are a helpful assistant..." rows={4} />
          </div>
        </CardContent>
      </Card>

      {/* Files */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Files ({files.length})</CardTitle>
            <div className="flex gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={sync} disabled={!isActive}>
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Sync Files</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <label>
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild disabled={isUploading}>
                        <span><Upload className="h-3 w-3" /></span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Upload File</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files attached</p>
          ) : (
            <div className="space-y-1">
              {files.map(file => (
                <div key={file.row_id} className="flex items-center justify-between text-sm py-1 px-2 bg-muted rounded">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3 w-3" />
                    <span className="truncate max-w-48">{file.original_filename}</span>
                    <span className="text-xs text-muted-foreground">({(file.file_size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteFile(file.row_id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Remove File</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model Settings - Collapsible */}
      <Collapsible open={modelSettingsOpen} onOpenChange={setModelSettingsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Model Settings</CardTitle>
                {modelSettingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              {/* Model Selection */}
              <div>
                <Label className="text-xs">Model Override</Label>
                <Select value={modelOverride || 'inherit'} onValueChange={(v) => { const val = v === 'inherit' ? '' : v; setModelOverride(val); handleSave('model_override', val || null); }}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Inherit from prompt" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="inherit">Inherit from prompt</SelectItem>
                    {models?.map(m => <SelectItem key={m.model_id} value={m.model_id}>{m.model_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-0.5">Current: {currentModelData?.model_name || currentModel || 'None'}</p>
              </div>

              {/* Assistant-level settings */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground border-b pb-1">Assistant-Level Settings</p>
                <SettingRow field="temperature" value={temperature} setValue={setTemperature} onSave={(v) => handleSave('temperature_override', v)} type="slider" min={0} max={2} step={0.1} />
                <SettingRow field="top_p" value={topP} setValue={setTopP} onSave={(v) => handleSave('top_p_override', v)} type="slider" min={0} max={1} step={0.05} />
              </div>

              {/* Run-time settings */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground border-b pb-1">Run-Time Settings (applied when executing)</p>
                <SettingRow field="max_tokens" value={maxTokens} setValue={setMaxTokens} onSave={(v) => handleSave('max_tokens_override', v)} type="input" />
                <p className="text-[10px] text-muted-foreground italic">Additional run-time settings (frequency_penalty, presence_penalty, stop, etc.) are inherited from the parent prompt configuration.</p>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Tools - Collapsible */}
      <Collapsible open={toolsOpen} onOpenChange={setToolsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Tools & Capabilities</CardTitle>
                {toolsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-3 pt-0">
              <div className="flex items-center justify-between">
                <Label>Use Global Defaults</Label>
                <Switch checked={useGlobalDefaults} onCheckedChange={(v) => { setUseGlobalDefaults(v); handleSave('use_global_tool_defaults', v); }} />
              </div>
              {!useGlobalDefaults && (
                <>
                  <div className="flex items-center justify-between">
                    <Label>Code Interpreter</Label>
                    <Switch checked={codeInterpreter} onCheckedChange={(v) => { setCodeInterpreter(v); handleSave('code_interpreter_enabled', v); }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>File Search</Label>
                    <Switch checked={fileSearch} onCheckedChange={(v) => { setFileSearch(v); handleSave('file_search_enabled', v); }} />
                  </div>
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Re-instantiate for error state */}
      {isError && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button className="w-full" variant="outline" onClick={instantiate} disabled={isInstantiating}>
                {isInstantiating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Retry Instantiation
              </Button>
            </TooltipTrigger>
            <TooltipContent>Try to instantiate the assistant again</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {assistant.last_error && (
        <p className="text-sm text-destructive">Error: {assistant.last_error}</p>
      )}
    </div>
  );
};

export default AssistantPanel;
