import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, RefreshCw, Save } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Qonsol Settings</h2>
            <p className="text-sm text-muted-foreground">Essential application configuration</p>
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
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

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
    </div>
  );
}
