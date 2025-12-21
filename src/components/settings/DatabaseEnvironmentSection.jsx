import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Database, Key, Server, Plus, Trash2, Save, RefreshCw } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LargeValueField } from "./LargeValueField";

const MAX_SETTING_VALUE_LENGTH = 500000;
const MAX_SETTING_DESC_LENGTH = 500;
const SETTING_KEY_REGEX = /^[a-zA-Z0-9_:\-]{1,64}$/;

// Keys that should always be masked (never displayed)
const SENSITIVE_KEYS = ['api_key', 'api_token', 'secret', 'password', 'credential'];

const isSensitiveKey = (key) => {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive));
};

const envVariables = {
  'Debug Mode': import.meta.env.VITE_DEBUG,
  'Backend URL': import.meta.env.VITE_SUPABASE_URL,
  'Prompts Table': import.meta.env.VITE_PROMPTS_TBL,
  'Settings Table': import.meta.env.VITE_SETTINGS_TBL,
  'Models Table': import.meta.env.VITE_MODELS_TBL,
};

export function DatabaseEnvironmentSection({
  settings,
  editedValues,
  isSaving,
  isRefreshing,
  onValueChange,
  onSave,
  onAddSetting,
  onDeleteSetting,
  onRefresh,
}) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newSettingKey, setNewSettingKey] = useState('');
  const [newSettingValue, setNewSettingValue] = useState('');
  const [newSettingDesc, setNewSettingDesc] = useState('');

  const settingsArray = Object.entries(settings);

  const handleAddSetting = async () => {
    const key = newSettingKey.trim();

    if (!key) {
      toast.error('Setting key is required');
      return;
    }

    if (!SETTING_KEY_REGEX.test(key)) {
      toast.error('Key must be 1-64 chars: letters, numbers, _, -, :');
      return;
    }

    if (newSettingValue.length > MAX_SETTING_VALUE_LENGTH) {
      toast.error(`Value is too long (max ${MAX_SETTING_VALUE_LENGTH} characters)`);
      return;
    }

    if (newSettingDesc.length > MAX_SETTING_DESC_LENGTH) {
      toast.error(`Description is too long (max ${MAX_SETTING_DESC_LENGTH} characters)`);
      return;
    }

    try {
      await onAddSetting(key, newSettingValue, newSettingDesc);
      setNewSettingKey('');
      setNewSettingValue('');
      setNewSettingDesc('');
      setIsAddDialogOpen(false);
      toast.success('Setting added successfully');
    } catch (err) {
      toast.error('Failed to add setting');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Database & Environment</h2>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
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

      {/* Database Settings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Database Settings
            </CardTitle>
            <CardDescription>Key-value configuration stored in the database</CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Add Setting</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Setting</DialogTitle>
                <DialogDescription>Create a new configuration setting</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="key">Setting Key</Label>
                  <Input
                    id="key"
                    placeholder="e.g., api_timeout"
                    value={newSettingKey}
                    onChange={(e) => setNewSettingKey(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="value">Value</Label>
                  <Input
                    id="value"
                    placeholder="e.g., 30000"
                    value={newSettingValue}
                    onChange={(e) => setNewSettingValue(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="What this setting controls..."
                    value={newSettingDesc}
                    onChange={(e) => setNewSettingDesc(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddSetting}>Add Setting</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {settingsArray.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No settings configured yet. Click the + button to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settingsArray.map(([key, data]) => {
                  const currentValue = editedValues[key] !== undefined ? editedValues[key] : data.value;
                  const hasChanges = editedValues[key] !== undefined && editedValues[key] !== data.value;
                  
                  return (
                    <TableRow key={key}>
                      <TableCell className="font-medium">
                        <div>
                          {key}
                          {data.description && (
                            <p className="text-xs text-muted-foreground mt-1">{data.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isSensitiveKey(key) ? (
                          <Input
                            type="password"
                            value={currentValue}
                            onChange={(e) => onValueChange(key, e.target.value)}
                            className="max-w-md"
                            placeholder={data.value ? '••••••••••••••••' : 'Enter value'}
                          />
                        ) : (
                          <LargeValueField
                            id={key}
                            kind="text"
                            value={currentValue}
                            onChange={(val) => onValueChange(key, val)}
                            placeholder=""
                            title={`Edit ${key}`}
                            description={data.description || undefined}
                            thresholdChars={8000}
                            previewChars={200}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {hasChanges && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => onSave(key)}
                              disabled={isSaving}
                            >
                              <Save className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => onDeleteSetting(key)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Environment Variables */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Environment Variables
          </CardTitle>
          <CardDescription>Read-only configuration from environment</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Variable</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(envVariables).map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell className="font-medium">{key}</TableCell>
                  <TableCell>
                    <code className="px-2 py-1 bg-muted rounded text-sm">
                      {value || 'Not set'}
                    </code>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
