import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Database, Key, Server, Plus, Trash2, Save, RefreshCw, ShieldCheck, Edit } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
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
import { getEnv } from '@/utils/safeEnv';

const MAX_SETTING_VALUE_LENGTH = 500000;
const MAX_SETTING_DESC_LENGTH = 500;
const SETTING_KEY_REGEX = /^[a-zA-Z0-9_:\-]{1,64}$/;

// Keys that should always be masked (never displayed)
const SENSITIVE_KEYS = ['api_key', 'api_token', 'secret', 'password', 'credential'];

// Environment variable keys that should be masked
const SENSITIVE_ENV_PATTERNS = ['KEY', 'SECRET', 'TOKEN', 'PASSWORD', 'CREDENTIAL'];

// Keys managed in QonsolSettingsSection - hide from generic Database Settings list
const QONSOL_MANAGED_KEYS = ['build', 'version', 'def_admin_prompt', 'def_assistant_instructions', 'default_model'];

const isSensitiveKey = (key) => {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive));
};

const isSensitiveEnvKey = (key) => {
  const upperKey = key.toUpperCase();
  return SENSITIVE_ENV_PATTERNS.some(pattern => upperKey.includes(pattern));
};

const maskValue = (value) => {
  if (!value || value === 'Not set') return value;
  if (value.length <= 8) return '••••••••';
  return value.substring(0, 4) + '••••••••' + value.substring(value.length - 4);
};

const isQonsolManagedKey = (key) => QONSOL_MANAGED_KEYS.includes(key);

// Environment variable keys - values are fetched safely inside component
const ENV_VAR_KEYS = [
  { label: 'Debug Mode', key: 'VITE_DEBUG' },
  { label: 'Backend URL', key: 'VITE_SUPABASE_URL' },
  { label: 'Project ID', key: 'VITE_SUPABASE_PROJECT_ID' },
  { label: 'Project URL', key: 'VITE_SUPABASE_PROJECT_URL' },
  { label: 'Publishable Key', key: 'VITE_SUPABASE_PUBLISHABLE_KEY' },
  { label: 'API Key', key: 'VITE_SUPABASE_API_KEY' },
  { label: 'OpenAI URL', key: 'VITE_OPENAI_URL' },
  { label: 'Prompts Table', key: 'VITE_PROMPTS_TBL' },
  { label: 'Settings Table', key: 'VITE_SETTINGS_TBL' },
  { label: 'Models Table', key: 'VITE_MODELS_TBL' },
  { label: 'Assistants Table', key: 'VITE_ASSISTANTS_TBL' },
  { label: 'Threads Table', key: 'VITE_THREADS_TBL' },
  { label: 'Templates Table', key: 'VITE_TEMPLATES_TBL' },
  { label: 'Prompt Variables Table', key: 'VITE_PROMPT_VARIABLES_TBL' },
  { label: 'AI Costs Table', key: 'VITE_AI_COSTS_TBL' },
  { label: 'Model Pricing Table', key: 'VITE_MODEL_PRICING_TBL' },
  { label: 'Model Defaults Table', key: 'VITE_MODEL_DEFAULTS_TBL' },
  { label: 'Assistant Files Table', key: 'VITE_ASSISTANT_FILES_TBL' },
  { label: 'Assistant Tool Defaults Table', key: 'VITE_ASSISTANT_TOOL_DEFAULTS_TBL' },
  { label: 'Vector Stores Table', key: 'VITE_VECTOR_STORES_TBL' },
  { label: 'Confluence Pages Table', key: 'VITE_CONFLUENCE_PAGES_TBL' },
  { label: 'Info Table', key: 'VITE_INFO_TBL' },
];

// Known secrets (stored in Lovable Cloud, accessible only in edge functions)
const KNOWN_SECRETS = [
  { name: 'OPENAI_API_KEY', description: 'OpenAI API key for AI completions' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', description: 'Supabase service role key (system managed)' },
  { name: 'SUPABASE_DB_URL', description: 'Supabase database URL (system managed)' },
  { name: 'SUPABASE_URL', description: 'Supabase project URL (system managed)' },
  { name: 'SUPABASE_ANON_KEY', description: 'Supabase anonymous key (system managed)' },
  { name: 'SUPABASE_PUBLISHABLE_KEY', description: 'Supabase publishable key (system managed)' },
];

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
  onAddSecret,
  onUpdateSecret,
}) {
  const { isAdmin } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newSettingKey, setNewSettingKey] = useState('');
  const [newSettingValue, setNewSettingValue] = useState('');
  const [newSettingDesc, setNewSettingDesc] = useState('');
  const [isAddSecretDialogOpen, setIsAddSecretDialogOpen] = useState(false);
  const [newSecretName, setNewSecretName] = useState('');
  const [secretToUpdate, setSecretToUpdate] = useState(null);

  // Safely get environment variables inside component (not at module load time)
  const envVariables = useMemo(() => 
    ENV_VAR_KEYS.map(({ label, key }) => ({
      label,
      key,
      value: getEnv(key, 'Not set'),
    })),
  []);

  // Filter out keys that are managed in QonsolSettingsSection
  const settingsArray = Object.entries(settings || {}).filter(([key]) => !isQonsolManagedKey(key));

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
                            autoComplete="new-password"
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
          <CardDescription>Read-only configuration from environment (set at build time)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Variable</TableHead>
                <TableHead className="w-[200px]">Key</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {envVariables.map(({ label, key, value }) => {
                const shouldMask = isSensitiveEnvKey(key);
                const displayValue = shouldMask ? maskValue(value) : (value || 'Not set');
                
                return (
                  <TableRow key={key}>
                    <TableCell className="font-medium">{label}</TableCell>
                    <TableCell>
                      <code className="text-xs text-muted-foreground">{key}</code>
                    </TableCell>
                    <TableCell>
                      <code className="px-2 py-1 bg-muted rounded text-sm break-all">
                        {displayValue}
                      </code>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Secrets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Secrets
            </CardTitle>
            <CardDescription>Secure credentials for edge functions (values hidden)</CardDescription>
          </div>
          {isAdmin && (
            <Dialog open={isAddSecretDialogOpen} onOpenChange={setIsAddSecretDialogOpen}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Add Secret</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Secret</DialogTitle>
                  <DialogDescription>Add a new secret for use in edge functions</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="secretName">Secret Name</Label>
                    <Input
                      id="secretName"
                      placeholder="e.g., MY_API_KEY"
                      value={newSecretName}
                      onChange={(e) => setNewSecretName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use UPPER_SNAKE_CASE (letters, numbers, underscores only)
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddSecretDialogOpen(false)}>Cancel</Button>
                  <Button 
                    onClick={() => {
                      if (newSecretName && onAddSecret) {
                        onAddSecret(newSecretName);
                        setNewSecretName('');
                        setIsAddSecretDialogOpen(false);
                      }
                    }}
                    disabled={!newSecretName}
                  >
                    Add Secret
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Secret Name</TableHead>
                <TableHead>Description</TableHead>
                {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {KNOWN_SECRETS.map((secret) => {
                const isSystemManaged = secret.description.includes('system managed');
                return (
                  <TableRow key={secret.name}>
                    <TableCell className="font-medium font-mono">{secret.name}</TableCell>
                    <TableCell className="text-muted-foreground">{secret.description}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        {!isSystemManaged && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => onUpdateSecret && onUpdateSecret(secret.name)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Update Secret</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!isAdmin && (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Only administrators can add or update secrets
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
