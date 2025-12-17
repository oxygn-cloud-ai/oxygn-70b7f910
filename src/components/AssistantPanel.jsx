import React, { useState, useEffect } from 'react';
import { useAssistant } from '../hooks/useAssistant';
import { useAssistantFiles } from '../hooks/useAssistantFiles';
import { useAssistantToolDefaults } from '../hooks/useAssistantToolDefaults';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Bot, Trash2, Upload, RefreshCw, Play, X, FileText, Info, Loader2 } from 'lucide-react';

const AssistantPanel = ({ promptRowId, promptData }) => {
  const { assistant, isLoading, isInstantiating, createAssistant, updateAssistant, instantiate, destroy, sync } = useAssistant(promptRowId);
  const { files, isUploading, uploadFile, deleteFile } = useAssistantFiles(assistant?.row_id);
  const { defaults: toolDefaults } = useAssistantToolDefaults();

  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [useGlobalDefaults, setUseGlobalDefaults] = useState(true);
  const [codeInterpreter, setCodeInterpreter] = useState(true);
  const [fileSearch, setFileSearch] = useState(true);

  useEffect(() => {
    if (assistant) {
      setName(assistant.name || '');
      setInstructions(assistant.instructions || '');
      setUseGlobalDefaults(assistant.use_global_tool_defaults ?? true);
      setCodeInterpreter(assistant.code_interpreter_enabled ?? toolDefaults?.code_interpreter_enabled ?? true);
      setFileSearch(assistant.file_search_enabled ?? toolDefaults?.file_search_enabled ?? true);
    }
  }, [assistant, toolDefaults]);

  const handleCreateAssistant = async () => {
    await createAssistant({ name: promptData?.prompt_name || 'New Assistant' });
  };

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

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!assistant) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" /> Enable Assistant Mode</CardTitle>
          <CardDescription>Convert this prompt into an OpenAI Assistant with persistent context, file handling, and conversation threads.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleCreateAssistant}><Bot className="h-4 w-4 mr-2" /> Create Assistant</Button>
        </CardContent>
      </Card>
    );
  }

  const isActive = assistant.status === 'active';

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <span className="font-semibold">Assistant Configuration</span>
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? '● Active' : '○ Not Instantiated'}
          </Badge>
        </div>
        {isActive && (
          <Button variant="destructive" size="sm" onClick={destroy}><Trash2 className="h-4 w-4 mr-1" /> Destroy</Button>
        )}
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
              <Button variant="ghost" size="sm" onClick={sync} disabled={!isActive}><RefreshCw className="h-3 w-3" /></Button>
              <label>
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                <Button variant="ghost" size="sm" asChild disabled={isUploading}>
                  <span><Upload className="h-3 w-3" /></span>
                </Button>
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
                  <Button variant="ghost" size="sm" onClick={() => deleteFile(file.row_id)}><X className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          )}
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

      {/* Instantiate Button */}
      {!isActive && (
        <Button className="w-full" onClick={instantiate} disabled={isInstantiating}>
          {isInstantiating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          {isInstantiating ? 'Instantiating...' : 'Instantiate Assistant'}
        </Button>
      )}
      {assistant.last_error && <p className="text-sm text-destructive">Error: {assistant.last_error}</p>}
    </div>
  );
};

export default AssistantPanel;
