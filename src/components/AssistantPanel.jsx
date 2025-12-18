import React, { useState, useEffect } from 'react';
import { useAssistant } from '../hooks/useAssistant';
import { useAssistantFiles } from '../hooks/useAssistantFiles';
import { useAssistantToolDefaults } from '../hooks/useAssistantToolDefaults';
import { useOpenAIModels } from '../hooks/useOpenAIModels';
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
import { Bot, Trash2, Upload, RefreshCw, Power, X, FileText, Info, Loader2 } from 'lucide-react';

const AssistantPanel = ({ promptRowId, selectedItemData }) => {
  const { assistant, isLoading, isInstantiating, updateAssistant, instantiate, destroy, sync, reInstantiate } = useAssistant(promptRowId);
  const { files, isUploading, uploadFile, deleteFile } = useAssistantFiles(assistant?.row_id);
  const { defaults: toolDefaults } = useAssistantToolDefaults();
  const { models } = useOpenAIModels();

  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [useGlobalDefaults, setUseGlobalDefaults] = useState(true);
  const [codeInterpreter, setCodeInterpreter] = useState(true);
  const [fileSearch, setFileSearch] = useState(true);
  const [modelOverride, setModelOverride] = useState('');
  const [temperature, setTemperature] = useState('');
  const [maxTokens, setMaxTokens] = useState('');
  const [topP, setTopP] = useState('');

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

  // Assistant should always exist for top-level prompts now
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
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={handleReInstantiate}
                    disabled={isInstantiating}
                  >
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

      {/* Model Settings */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Model Settings</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Model Override</Label>
            <Select value={modelOverride || 'inherit'} onValueChange={(v) => { const val = v === 'inherit' ? '' : v; setModelOverride(val); handleSave('model_override', val || null); }}>
              <SelectTrigger><SelectValue placeholder="Inherit from prompt" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">Inherit from prompt</SelectItem>
                {models?.map(m => <SelectItem key={m.model_id} value={m.model_id}>{m.model_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Temperature</Label>
              <span className="text-xs text-muted-foreground">{temperature || 'Default'}</span>
            </div>
            <Slider 
              value={[parseFloat(temperature) || 1]} 
              min={0} max={2} step={0.1} 
              onValueChange={([v]) => setTemperature(v.toString())}
              onValueCommit={([v]) => handleSave('temperature_override', v.toString())}
            />
          </div>
          <div>
            <Label>Max Tokens</Label>
            <Input 
              type="number" 
              value={maxTokens} 
              onChange={(e) => setMaxTokens(e.target.value)} 
              onBlur={() => handleSave('max_tokens_override', maxTokens || null)} 
              placeholder="Default"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Top P</Label>
              <span className="text-xs text-muted-foreground">{topP || 'Default'}</span>
            </div>
            <Slider 
              value={[parseFloat(topP) || 1]} 
              min={0} max={1} step={0.05} 
              onValueChange={([v]) => setTopP(v.toString())}
              onValueCommit={([v]) => handleSave('top_p_override', v.toString())}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tools */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Tools & Capabilities</CardTitle></CardHeader>
        <CardContent className="space-y-3">
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
      </Card>

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