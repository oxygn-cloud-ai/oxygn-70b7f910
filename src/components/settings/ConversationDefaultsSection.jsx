import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Bot, RefreshCw, Save } from 'lucide-react';
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
import { useConversationToolDefaults } from '@/hooks/useConversationToolDefaults';
import { useSettings } from '@/hooks/useSettings';
import { useSupabase } from '@/hooks/useSupabase';
import { toast } from '@/components/ui/sonner';

export function ConversationDefaultsSection({
  isRefreshing,
  onRefresh,
}) {
  const supabase = useSupabase();
  const {
    defaults: toolDefaults,
    isLoading,
    updateDefaults: updateToolDefault,
    refetch,
  } = useConversationToolDefaults();
  
  const { settings, updateSetting } = useSettings(supabase);

  const [uiDefaults, setUiDefaults] = useState({
    code_interpreter_enabled: toolDefaults?.code_interpreter_enabled ?? false,
    file_search_enabled: toolDefaults?.file_search_enabled ?? true,
    function_calling_enabled: toolDefaults?.function_calling_enabled ?? false,
  });
  
  const [cascadeFallback, setCascadeFallback] = useState('');
  const [isSavingFallback, setIsSavingFallback] = useState(false);
  
  // Initialize cascade fallback from settings
  useEffect(() => {
    if (settings?.cascade_empty_prompt_fallback?.value) {
      setCascadeFallback(settings.cascade_empty_prompt_fallback.value);
    } else {
      setCascadeFallback('Execute this prompt');
    }
  }, [settings]);

  useEffect(() => {
    if (toolDefaults) {
      setUiDefaults({
        code_interpreter_enabled: toolDefaults.code_interpreter_enabled ?? false,
        file_search_enabled: toolDefaults.file_search_enabled ?? true,
        function_calling_enabled: toolDefaults.function_calling_enabled ?? false,
      });
    }
  }, [toolDefaults]);

  useEffect(() => {
    if (isRefreshing) {
      refetch();
    }
  }, [isRefreshing, refetch]);

  const handleToggle = async (key, value) => {
    setUiDefaults(prev => ({ ...prev, [key]: value }));
    const ok = await updateToolDefault({ [key]: value });
    if (!ok) {
      setUiDefaults(prev => ({ ...prev, [key]: toolDefaults?.[key] ?? prev[key] }));
    }
  };
  
  const handleSaveCascadeFallback = async () => {
    if (!cascadeFallback.trim()) {
      toast.error('Fallback message cannot be empty');
      return;
    }
    setIsSavingFallback(true);
    try {
      await updateSetting('cascade_empty_prompt_fallback', cascadeFallback.trim());
      toast.success('Cascade fallback saved');
    } catch (err) {
      toast.error('Failed to save cascade fallback');
    } finally {
      setIsSavingFallback(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-muted-foreground">Loading conversation defaults...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Conversation Defaults</h2>
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

      <Card>
        <CardHeader>
          <CardTitle>Default Tool Settings</CardTitle>
          <CardDescription>
            Default tools enabled for new conversations. Individual conversations can override these settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Code Interpreter</Label>
              <p className="text-xs text-muted-foreground">
                Allows the AI to write and run Python code
              </p>
            </div>
            <Switch
              checked={uiDefaults.code_interpreter_enabled}
              onCheckedChange={(checked) => handleToggle('code_interpreter_enabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>File Search</Label>
              <p className="text-xs text-muted-foreground">
                Enables searching through uploaded files using vector stores
              </p>
            </div>
            <Switch
              checked={uiDefaults.file_search_enabled}
              onCheckedChange={(checked) => handleToggle('file_search_enabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Function Calling</Label>
              <p className="text-xs text-muted-foreground">
                Allows defining custom functions for the AI to call
              </p>
            </div>
            <Switch
              checked={uiDefaults.function_calling_enabled}
              onCheckedChange={(checked) => handleToggle('function_calling_enabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default Thread Mode</CardTitle>
          <CardDescription>
            Default thread behavior for new child prompts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select defaultValue="new">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">
                New Thread - Create fresh conversation for each execution
              </SelectItem>
              <SelectItem value="reuse">
                Reuse Thread - Maintain conversation history
              </SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cascade Settings</CardTitle>
          <CardDescription>
            Configure how cascade runs handle prompts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Empty Prompt Fallback Message</Label>
            <p className="text-xs text-muted-foreground">
              Message sent to AI when a prompt has no user or admin content
            </p>
            <div className="flex gap-2">
              <Input
                value={cascadeFallback}
                onChange={(e) => setCascadeFallback(e.target.value)}
                placeholder="Execute this prompt"
                className="flex-1"
              />
              <Button
                onClick={handleSaveCascadeFallback}
                disabled={isSavingFallback}
                size="sm"
              >
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
