import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const coreSettings = [
  { key: 'build', label: 'Build', type: 'text', description: 'Current build identifier' },
  { key: 'version', label: 'Version', type: 'text', description: 'Application version' },
];

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
  return (
    <div className="space-y-4">
        {/* Default Model Selection */}
        <div className="space-y-2 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <Label htmlFor="default_model">Default Model</Label>
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
          <p className="text-xs text-muted-foreground">Default model used for new prompts</p>
        </div>

        {/* Workbench Settings */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="text-sm font-medium">Workbench Settings</h3>
          
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
