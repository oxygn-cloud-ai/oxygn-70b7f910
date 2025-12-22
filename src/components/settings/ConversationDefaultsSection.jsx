import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Save } from 'lucide-react';
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
import { LargeValueField } from "./LargeValueField";

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
  const [defAdminPrompt, setDefAdminPrompt] = useState('');
  const [defAssistantInstructions, setDefAssistantInstructions] = useState('');
  const [isSaving, setIsSaving] = useState({});
  
  useEffect(() => {
    if (settings?.cascade_empty_prompt_fallback?.value) {
      setCascadeFallback(settings.cascade_empty_prompt_fallback.value);
    } else {
      setCascadeFallback('Execute this prompt');
    }
    if (settings?.def_admin_prompt?.value !== undefined) {
      setDefAdminPrompt(settings.def_admin_prompt.value);
    }
    if (settings?.def_assistant_instructions?.value !== undefined) {
      setDefAssistantInstructions(settings.def_assistant_instructions.value);
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
  
  const handleSaveSetting = async (key, value) => {
    if (!value?.trim()) {
      toast.error('Value cannot be empty');
      return;
    }
    setIsSaving(prev => ({ ...prev, [key]: true }));
    try {
      await updateSetting(key, value.trim());
      toast.success('Saved');
    } catch (err) {
      toast.error('Failed to save');
    } finally {
      setIsSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const hasChanges = (key, currentValue) => {
    const originalValue = settings?.[key]?.value || '';
    return currentValue !== originalValue;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-muted-foreground">Loading conversation defaults...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
        {/* Default Context Prompt */}
        <div className="space-y-2 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <Label>Default Context Prompt</Label>
            {hasChanges('def_admin_prompt', defAdminPrompt) && (
              <Button
                size="icon"
                variant="ghost"
                className="bg-transparent h-8 w-8"
                onClick={() => handleSaveSetting('def_admin_prompt', defAdminPrompt)}
                disabled={isSaving.def_admin_prompt}
              >
                <Save className="h-4 w-4" />
              </Button>
            )}
          </div>
          <LargeValueField
            id="def_admin_prompt"
            value={defAdminPrompt}
            onChange={setDefAdminPrompt}
            placeholder="Default context/system prompt for new prompts"
            kind="textarea"
            rows={4}
            title="Default Context Prompt"
            description="This value is used as the default Context Prompt for new prompts."
          />
          <p className="text-xs text-muted-foreground">
            Default context/system prompt for new prompts
          </p>
        </div>

        {/* Default System Instructions */}
        <div className="space-y-2 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <Label>Default System Instructions</Label>
            {hasChanges('def_assistant_instructions', defAssistantInstructions) && (
              <Button
                size="icon"
                variant="ghost"
                className="bg-transparent h-8 w-8"
                onClick={() => handleSaveSetting('def_assistant_instructions', defAssistantInstructions)}
                disabled={isSaving.def_assistant_instructions}
              >
                <Save className="h-4 w-4" />
              </Button>
            )}
          </div>
          <LargeValueField
            id="def_assistant_instructions"
            value={defAssistantInstructions}
            onChange={setDefAssistantInstructions}
            placeholder="Default instructions for new top-level conversations"
            kind="textarea"
            rows={4}
            title="Default System Instructions"
            description="This value is used as the default System Instructions for new top-level conversations."
          />
          <p className="text-xs text-muted-foreground">
            Default instructions for new top-level conversations
          </p>
        </div>

        {/* Default Tools */}
        <div className="space-y-3 p-4 border rounded-lg">
          <Label className="text-sm font-medium">Default Tools</Label>
          <p className="text-xs text-muted-foreground -mt-1">
            Default tools enabled for new conversations
          </p>
          
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Code Interpreter</Label>
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
                <Label className="text-sm">File Search</Label>
                <p className="text-xs text-muted-foreground">
                  Enables searching through uploaded files
                </p>
              </div>
              <Switch
                checked={uiDefaults.file_search_enabled}
                onCheckedChange={(checked) => handleToggle('file_search_enabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Function Calling</Label>
                <p className="text-xs text-muted-foreground">
                  Allows defining custom functions for the AI
                </p>
              </div>
              <Switch
                checked={uiDefaults.function_calling_enabled}
                onCheckedChange={(checked) => handleToggle('function_calling_enabled', checked)}
              />
            </div>
          </div>
        </div>

        {/* Default Thread Mode */}
        <div className="space-y-2 p-4 border rounded-lg">
          <Label>Default Thread Mode</Label>
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
          <p className="text-xs text-muted-foreground">
            Default thread behavior for new child prompts
          </p>
        </div>

        {/* Cascade Empty Prompt Fallback */}
        <div className="space-y-2 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <Label>Empty Prompt Fallback Message</Label>
            {hasChanges('cascade_empty_prompt_fallback', cascadeFallback) && (
              <Button
                size="icon"
                variant="ghost"
                className="bg-transparent h-8 w-8"
                onClick={() => handleSaveSetting('cascade_empty_prompt_fallback', cascadeFallback)}
                disabled={isSaving.cascade_empty_prompt_fallback}
              >
                <Save className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Input
            value={cascadeFallback}
            onChange={(e) => setCascadeFallback(e.target.value)}
            placeholder="Execute this prompt"
          />
          <p className="text-xs text-muted-foreground">
            Message sent to AI when a prompt has no user or admin content
          </p>
        </div>
      </div>
    </div>
  );
}
