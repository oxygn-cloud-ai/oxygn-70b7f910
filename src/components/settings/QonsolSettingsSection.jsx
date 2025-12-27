import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, RotateCcw, Info } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from 'lucide-react';

const coreSettings = [
  { key: 'build', label: 'Build', type: 'text', description: 'Current build identifier' },
  { key: 'version', label: 'Version', type: 'text', description: 'Application version' },
];

// Default action system prompt
const DEFAULT_ACTION_SYSTEM_PROMPT = `You are an AI assistant that responds ONLY with valid JSON according to the provided schema.

CRITICAL INSTRUCTIONS:
1. Your response must be ONLY valid JSON - no markdown, no explanations, no additional text
2. Do not wrap your response in code blocks or backticks
3. Follow the exact schema structure provided
4. Include all required fields
5. Use appropriate data types as specified in the schema

{{schema_description}}

Respond with the JSON object now.`;

export function QonsolSettingsSection({
  settings,
  models,
  editedValues,
  isSaving,
  isRefreshing,
  onValueChange,
  onSave,
  onRefresh,
}) {
  const [isActionPromptOpen, setIsActionPromptOpen] = useState(false);

  const handleResetActionPrompt = () => {
    onValueChange('default_action_system_prompt', DEFAULT_ACTION_SYSTEM_PROMPT);
  };

  return (
    <div className="space-y-6">
        {/* Default Model Selection */}
        <div className="space-y-3 p-5 border border-outline-variant rounded-2xl bg-surface-container-low">
          <div className="flex items-center justify-between">
            <Label htmlFor="default_model" className="text-label-large font-medium text-on-surface">Default Model</Label>
            {editedValues['default_model'] !== undefined && 
             editedValues['default_model'] !== (settings['default_model']?.value || '') && (
              <Button
                size="icon"
                variant="ghost"
                className="bg-transparent h-8 w-8"
                onClick={() => onSave('default_model')}
                disabled={isSaving}
              >
                <Save className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Select
            value={editedValues['default_model'] !== undefined 
              ? editedValues['default_model'] 
              : (settings['default_model']?.value || '')}
            onValueChange={(value) => onValueChange('default_model', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select default model for prompts" />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.row_id} value={model.model_id}>
                  {model.model_name} ({model.provider})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-label-small text-on-surface-variant">Default model used for new prompts</p>
        </div>

        {/* Workbench Settings */}
        <div className="space-y-5 p-5 border border-outline-variant rounded-2xl bg-surface-container-low">
          <h3 className="text-title-small font-medium text-on-surface">Workbench Settings</h3>
          
          {/* Workbench Default Model */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="workbench_default_model">Workbench Model</Label>
              {editedValues['workbench_default_model'] !== undefined && 
               editedValues['workbench_default_model'] !== (settings['workbench_default_model']?.value || '') && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="bg-transparent h-8 w-8"
                  onClick={() => onSave('workbench_default_model')}
                  disabled={isSaving}
                >
                  <Save className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Select
              value={editedValues['workbench_default_model'] !== undefined 
                ? editedValues['workbench_default_model'] 
                : (settings['workbench_default_model']?.value || '')}
              onValueChange={(value) => onValueChange('workbench_default_model', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select default model for Workbench" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.row_id} value={model.model_id}>
                    {model.model_name} ({model.provider})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Default AI model for Workbench conversations</p>
          </div>

          {/* Workbench System Prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="workbench_system_prompt">System Prompt</Label>
              {editedValues['workbench_system_prompt'] !== undefined && 
               editedValues['workbench_system_prompt'] !== (settings['workbench_system_prompt']?.value || '') && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="bg-transparent h-8 w-8"
                  onClick={() => onSave('workbench_system_prompt')}
                  disabled={isSaving}
                >
                  <Save className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Textarea
              id="workbench_system_prompt"
              value={editedValues['workbench_system_prompt'] !== undefined 
                ? editedValues['workbench_system_prompt'] 
                : (settings['workbench_system_prompt']?.value || '')}
              onChange={(e) => onValueChange('workbench_system_prompt', e.target.value)}
              placeholder="Enter the system prompt for Workbench AI"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">System instructions for Workbench AI conversations</p>
          </div>
        </div>

        {/* Action Node System Prompt */}
        <Collapsible open={isActionPromptOpen} onOpenChange={setIsActionPromptOpen}>
          <div className="p-4 border rounded-lg">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">Action Node System Prompt</h3>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-xs">
                          This prompt is prepended to action node requests to instruct the AI 
                          to respond with valid JSON. Use <code>{'{{schema_description}}'}</code> to 
                          insert the schema details.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${isActionPromptOpen ? 'rotate-180' : ''}`} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="default_action_system_prompt" className="text-xs text-muted-foreground">
                  System prompt for action nodes
                </Label>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={handleResetActionPrompt}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                  {editedValues['default_action_system_prompt'] !== undefined && 
                   editedValues['default_action_system_prompt'] !== (settings['default_action_system_prompt']?.value || '') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7"
                      onClick={() => onSave('default_action_system_prompt')}
                      disabled={isSaving}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                  )}
                </div>
              </div>
              <Textarea
                id="default_action_system_prompt"
                value={editedValues['default_action_system_prompt'] !== undefined 
                  ? editedValues['default_action_system_prompt'] 
                  : (settings['default_action_system_prompt']?.value || DEFAULT_ACTION_SYSTEM_PROMPT)}
                onChange={(e) => onValueChange('default_action_system_prompt', e.target.value)}
                placeholder="Enter the system prompt for action nodes"
                className="font-mono text-xs"
                rows={10}
              />
              <p className="text-xs text-muted-foreground">
                Use <code className="bg-muted px-1 py-0.5 rounded">{'{{schema_description}}'}</code> to insert the JSON schema details.
              </p>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {coreSettings.map(({ key, label, type, description }) => {
          const settingData = settings[key];
          const currentValue = editedValues[key] !== undefined 
            ? editedValues[key] 
            : (settingData?.value || '');
          const originalValue = settingData?.value || '';
          const hasChanges = editedValues[key] !== undefined && editedValues[key] !== originalValue;

          return (
            <div key={key} className="space-y-2 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <Label htmlFor={key}>{label}</Label>
                {hasChanges && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="bg-transparent h-8 w-8"
                    onClick={() => onSave(key)}
                    disabled={isSaving}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Input
                id={key}
                value={currentValue}
                onChange={(e) => onValueChange(key, e.target.value)}
                placeholder={description}
              />
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          );
        })}
    </div>
  );
}
