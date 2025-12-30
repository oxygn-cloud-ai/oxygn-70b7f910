import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useConversation } from '../../hooks/useConversation';
import { useConversationFiles } from '../../hooks/useConversationFiles';
import { useConversationToolDefaults } from '../../hooks/useConversationToolDefaults';
import { toast } from '@/components/ui/sonner';
import { useOpenAIModels } from '../../hooks/useOpenAIModels';
import { useSettings } from '../../hooks/useSettings';
import { useSupabase } from '../../hooks/useSupabase';
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
import { Bot, Upload, RefreshCw, X, FileText, Info, Loader2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { ALL_SETTINGS } from '../../config/modelCapabilities';
import { useModels } from '../../hooks/useModels';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ConfluencePagesSection from '../ConfluencePagesSection';

const ConversationTab = ({ promptRowId, selectedItemData }) => {
  const supabase = useSupabase();
  const { conversation, isLoading, updateConversation } = useConversation(promptRowId);
  const { files, isUploading, isSyncing, uploadFile, deleteFile, syncFiles } = useConversationFiles(conversation?.row_id);
  const { defaults: toolDefaults } = useConversationToolDefaults();
  const { models } = useOpenAIModels();
  const { settings } = useSettings(supabase);
  const { isSettingSupported } = useModels();

  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [useGlobalDefaults, setUseGlobalDefaults] = useState(true);
  const [codeInterpreter, setCodeInterpreter] = useState(true);
  const [fileSearch, setFileSearch] = useState(true);
  const [confluenceEnabled, setConfluenceEnabled] = useState(false);
  const [modelOverride, setModelOverride] = useState('');
  const [temperature, setTemperature] = useState('');
  const [maxTokens, setMaxTokens] = useState('');
  const [topP, setTopP] = useState('');
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [childDefaultsOpen, setChildDefaultsOpen] = useState(false);
  const [defaultChildThreadStrategy, setDefaultChildThreadStrategy] = useState('isolated');
  const lastErrorShown = useRef(null);

  // Get default model from global settings
  const defaultModel = useMemo(() => {
    return settings?.default_model?.value || models?.[0]?.model_id || '';
  }, [settings, models]);

  // Get current effective model
  const currentModel = modelOverride || selectedItemData?.model || defaultModel;
  const currentModelData = models?.find(m => m.model_id === currentModel || m.model_name === currentModel);

  useEffect(() => {
    if (conversation) {
      setName(conversation.name || '');
      setInstructions(conversation.instructions || '');
      setUseGlobalDefaults(conversation.use_global_tool_defaults ?? true);
      setCodeInterpreter(conversation.code_interpreter_enabled ?? toolDefaults?.code_interpreter_enabled ?? false);
      setFileSearch(conversation.file_search_enabled ?? toolDefaults?.file_search_enabled ?? true);
      setConfluenceEnabled(conversation.confluence_enabled ?? false);
      setModelOverride(conversation.model_override || '');
      setTemperature(conversation.temperature_override || '');
      setMaxTokens(conversation.max_tokens_override || '');
      setTopP(conversation.top_p_override || '');
    }
  }, [conversation, toolDefaults]);

  // Show last_error as toast when it changes
  useEffect(() => {
    if (conversation?.last_error && conversation.last_error !== lastErrorShown.current) {
      toast.error(conversation.last_error);
      lastErrorShown.current = conversation.last_error;
    }
  }, [conversation?.last_error]);

  // Load parent prompt's default child thread strategy
  useEffect(() => {
    if (selectedItemData?.default_child_thread_strategy) {
      setDefaultChildThreadStrategy(selectedItemData.default_child_thread_strategy);
    }
  }, [selectedItemData?.default_child_thread_strategy]);

  // Save parent prompt field (not assistant field)
  const handleParentPromptSave = async (field, value) => {
    if (!supabase || !promptRowId) return;
    try {
      await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ [field]: value })
        .eq('row_id', promptRowId);
    } catch (error) {
      console.error('Error saving parent prompt field:', error);
      toast.error('Failed to save setting');
    }
  };

  const handleSave = async (field, value) => {
    await updateConversation({ [field]: value });
  };

  const handleFileUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      await uploadFile(selectedFiles);
      e.target.value = '';
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-muted-foreground">
          <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Loading assistant configuration...</p>
        </div>
      </div>
    );
  }

  // Responses API assistants are always active
  const isActive = true;

  // Debounce refs for slider values
  const sliderDebounceRef = useRef({});

  const SettingRow = ({ field, value, setValue, onSave, type = 'input', min, max, step }) => {
    const settingInfo = ALL_SETTINGS[field];
    const supported = isSettingSupported(field, currentModel);
    
    if (!settingInfo) return null;

    // Debounced slider change handler
    const handleSliderChange = ([v]) => {
      setValue(v.toString());
      
      // Clear existing debounce timer
      if (sliderDebounceRef.current[field]) {
        clearTimeout(sliderDebounceRef.current[field]);
      }
      
      // Set new debounce timer (500ms delay)
      sliderDebounceRef.current[field] = setTimeout(() => {
        onSave(v.toString());
      }, 500);
    };

    return (
      <div className={`${!supported ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <Label className="text-xs">{settingInfo.label}</Label>
            {(settingInfo.details || settingInfo.docUrl) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground">
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-1">
                      <h4 className="font-medium text-xs">{settingInfo.label}</h4>
                      {settingInfo.details && <p className="text-[10px] text-muted-foreground">{settingInfo.details}</p>}
                      {settingInfo.docUrl && (
                        <a href={settingInfo.docUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                          Documentation <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {type === 'slider' && <span className="text-xs text-muted-foreground">{value || 'Default'}</span>}
        </div>
        {!supported ? (
          <p className="text-xs text-muted-foreground italic">Not supported by this model</p>
        ) : type === 'slider' ? (
          <Slider
            value={[parseFloat(value) || (field === 'top_p' ? 1 : field === 'temperature' ? 1 : 0)]}
            min={min} max={max} step={step}
            onValueChange={handleSliderChange}
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
    <div className="space-y-4 p-4 h-full overflow-auto scrollbar-thin">
      {/* Status Header */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <span className="font-semibold text-foreground">Conversation Configuration</span>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="success">● Ready</Badge>
              {currentModelData && (
                <span className="text-xs text-muted-foreground">{currentModelData.model_name}</span>
              )}
            </div>
          </div>
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
              System Instructions
              <TooltipProvider><Tooltip><TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs"><p>Global personality and behavior for this conversation. Applied to ALL child prompts as the first system message.</p></TooltipContent>
              </Tooltip></TooltipProvider>
            </Label>
            <p className="text-xs text-muted-foreground mb-1.5">Use template variables like {'{{input_admin_prompt}}'} to inject prompt field values.</p>
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} onBlur={() => handleSave('instructions', instructions)} placeholder={settings?.def_assistant_instructions || undefined} rows={4} />
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
                    <Button variant="ghost" size="icon" className="h-7 w-7 !text-muted-foreground hover:!text-foreground hover:!bg-sidebar-accent" onClick={syncFiles} disabled={!isActive || isSyncing}>
                      <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Sync Files to Vector Store</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <label>
                <input type="file" multiple className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 !text-muted-foreground hover:!text-foreground hover:!bg-sidebar-accent" asChild disabled={isUploading}>
                        <span><Upload className="h-3 w-3" /></span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Upload Files</TooltipContent>
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
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="h-3 w-3 flex-shrink-0" />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="truncate cursor-help">{file.original_filename}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="text-xs space-y-1">
                            <div><strong>Local:</strong> {file.original_filename}</div>
                            {file.openai_file_id ? (
                              <div><strong>File ID:</strong> {file.openai_file_id}</div>
                            ) : (
                              <div className="text-muted-foreground">Not yet uploaded to vector store</div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Badge variant={file.upload_status === 'uploaded' ? 'default' : file.upload_status === 'error' ? 'destructive' : 'secondary'} className="text-[10px] px-1 py-0 h-4">
                      {file.upload_status === 'uploaded' ? '✓' : file.upload_status === 'error' ? '✕' : '○'}
                    </Badge>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0 !text-muted-foreground hover:!text-foreground hover:!bg-sidebar-accent" onClick={() => deleteFile(file.row_id)}>
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

      {/* Confluence Pages */}
      <ConfluencePagesSection 
        assistantRowId={conversation?.row_id}
      />

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

      {/* Child Prompt Defaults - Collapsible */}
      <Collapsible open={childDefaultsOpen} onOpenChange={setChildDefaultsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Child Prompt Defaults</CardTitle>
                {childDefaultsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-3 pt-0">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Label className="text-xs">Default Thread Strategy</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-4 w-4 !text-muted-foreground hover:!text-foreground hover:!bg-sidebar-accent">
                        <Info className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 bg-popover" side="top">
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Thread Strategy</h4>
                        <p className="text-xs text-muted-foreground">
                          <strong>Parent Thread:</strong> Child prompt executions use the parent assistant's Studio thread, maintaining shared conversation history.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <strong>Isolated Thread:</strong> Each child prompt has its own thread(s), keeping conversations separate.
                        </p>
                        <p className="text-xs text-muted-foreground italic">This sets the default for new child prompts. Each child can override this setting.</p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <Select 
                  value={defaultChildThreadStrategy} 
                  onValueChange={(v) => { 
                    setDefaultChildThreadStrategy(v); 
                    handleParentPromptSave('default_child_thread_strategy', v); 
                  }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="parent">Use Parent Thread</SelectItem>
                    <SelectItem value="isolated">Isolated Threads</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {defaultChildThreadStrategy === 'parent' 
                    ? 'New child prompts will share the parent Studio thread' 
                    : 'New child prompts will have their own isolated threads'}
                </p>
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
              <div className="border-t pt-3 mt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Label>Confluence Live Browsing</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-4 w-4 !text-muted-foreground hover:!text-foreground hover:!bg-sidebar-accent">
                          <Info className="h-3 w-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 bg-popover" side="top">
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Confluence Live Browsing</h4>
                          <p className="text-xs text-muted-foreground">
                            When enabled, the assistant can search, read, and navigate Confluence pages during conversations. 
                            This allows real-time access to your team's documentation.
                          </p>
                          <p className="text-xs text-muted-foreground italic">
                            Requires Confluence credentials in Settings.
                          </p>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Switch 
                    checked={confluenceEnabled} 
                    onCheckedChange={async (v) => { 
                      setConfluenceEnabled(v); 
                      await handleSave('confluence_enabled', v);
                    }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {confluenceEnabled 
                    ? 'Assistant can search and read Confluence pages live' 
                    : 'Attached pages are used as static context only'}
                </p>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

    </div>
  );
};

export default ConversationTab;
