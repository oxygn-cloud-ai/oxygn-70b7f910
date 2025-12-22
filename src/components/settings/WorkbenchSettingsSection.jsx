import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { MessagesSquare, RefreshCw, Save, Trash2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TOOLTIPS } from '@/config/labels';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from '@/hooks/useSettings';
import { useSupabase } from '@/hooks/useSupabase';
import { toast } from '@/components/ui/sonner';
import { LargeValueField } from "./LargeValueField";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function WorkbenchSettingsSection({
  isRefreshing,
  onRefresh,
}) {
  const supabase = useSupabase();
  const { settings, updateSetting } = useSettings(supabase);
  
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [confluenceEnabled, setConfluenceEnabled] = useState(false);
  const [maxContextMessages, setMaxContextMessages] = useState('50');
  const [isSaving, setIsSaving] = useState({});
  const [threadCount, setThreadCount] = useState(0);
  const [fileCount, setFileCount] = useState(0);
  
  useEffect(() => {
    if (settings?.workbench_default_system_prompt?.value !== undefined) {
      setDefaultSystemPrompt(settings.workbench_default_system_prompt.value);
    }
    if (settings?.workbench_default_model?.value !== undefined) {
      setDefaultModel(settings.workbench_default_model.value);
    } else {
      setDefaultModel('gpt-4o');
    }
    if (settings?.workbench_auto_save?.value !== undefined) {
      setAutoSaveEnabled(settings.workbench_auto_save.value === 'true');
    }
    if (settings?.workbench_confluence_enabled?.value !== undefined) {
      setConfluenceEnabled(settings.workbench_confluence_enabled.value === 'true');
    }
    if (settings?.workbench_max_context_messages?.value !== undefined) {
      setMaxContextMessages(settings.workbench_max_context_messages.value);
    }
  }, [settings]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!supabase) return;
      
      try {
        const { count: threads } = await supabase
          .from('q_workbench_threads')
          .select('*', { count: 'exact', head: true });
        
        const { count: files } = await supabase
          .from('q_workbench_files')
          .select('*', { count: 'exact', head: true });
        
        setThreadCount(threads || 0);
        setFileCount(files || 0);
      } catch (err) {
        console.error('Failed to fetch workbench stats:', err);
      }
    };
    
    fetchStats();
  }, [supabase, isRefreshing]);
  
  const handleSaveSetting = async (key, value) => {
    setIsSaving(prev => ({ ...prev, [key]: true }));
    try {
      await updateSetting(key, String(value));
      toast.success('Saved');
    } catch (err) {
      toast.error('Failed to save');
    } finally {
      setIsSaving(prev => ({ ...prev, [key]: false }));
    }
  };
  
  const handleToggleSetting = async (key, value, setter) => {
    setter(value);
    await handleSaveSetting(key, value);
  };

  const hasChanges = (key, currentValue) => {
    const originalValue = settings?.[key]?.value || '';
    return String(currentValue) !== originalValue;
  };

  const handleClearAllThreads = async () => {
    try {
      const { error } = await supabase
        .from('q_workbench_threads')
        .delete()
        .neq('row_id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      if (error) throw error;
      
      setThreadCount(0);
      toast.success('All workbench threads cleared');
    } catch (err) {
      console.error('Failed to clear threads:', err);
      toast.error('Failed to clear threads');
    }
  };

  const handleClearAllFiles = async () => {
    try {
      // First get all files to delete from storage
      const { data: files } = await supabase
        .from('q_workbench_files')
        .select('storage_path');
      
      if (files && files.length > 0) {
        // Delete from storage
        const paths = files.map(f => f.storage_path).filter(Boolean);
        if (paths.length > 0) {
          await supabase.storage.from('workbench-files').remove(paths);
        }
      }
      
      // Delete from database
      const { error } = await supabase
        .from('q_workbench_files')
        .delete()
        .neq('row_id', '00000000-0000-0000-0000-000000000000');
      
      if (error) throw error;
      
      setFileCount(0);
      toast.success('All workbench files cleared');
    } catch (err) {
      console.error('Failed to clear files:', err);
      toast.error('Failed to clear files');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessagesSquare className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Workbench Settings</h2>
            <p className="text-sm text-muted-foreground">Configure defaults and behavior for the Workbench</p>
          </div>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="bg-transparent"
                onClick={onRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{TOOLTIPS.actions.refresh}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="space-y-4">
        {/* Default System Prompt */}
        <div className="space-y-2 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <Label>Default System Prompt</Label>
            {hasChanges('workbench_default_system_prompt', defaultSystemPrompt) && (
              <Button
                size="icon"
                variant="ghost"
                className="bg-transparent h-8 w-8"
                onClick={() => handleSaveSetting('workbench_default_system_prompt', defaultSystemPrompt)}
                disabled={isSaving.workbench_default_system_prompt}
              >
                <Save className="h-4 w-4" />
              </Button>
            )}
          </div>
          <LargeValueField
            id="workbench_default_system_prompt"
            value={defaultSystemPrompt}
            onChange={setDefaultSystemPrompt}
            placeholder="You are a helpful assistant..."
            kind="textarea"
            rows={4}
            title="Default System Prompt"
            description="This system prompt is used for new Workbench conversations."
          />
          <p className="text-xs text-muted-foreground">
            Default system prompt for new Workbench conversations
          </p>
        </div>

        {/* Default Model */}
        <div className="space-y-2 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <Label>Default Model</Label>
            {hasChanges('workbench_default_model', defaultModel) && (
              <Button
                size="icon"
                variant="ghost"
                className="bg-transparent h-8 w-8"
                onClick={() => handleSaveSetting('workbench_default_model', defaultModel)}
                disabled={isSaving.workbench_default_model}
              >
                <Save className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Select value={defaultModel} onValueChange={setDefaultModel}>
            <SelectTrigger>
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
              <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
              <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
              <SelectItem value="gpt-4">GPT-4</SelectItem>
              <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
              <SelectItem value="o1">o1</SelectItem>
              <SelectItem value="o1-mini">o1 Mini</SelectItem>
              <SelectItem value="o3-mini">o3 Mini</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Default AI model for new Workbench conversations
          </p>
        </div>

        {/* Max Context Messages */}
        <div className="space-y-2 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <Label>Max Context Messages</Label>
            {hasChanges('workbench_max_context_messages', maxContextMessages) && (
              <Button
                size="icon"
                variant="ghost"
                className="bg-transparent h-8 w-8"
                onClick={() => handleSaveSetting('workbench_max_context_messages', maxContextMessages)}
                disabled={isSaving.workbench_max_context_messages}
              >
                <Save className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Input
            type="number"
            min="10"
            max="200"
            value={maxContextMessages}
            onChange={(e) => setMaxContextMessages(e.target.value)}
            placeholder="50"
          />
          <p className="text-xs text-muted-foreground">
            Maximum number of messages to include as context (10-200)
          </p>
        </div>

        {/* Feature Toggles */}
        <div className="space-y-3 p-4 border rounded-lg">
          <Label className="text-sm font-medium">Features</Label>
          <p className="text-xs text-muted-foreground -mt-1">
            Enable or disable Workbench features
          </p>
          
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Auto-save Conversations</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically save conversation progress
                </p>
              </div>
              <Switch
                checked={autoSaveEnabled}
                onCheckedChange={(checked) => handleToggleSetting('workbench_auto_save', checked, setAutoSaveEnabled)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Confluence Integration</Label>
                <p className="text-xs text-muted-foreground">
                  Enable Confluence page linking in Workbench
                </p>
              </div>
              <Switch
                checked={confluenceEnabled}
                onCheckedChange={(checked) => handleToggleSetting('workbench_confluence_enabled', checked, setConfluenceEnabled)}
              />
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="space-y-3 p-4 border rounded-lg">
          <Label className="text-sm font-medium">Data Management</Label>
          <p className="text-xs text-muted-foreground -mt-1">
            Manage your Workbench data
          </p>
          
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Threads</Label>
                <p className="text-xs text-muted-foreground">
                  {threadCount} conversation thread{threadCount !== 1 ? 's' : ''}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all threads?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all {threadCount} Workbench conversation threads and their messages. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearAllThreads}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Files</Label>
                <p className="text-xs text-muted-foreground">
                  {fileCount} uploaded file{fileCount !== 1 ? 's' : ''}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all files?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all {fileCount} uploaded files from the Workbench. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearAllFiles}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
