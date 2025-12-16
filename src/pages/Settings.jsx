import React, { useEffect, useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useSupabase } from '../hooks/useSupabase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save, Settings as SettingsIcon, Server, Key, RefreshCw } from 'lucide-react';
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

const MAX_SETTING_VALUE_LENGTH = 2000;
const MAX_SETTING_DESC_LENGTH = 500;
const SETTING_KEY_REGEX = /^[a-zA-Z0-9_:\-]{1,64}$/;

const Settings = () => {
  const supabase = useSupabase();
  const { settings, updateSetting, addSetting, deleteSetting, isLoading, error, refetch } = useSettings(supabase);
  const [editedValues, setEditedValues] = useState({});
  const [newSettingKey, setNewSettingKey] = useState('');
  const [newSettingValue, setNewSettingValue] = useState('');
  const [newSettingDesc, setNewSettingDesc] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Useful when database values change outside this page (e.g. seeded via backend tools)
    const onFocus = () => {
      refetch?.();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetch]);

  if (isLoading || !supabase) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-destructive">Error loading settings: {error.message}</div>
      </div>
    );
  }

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success('Settings refreshed');
    } catch (err) {
      toast.error('Failed to refresh settings');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleValueChange = (key, value) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (key) => {
    const nextValue = editedValues[key];
    if (nextValue === undefined) return;

    if (String(nextValue).length > MAX_SETTING_VALUE_LENGTH) {
      toast.error(`Value is too long (max ${MAX_SETTING_VALUE_LENGTH} characters)`);
      return;
    }

    setIsSaving(true);
    try {
      await updateSetting(key, nextValue);
      setEditedValues(prev => {
        const newValues = { ...prev };
        delete newValues[key];
        return newValues;
      });
      toast.success(`Setting "${key}" saved`);
    } catch (err) {
      toast.error('Failed to save setting');
    } finally {
      setIsSaving(false);
    }
  };

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
      await addSetting(key, newSettingValue, newSettingDesc);
      setNewSettingKey('');
      setNewSettingValue('');
      setNewSettingDesc('');
      setIsAddDialogOpen(false);
      toast.success('Setting added successfully');
    } catch (err) {
      toast.error('Failed to add setting');
    }
  };

  const handleDeleteSetting = async (key) => {
    try {
      await deleteSetting(key);
      toast.success(`Setting "${key}" deleted`);
    } catch (err) {
      toast.error('Failed to delete setting');
    }
  };

  // Core settings that should always be available
  const coreSettings = [
    { key: 'build', label: 'Build', type: 'text', description: 'Current build identifier' },
    { key: 'version', label: 'Version', type: 'text', description: 'Application version' },
    { key: 'def_admin_prompt', label: 'Default Admin Prompt', type: 'textarea', description: 'Default system prompt for new prompts' },
  ];

  const envVariables = {
    'Debug Mode': import.meta.env.VITE_DEBUG,
    'Backend URL': import.meta.env.VITE_SUPABASE_URL,
    'Prompts Table': import.meta.env.VITE_PROMPTS_TBL,
    'Settings Table': import.meta.env.VITE_SETTINGS_TBL,
    'Models Table': import.meta.env.VITE_MODELS_TBL,
  };

  const settingsArray = Object.entries(settings);

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage application configuration</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Core Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Core Settings
          </CardTitle>
          <CardDescription>Essential application configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {coreSettings.map(({ key, label, type, description }) => {
            const settingData = settings[key];
            const currentValue = editedValues[key] !== undefined 
              ? editedValues[key] 
              : (settingData?.value || '');
            const originalValue = settingData?.value || '';
            const hasChanges = editedValues[key] !== undefined && editedValues[key] !== originalValue;

            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={key}>{label}</Label>
                  {hasChanges && (
                    <Button
                      size="sm"
                      onClick={() => handleSave(key)}
                      disabled={isSaving}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  )}
                </div>
                {type === 'textarea' ? (
                  <Textarea
                    id={key}
                    value={currentValue}
                    onChange={(e) => handleValueChange(key, e.target.value)}
                    placeholder={description}
                    rows={4}
                  />
                ) : (
                  <Input
                    id={key}
                    value={currentValue}
                    onChange={(e) => handleValueChange(key, e.target.value)}
                    placeholder={description}
                  />
                )}
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

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
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Setting
              </Button>
            </DialogTrigger>
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
              No settings configured yet. Click "Add Setting" to create one.
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
                        <Input
                          value={currentValue}
                          onChange={(e) => handleValueChange(key, e.target.value)}
                          className="max-w-md"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {hasChanges && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleSave(key)}
                              disabled={isSaving}
                            >
                              <Save className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteSetting(key)}
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
};

export default Settings;
