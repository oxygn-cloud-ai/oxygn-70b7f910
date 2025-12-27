import React, { useState, useEffect, useCallback } from "react";
import { 
  Settings, Database, Key, Palette, Bell, User, 
  Link2, DollarSign, CreditCard, MessageSquare, Sparkles,
  Sun, Moon, Monitor, Check, Eye, EyeOff, Plus, Trash2, Copy,
  RefreshCw, ExternalLink, X, Type, Cpu, FileText, Briefcase,
  HelpCircle, ChevronDown, ChevronUp, Bot, AlertCircle, Loader2,
  Code, Search, Globe, Zap, TrendingUp, Save
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { SettingCard } from "@/components/ui/setting-card";
import { SettingRow } from "@/components/ui/setting-row";
import { SettingDivider } from "@/components/ui/setting-divider";
import { SettingInput } from "@/components/ui/setting-input";
import { Checkbox } from "@/components/ui/checkbox";
import { getThemePreference, setThemePreference } from '@/components/ui/sonner';
import { useSupabase } from "@/hooks/useSupabase";
import { toast } from "@/components/ui/sonner";

// Mock data for fallback
const MOCK_MODELS = [
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", active: true, inputCost: 2.50, outputCost: 10.00 },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", active: true, inputCost: 0.15, outputCost: 0.60 },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "OpenAI", active: false, inputCost: 10.00, outputCost: 30.00 },
  { id: "o1-preview", name: "O1 Preview", provider: "OpenAI", active: true, inputCost: 15.00, outputCost: 60.00 },
  { id: "o1-mini", name: "O1 Mini", provider: "OpenAI", active: true, inputCost: 3.00, outputCost: 12.00 },
];

const MOCK_API_KEYS = [
  { id: "openai", name: "OpenAI API Key", key: "sk-•••••••••••••xyz789", status: "Active", lastUsed: "2 hours ago" },
  { id: "confluence", name: "Confluence API Token", key: "ATATT•••••••••abc123", status: "Active", lastUsed: "1 day ago" },
];

const MOCK_NAMING_LEVELS = [
  { level: 0, name: "Prompt", prefix: "", suffix: "" },
  { level: 1, name: "Sub-prompt", prefix: "", suffix: "" },
  { level: 2, name: "Task", prefix: "", suffix: "" },
];

// General Settings Section - Connected to real settings
const GeneralSection = ({ settings = {}, onUpdateSetting, models = [], isLoadingSettings }) => {
  const [editedValues, setEditedValues] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const handleValueChange = (key, value) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (key) => {
    if (!onUpdateSetting) return;
    setIsSaving(true);
    try {
      await onUpdateSetting(key, editedValues[key]);
      setEditedValues(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getValue = (key, fallback = '') => {
    if (editedValues[key] !== undefined) return editedValues[key];
    return settings[key]?.value || fallback;
  };

  const hasChanges = (key) => {
    return editedValues[key] !== undefined && editedValues[key] !== (settings[key]?.value || '');
  };

  return (
    <div className="space-y-4">
      {/* Default Model */}
      <SettingCard label="Default Model">
        <div className="space-y-3">
          <SettingRow label="Default Model" description="Model used for new prompts">
            <div className="flex items-center gap-2">
              <select
                value={getValue('default_model')}
                onChange={(e) => handleValueChange('default_model', e.target.value)}
                className="h-8 px-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select model...</option>
                {models.map((model) => (
                  <option key={model.row_id || model.id} value={model.model_id || model.id}>
                    {model.model_name || model.name}
                  </option>
                ))}
              </select>
              {hasChanges('default_model') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleSave('default_model')}
                      disabled={isSaving}
                      className="w-6 h-6 flex items-center justify-center rounded-m3-full text-primary hover:bg-on-surface/[0.08]"
                    >
                      <Save className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Save</TooltipContent>
                </Tooltip>
              )}
            </div>
          </SettingRow>
        </div>
      </SettingCard>

      {/* Application Settings */}
      <SettingCard label="Application">
        <div className="space-y-3">
          <SettingRow label="Build" description="Current build identifier">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={getValue('build')}
                onChange={(e) => handleValueChange('build', e.target.value)}
                placeholder="e.g. 1.0.0"
                className="h-8 w-24 px-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {hasChanges('build') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleSave('build')}
                      disabled={isSaving}
                      className="w-6 h-6 flex items-center justify-center rounded-m3-full text-primary hover:bg-on-surface/[0.08]"
                    >
                      <Save className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Save</TooltipContent>
                </Tooltip>
              )}
            </div>
          </SettingRow>
          <SettingDivider />
          <SettingRow label="Version" description="Application version">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={getValue('version')}
                onChange={(e) => handleValueChange('version', e.target.value)}
                placeholder="e.g. 1.0.0"
                className="h-8 w-24 px-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {hasChanges('version') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleSave('version')}
                      disabled={isSaving}
                      className="w-6 h-6 flex items-center justify-center rounded-m3-full text-primary hover:bg-on-surface/[0.08]"
                    >
                      <Save className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Save</TooltipContent>
                </Tooltip>
              )}
            </div>
          </SettingRow>
        </div>
      </SettingCard>
    </div>
  );
};

// Prompt Naming Section (NEW - matching real PromptNamingSettings.jsx)
const PromptNamingSection = () => {
  const [levels, setLevels] = useState(MOCK_NAMING_LEVELS);
  const [expandedSet, setExpandedSet] = useState(false);

  return (
    <div className="space-y-4">
      {/* Template Codes Help */}
      <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-m3-lg">
        <p className="text-body-sm text-on-surface-variant">
          Use template codes in prefix/suffix fields for dynamic naming.
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
              <HelpCircle className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs p-3">
            <div className="space-y-2 text-[10px]">
              <p className="font-medium">Available Template Codes:</p>
              <div className="space-y-1">
                <p><code className="bg-surface-container px-1 rounded">{"{n}"}</code> - Sequence number</p>
                <p><code className="bg-surface-container px-1 rounded">{"{date}"}</code> - Current date</p>
                <p><code className="bg-surface-container px-1 rounded">{"{level}"}</code> - Hierarchy level</p>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Default Naming Table */}
      <SettingCard label="Default Naming (All Prompts)">
        <div className="space-y-2">
          {/* Table Header */}
          <div className="grid grid-cols-[40px,1fr,1fr,1fr,100px,40px] gap-2 px-2 py-1.5 text-[10px] text-on-surface-variant uppercase tracking-wider">
            <span>Level</span>
            <span>Default Name</span>
            <span>Prefix</span>
            <span>Suffix</span>
            <span>Preview</span>
            <span></span>
          </div>
          
          {/* Table Rows */}
          {levels.map((level, index) => (
            <div key={level.level} className="grid grid-cols-[40px,1fr,1fr,1fr,100px,40px] gap-2 items-center p-2 bg-surface-container rounded-m3-sm">
              <span className="text-body-sm text-on-surface-variant">{index}</span>
              <input 
                type="text" 
                defaultValue={level.name}
                className="h-7 px-2 bg-surface-container-high rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input 
                type="text" 
                defaultValue={level.prefix}
                placeholder="Prefix"
                className="h-7 px-2 bg-surface-container-high rounded-m3-sm border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input 
                type="text" 
                defaultValue={level.suffix}
                placeholder="Suffix"
                className="h-7 px-2 bg-surface-container-high rounded-m3-sm border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-[10px] text-on-surface-variant truncate">{level.prefix}{level.name}{level.suffix}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="w-6 h-6 flex items-center justify-center rounded-m3-full text-destructive hover:bg-on-surface/[0.08]">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Remove Level</TooltipContent>
              </Tooltip>
            </div>
          ))}
          
          {/* Add Level */}
          <button className="flex items-center gap-1.5 px-2 py-1.5 text-body-sm text-on-surface-variant hover:text-on-surface transition-colors">
            <Plus className="h-3.5 w-3.5" />
            <span>Add Level</span>
          </button>
        </div>
      </SettingCard>

      {/* Top-Level Set Overrides */}
      <SettingCard label="Top-Level Set Overrides">
        <div className="space-y-3">
          <p className="text-[10px] text-on-surface-variant">
            Create custom naming patterns for specific top-level prompt sets.
          </p>
          
          {/* Add new set */}
          <div className="flex gap-2">
            <input 
              type="text"
              placeholder="Top-level prompt name to match..."
              className="flex-1 h-8 px-2.5 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button className="flex items-center gap-1.5 px-3 h-8 text-body-sm text-on-surface-variant hover:text-on-surface transition-colors">
              <Plus className="h-3.5 w-3.5" />
              <span>Add Set</span>
            </button>
          </div>

          {/* Existing set example */}
          <div className="border border-outline-variant rounded-m3-md overflow-hidden">
            <button 
              onClick={() => setExpandedSet(!expandedSet)}
              className="w-full flex items-center justify-between p-3 hover:bg-on-surface/[0.04] transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandedSet ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span className="text-body-sm text-on-surface font-medium">Customer Support</span>
                <span className="text-[10px] text-on-surface-variant">(2 levels)</span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={(e) => e.stopPropagation()}
                    className="w-6 h-6 flex items-center justify-center rounded-m3-full text-destructive hover:bg-on-surface/[0.08]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Remove Set</TooltipContent>
              </Tooltip>
            </button>
            {expandedSet && (
              <div className="p-3 pt-0 border-t border-outline-variant">
                <p className="text-[10px] text-on-surface-variant py-2">Custom levels for this set...</p>
              </div>
            )}
          </div>

          <p className="text-[10px] text-on-surface-variant/70 italic">
            No other custom sets configured.
          </p>
        </div>
      </SettingCard>
    </div>
  );
};

// Conversation Defaults Section - Connected to real settings
const ConversationDefaultsSection = ({ settings = {}, onUpdateSetting }) => {
  const [editedValues, setEditedValues] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const handleValueChange = (key, value) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (key) => {
    if (!onUpdateSetting) return;
    setIsSaving(true);
    try {
      await onUpdateSetting(key, editedValues[key]);
      setEditedValues(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getValue = (key, fallback = '') => {
    if (editedValues[key] !== undefined) return editedValues[key];
    return settings[key]?.value || fallback;
  };

  const hasChanges = (key) => {
    return editedValues[key] !== undefined && editedValues[key] !== (settings[key]?.value || '');
  };

  return (
    <div className="space-y-4">
      {/* Default Context Prompt */}
      <SettingCard label="Default Context Prompt">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-on-surface-variant">Context/system prompt for new prompts</span>
            {hasChanges('default_context_prompt') && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleSave('default_context_prompt')}
                    disabled={isSaving}
                    className="w-6 h-6 flex items-center justify-center rounded-m3-full text-primary hover:bg-on-surface/[0.08]"
                  >
                    <Save className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Save</TooltipContent>
              </Tooltip>
            )}
          </div>
          <textarea 
            rows={4}
            value={getValue('default_context_prompt', 'You are a helpful AI assistant. Respond clearly and concisely.')}
            onChange={(e) => handleValueChange('default_context_prompt', e.target.value)}
            placeholder="Default context/system prompt for new prompts..."
            className="w-full p-2.5 bg-surface-container rounded-m3-md border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary resize-y"
          />
        </div>
      </SettingCard>

      {/* Default System Instructions */}
      <SettingCard label="Default System Instructions">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-on-surface-variant">Instructions for new top-level conversations</span>
            {hasChanges('default_system_instructions') && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleSave('default_system_instructions')}
                    disabled={isSaving}
                    className="w-6 h-6 flex items-center justify-center rounded-m3-full text-primary hover:bg-on-surface/[0.08]"
                  >
                    <Save className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Save</TooltipContent>
              </Tooltip>
            )}
          </div>
          <textarea 
            rows={4}
            value={getValue('default_system_instructions')}
            onChange={(e) => handleValueChange('default_system_instructions', e.target.value)}
            placeholder="Default instructions for new top-level conversations..."
            className="w-full p-2.5 bg-surface-container rounded-m3-md border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary resize-y"
          />
        </div>
      </SettingCard>

      {/* Default Tools */}
      <SettingCard label="Default Tools">
        <div className="space-y-3">
          <p className="text-[10px] text-on-surface-variant">Default tools enabled for new conversations</p>
          <div className="space-y-2">
            {[
              { key: 'default_code_interpreter', icon: Code, label: "Code Interpreter", description: "Allows the AI to write and run Python code" },
              { key: 'default_file_search', icon: Search, label: "File Search", description: "Enables searching through uploaded files" },
              { key: 'default_function_calling', icon: Zap, label: "Function Calling", description: "Allows defining custom functions for the AI" },
            ].map(tool => (
              <div key={tool.key} className="flex items-center justify-between p-2.5 bg-surface-container rounded-m3-sm">
                <div className="flex items-center gap-2">
                  <tool.icon className="h-4 w-4 text-on-surface-variant" />
                  <div>
                    <span className="text-body-sm text-on-surface">{tool.label}</span>
                    <p className="text-[10px] text-on-surface-variant">{tool.description}</p>
                  </div>
                </div>
                <Switch 
                  checked={getValue(tool.key) === 'true'} 
                  onCheckedChange={(checked) => {
                    handleValueChange(tool.key, checked ? 'true' : 'false');
                    if (onUpdateSetting) onUpdateSetting(tool.key, checked ? 'true' : 'false');
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </SettingCard>

      {/* Default Thread Mode */}
      <SettingCard label="Default Thread Mode">
        <div className="space-y-2">
          <select 
            value={getValue('default_thread_mode', 'new')}
            onChange={(e) => {
              handleValueChange('default_thread_mode', e.target.value);
              if (onUpdateSetting) onUpdateSetting('default_thread_mode', e.target.value);
            }}
            className="w-full h-9 px-2.5 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="new">New Thread - Create fresh conversation for each execution</option>
            <option value="reuse">Reuse Thread - Maintain conversation history</option>
          </select>
          <p className="text-[10px] text-on-surface-variant">Default thread behavior for new child prompts</p>
        </div>
      </SettingCard>

      {/* Empty Prompt Fallback */}
      <SettingCard label="Empty Prompt Fallback Message">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input 
              type="text"
              value={getValue('empty_prompt_fallback', 'Execute this prompt')}
              onChange={(e) => handleValueChange('empty_prompt_fallback', e.target.value)}
              className="flex-1 h-9 px-2.5 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {hasChanges('empty_prompt_fallback') && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleSave('empty_prompt_fallback')}
                    disabled={isSaving}
                    className="w-6 h-6 flex items-center justify-center rounded-m3-full text-primary hover:bg-on-surface/[0.08]"
                  >
                    <Save className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Save</TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className="text-[10px] text-on-surface-variant">Message sent to AI when a prompt has no user or admin content</p>
        </div>
      </SettingCard>
    </div>
  );
};

// Conversations Section - Connected to real Supabase data
const ConversationsSection = () => {
  const supabase = useSupabase();
  const [selectedIds, setSelectedIds] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('conversation-manager', {
        body: { action: 'list' }
      });
      if (error) throw error;
      setConversations(data?.conversations || []);
    } catch (err) {
      console.error('Error fetching conversations:', err);
      toast.error('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('conversation-manager', {
        body: { action: 'delete', ids: selectedIds }
      });
      if (error) throw error;
      toast.success(`Deleted ${selectedIds.length} conversation(s)`);
      setSelectedIds([]);
      fetchConversations();
    } catch (err) {
      console.error('Error deleting:', err);
      toast.error('Failed to delete conversations');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === conversations.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(conversations.map(c => c.row_id || c.id));
    }
  };

  return (
    <div className="space-y-4">
      <SettingCard>
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-label-sm text-on-surface font-medium">Conversation Configurations</span>
            <p className="text-[10px] text-on-surface-variant mt-0.5">
              These are all conversation configurations. Orphaned items have no linked prompt.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={fetchConversations} className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Refresh</TooltipContent>
            </Tooltip>
            {selectedIds.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={handleDelete} 
                    disabled={isDeleting}
                    className="w-8 h-8 flex items-center justify-center rounded-m3-full text-destructive hover:bg-on-surface/[0.08]"
                  >
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Delete {selectedIds.length} selected</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-8 text-on-surface-variant text-body-sm">
            No conversations found.
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="grid grid-cols-[32px,1fr,100px,120px,80px] gap-2 px-2 py-1.5 text-[10px] text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
              <div className="flex items-center justify-center">
                <Checkbox 
                  checked={selectedIds.length === conversations.length}
                  onCheckedChange={toggleSelectAll}
                  className="h-3.5 w-3.5"
                />
              </div>
              <span>Name</span>
              <span>Model</span>
              <span>Linked Prompt</span>
              <span>Created</span>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-outline-variant">
              {conversations.map(conv => (
                <div 
                  key={conv.row_id || conv.id} 
                  className={`grid grid-cols-[32px,1fr,100px,120px,80px] gap-2 px-2 py-2.5 items-center transition-colors ${
                    selectedIds.includes(conv.row_id || conv.id) ? "bg-secondary-container/30" : ""
                  }`}
                >
                  <div className="flex items-center justify-center">
                    <Checkbox 
                      checked={selectedIds.includes(conv.row_id || conv.id)}
                      onCheckedChange={() => toggleSelect(conv.row_id || conv.id)}
                      className="h-3.5 w-3.5"
                    />
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-body-sm text-on-surface font-medium truncate">{conv.name || 'Unnamed'}</span>
                    {!conv.prompt_row_id && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 bg-destructive/10 text-destructive rounded-full shrink-0">
                            <AlertCircle className="h-2.5 w-2.5" />
                            Orphaned
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px]">No linked prompt in the system</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <span className="text-[11px] text-on-surface-variant truncate">{conv.model_override || conv.model || '-'}</span>
                  <span className="text-[11px] text-on-surface-variant truncate">{conv.prompt_name || "-"}</span>
                  <span className="text-[11px] text-on-surface-variant">{formatDate(conv.created_at)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </SettingCard>
    </div>
  );
};

// AI Models Section - Updated to accept real data
const AIModelsSection = ({ models = [], isLoading = false, onToggleModel }) => {
  // Use real models if provided, fallback to mock
  const displayModels = models.length > 0 ? models : MOCK_MODELS;

  const handleToggle = (id) => {
    if (onToggleModel) {
      onToggleModel(id);
    }
  };

  return (
    <div className="space-y-3">
      <SettingCard label="Available Models">
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr,100px,100px,80px] gap-3 px-3 py-2 text-[10px] text-on-surface-variant uppercase tracking-wider">
            <span>Model</span>
            <span className="text-right">Input $/1M</span>
            <span className="text-right">Output $/1M</span>
            <span className="text-center">Active</span>
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 py-4 px-3">
              <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant" />
              <span className="text-body-sm text-on-surface-variant">Loading models...</span>
            </div>
          ) : (
            displayModels.map((model, i) => (
              <div key={model.model_id || model.id}>
                {i > 0 && <SettingDivider />}
                <div className="grid grid-cols-[1fr,100px,100px,80px] gap-3 px-3 py-2 items-center">
                  <div>
                    <span className="text-body-sm text-on-surface font-medium">{model.model_name || model.name}</span>
                    <span className="text-[10px] text-on-surface-variant ml-2">{model.provider || 'OpenAI'}</span>
                  </div>
                  <span className="text-body-sm text-on-surface-variant text-right">
                    ${(model.inputCost || 0).toFixed(2)}
                  </span>
                  <span className="text-body-sm text-on-surface-variant text-right">
                    ${(model.outputCost || 0).toFixed(2)}
                  </span>
                  <div className="flex justify-center">
                    <Switch 
                      checked={model.is_active ?? model.active ?? true} 
                      onCheckedChange={() => handleToggle(model.model_id || model.id)} 
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </SettingCard>

      <SettingCard label="Default Model Settings">
        <div className="space-y-3">
          <SettingRow label="Default Model">
            <SettingInput>GPT-4o</SettingInput>
          </SettingRow>
          <SettingDivider />
          <SettingRow label="Temperature" description="0.0 - 2.0">
            <SettingInput minWidth="w-16">0.7</SettingInput>
          </SettingRow>
          <SettingDivider />
          <SettingRow label="Max Tokens">
            <SettingInput minWidth="w-20">4096</SettingInput>
          </SettingRow>
        </div>
      </SettingCard>
    </div>
  );
};

// API Keys Section
const APIKeysSection = () => {
  const [showKey, setShowKey] = useState({});

  return (
    <div className="space-y-3">
      <SettingCard>
        <div className="space-y-2">
          {MOCK_API_KEYS.map((apiKey, i) => (
            <div key={apiKey.id}>
              {i > 0 && <SettingDivider className="my-2" />}
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-body-sm text-on-surface font-medium">{apiKey.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600">
                      {apiKey.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <code className="text-[11px] text-on-surface-variant font-mono">
                      {showKey[apiKey.id] ? "sk-abc123...xyz789" : apiKey.key}
                    </code>
                    <span className="text-[10px] text-on-surface-variant">• Last used {apiKey.lastUsed}</span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        onClick={() => setShowKey(prev => ({ ...prev, [apiKey.id]: !prev[apiKey.id] }))}
                        className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
                      >
                        {showKey[apiKey.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">{showKey[apiKey.id] ? "Hide" : "Show"}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                        <Copy className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Copy</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-7 h-7 flex items-center justify-center rounded-m3-full text-destructive hover:bg-on-surface/[0.08]">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Delete</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SettingCard>

      <div className="flex">
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
              <Plus className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">Add API Key</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

// Theme Section - Connected to real theme persistence
const ThemeSection = () => {
  const [theme, setTheme] = useState(getThemePreference());

  useEffect(() => {
    const handleChange = () => {
      setTheme(getThemePreference());
    };
    window.addEventListener('theme-preference-change', handleChange);
    return () => window.removeEventListener('theme-preference-change', handleChange);
  }, []);

  const handleThemeChange = (value) => {
    setThemePreference(value);
    setTheme(value);
  };

  return (
    <div className="space-y-3">
      <SettingCard label="Appearance">
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "light", icon: Sun, label: "Light" },
            { id: "dark", icon: Moon, label: "Dark" },
            { id: "system", icon: Monitor, label: "System" },
          ].map(option => (
            <button
              key={option.id}
              onClick={() => handleThemeChange(option.id)}
              className={`flex flex-col items-center gap-2 p-3 rounded-m3-lg border transition-colors ${
                theme === option.id 
                  ? "bg-secondary-container border-outline" 
                  : "border-outline-variant hover:bg-on-surface/[0.08]"
              }`}
            >
              <option.icon className={`h-5 w-5 ${theme === option.id ? "text-secondary-container-foreground" : "text-on-surface-variant"}`} />
              <span className={`text-[11px] ${theme === option.id ? "text-secondary-container-foreground font-medium" : "text-on-surface-variant"}`}>
                {option.label}
              </span>
              {theme === option.id && <Check className="h-3.5 w-3.5 text-secondary-container-foreground" />}
            </button>
          ))}
        </div>
      </SettingCard>

      <SettingCard label="Accent Color">
        <div className="flex gap-2">
          {["#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#22c55e", "#06b6d4"].map(color => (
            <button
              key={color}
              className="w-8 h-8 rounded-full border-2 border-transparent hover:border-on-surface/20 transition-colors"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </SettingCard>
    </div>
  );
};

// Notifications Section
const NotificationsSection = () => (
  <SettingCard>
    <div className="space-y-3">
      <SettingRow label="Email notifications" description="Receive updates via email">
        <Switch defaultChecked />
      </SettingRow>
      <SettingDivider />
      <SettingRow label="Cascade completion" description="Notify when cascades finish">
        <Switch defaultChecked />
      </SettingRow>
      <SettingDivider />
      <SettingRow label="Error alerts" description="Get notified about failures">
        <Switch defaultChecked />
      </SettingRow>
      <SettingDivider />
      <SettingRow label="Usage warnings" description="Alert when approaching limits">
        <Switch />
      </SettingRow>
    </div>
  </SettingCard>
);

// Profile Section
const ProfileSection = () => (
  <SettingCard>
    <div className="flex items-center gap-3 mb-4">
      <div className="w-12 h-12 rounded-full bg-tertiary-container flex items-center justify-center">
        <User className="h-6 w-6 text-on-surface-variant" />
      </div>
      <div>
        <h4 className="text-title-sm text-on-surface font-medium">John Doe</h4>
        <p className="text-body-sm text-on-surface-variant">john.doe@company.com</p>
      </div>
    </div>
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-[10px] text-on-surface-variant">Display Name</label>
        <SettingInput minWidth="w-full">John Doe</SettingInput>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-on-surface-variant">Email</label>
        <SettingInput minWidth="w-full">john.doe@company.com</SettingInput>
      </div>
    </div>
  </SettingCard>
);

// Confluence Section
const ConfluenceSection = () => (
  <SettingCard>
    <div className="flex items-center gap-3 mb-3">
      <Link2 className="h-5 w-5 text-on-surface-variant" />
      <div className="flex-1">
        <h4 className="text-body-sm text-on-surface font-medium">Connected</h4>
        <p className="text-[10px] text-on-surface-variant">mycompany.atlassian.net</p>
      </div>
      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600">Active</span>
    </div>
    <div className="space-y-3">
      <SettingRow label="Auto-sync pages" description="Sync linked pages automatically">
        <Switch defaultChecked />
      </SettingRow>
      <SettingDivider />
      <SettingRow label="Default space">
        <SettingInput minWidth="min-w-36">Engineering</SettingInput>
      </SettingRow>
    </div>
  </SettingCard>
);

// Cost Analytics Section - Connected to real cost tracking
const CostAnalyticsSection = ({ costTracking }) => {
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    if (!costTracking?.getPlatformCosts) return;
    setIsLoading(true);
    try {
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const data = await costTracking.getPlatformCosts({ startDate, endDate });
      setAnalytics(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [costTracking]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const formatCurrency = (value) => `$${(value || 0).toFixed(2)}`;
  const formatNumber = (value) => {
    if (!value) return '0';
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={fetchAnalytics} className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
              <RefreshCw className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">Refresh</TooltipContent>
        </Tooltip>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SettingCard>
          <div className="text-center">
            <DollarSign className="h-5 w-5 mx-auto text-on-surface-variant mb-1" />
            <span className="text-title-sm text-on-surface font-semibold">{formatCurrency(analytics?.totalCost)}</span>
            <p className="text-[10px] text-on-surface-variant">Last 30 Days</p>
          </div>
        </SettingCard>
        <SettingCard>
          <div className="text-center">
            <span className="text-title-sm text-on-surface font-semibold">{analytics?.totalCalls || 0}</span>
            <p className="text-[10px] text-on-surface-variant">Total Calls</p>
          </div>
        </SettingCard>
        <SettingCard>
          <div className="text-center">
            <span className="text-title-sm text-on-surface font-semibold">{formatNumber(analytics?.totalTokens)}</span>
            <p className="text-[10px] text-on-surface-variant">Total Tokens</p>
          </div>
        </SettingCard>
        <SettingCard>
          <div className="text-center">
            <span className="text-title-sm text-on-surface font-semibold">
              {formatCurrency(analytics?.totalCalls ? analytics.totalCost / analytics.totalCalls : 0)}
            </span>
            <p className="text-[10px] text-on-surface-variant">Avg/Call</p>
          </div>
        </SettingCard>
      </div>
    </div>
  );
};

// Workbench Settings Section - Connected to real settings
const WorkbenchSettingsSection = ({ settings = {}, onUpdateSetting, models = [] }) => {
  const [editedValues, setEditedValues] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const handleValueChange = (key, value) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (key) => {
    if (!onUpdateSetting) return;
    setIsSaving(true);
    try {
      await onUpdateSetting(key, editedValues[key]);
      setEditedValues(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getValue = (key, fallback = '') => {
    if (editedValues[key] !== undefined) return editedValues[key];
    return settings[key]?.value || fallback;
  };

  const hasChanges = (key) => {
    return editedValues[key] !== undefined && editedValues[key] !== (settings[key]?.value || '');
  };

  return (
    <div className="space-y-4">
      <SettingCard label="Workbench Defaults">
        <div className="space-y-3">
          <SettingRow label="Default model" description="Model used for new conversations">
            <div className="flex items-center gap-2">
              <select
                value={getValue('workbench_default_model')}
                onChange={(e) => handleValueChange('workbench_default_model', e.target.value)}
                className="h-8 px-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select model...</option>
                {models.map((model) => (
                  <option key={model.row_id || model.id} value={model.model_id || model.id}>
                    {model.model_name || model.name}
                  </option>
                ))}
              </select>
              {hasChanges('workbench_default_model') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleSave('workbench_default_model')}
                      disabled={isSaving}
                      className="w-6 h-6 flex items-center justify-center rounded-m3-full text-primary hover:bg-on-surface/[0.08]"
                    >
                      <Save className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Save</TooltipContent>
                </Tooltip>
              )}
            </div>
          </SettingRow>
          <SettingDivider />
          <SettingRow label="Enable file search" description="Allow searching uploaded files">
            <Switch 
              checked={getValue('workbench_file_search') === 'true'} 
              onCheckedChange={(checked) => {
                const value = checked ? 'true' : 'false';
                handleValueChange('workbench_file_search', value);
                if (onUpdateSetting) onUpdateSetting('workbench_file_search', value);
              }}
            />
          </SettingRow>
          <SettingDivider />
          <SettingRow label="Enable code interpreter" description="Allow code execution">
            <Switch 
              checked={getValue('workbench_code_interpreter') === 'true'} 
              onCheckedChange={(checked) => {
                const value = checked ? 'true' : 'false';
                handleValueChange('workbench_code_interpreter', value);
                if (onUpdateSetting) onUpdateSetting('workbench_code_interpreter', value);
              }}
            />
          </SettingRow>
          <SettingDivider />
          <SettingRow label="Auto-save threads" description="Save conversation history">
            <Switch 
              checked={getValue('workbench_auto_save', 'true') === 'true'} 
              onCheckedChange={(checked) => {
                const value = checked ? 'true' : 'false';
                handleValueChange('workbench_auto_save', value);
                if (onUpdateSetting) onUpdateSetting('workbench_auto_save', value);
              }}
            />
          </SettingRow>
        </div>
      </SettingCard>

      <SettingCard label="System Prompt">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-on-surface-variant">Default system prompt for workbench conversations</span>
            {hasChanges('workbench_system_prompt') && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleSave('workbench_system_prompt')}
                    disabled={isSaving}
                    className="w-6 h-6 flex items-center justify-center rounded-m3-full text-primary hover:bg-on-surface/[0.08]"
                  >
                    <Save className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Save</TooltipContent>
              </Tooltip>
            )}
          </div>
          <textarea 
            rows={4}
            value={getValue('workbench_system_prompt')}
            onChange={(e) => handleValueChange('workbench_system_prompt', e.target.value)}
            placeholder="Enter the system prompt for Workbench AI..."
            className="w-full p-2.5 bg-surface-container rounded-m3-md border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary resize-y"
          />
        </div>
      </SettingCard>
    </div>
  );
};

// New UI Section
const NewUISection = () => (
  <SettingCard>
    <div className="flex items-center gap-3 p-2 mb-3 bg-amber-500/10 rounded-m3-md">
      <Sparkles className="h-4 w-4 text-amber-600" />
      <span className="text-body-sm text-amber-700">You're currently using the new UI</span>
    </div>
    <div className="space-y-3">
      <SettingRow label="Enable New UI" description="Switch to the experimental interface">
        <Switch defaultChecked />
      </SettingRow>
      <SettingDivider />
      <SettingRow label="Show onboarding tips" description="Display helpful hints for new features">
        <Switch defaultChecked />
      </SettingRow>
    </div>
  </SettingCard>
);

// Database & Environment Section
const DatabaseEnvironmentSection = () => {
  const MOCK_SETTINGS = [
    { key: 'default_model', value: 'gpt-4o', description: 'Default AI model for new prompts' },
    { key: 'max_tokens_default', value: '4096', description: 'Default max tokens setting' },
  ];

  const MOCK_ENV_VARS = [
    { label: 'Supabase URL', key: 'VITE_SUPABASE_URL', value: 'https://xxx.supabase.co' },
    { label: 'Supabase Key', key: 'VITE_SUPABASE_PUBLISHABLE_KEY', value: 'eyJ...' },
  ];

  const MOCK_SECRETS = [
    { name: 'OPENAI_API_KEY', description: 'OpenAI API Key', configured: true },
    { name: 'CONFLUENCE_API_TOKEN', description: 'Confluence API Token', configured: true },
    { name: 'SLACK_BOT_TOKEN', description: 'Slack Bot Token', configured: false },
  ];

  return (
    <div className="space-y-4">
      {/* Database Settings */}
      <SettingCard>
        <div className="flex items-center justify-between mb-3">
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">Database Settings</span>
          <button className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container">
            <Plus className="h-4 w-4 text-on-surface-variant" />
          </button>
        </div>
        <div className="space-y-2">
          {MOCK_SETTINGS.map((setting) => (
            <div key={setting.key} className="flex items-center justify-between p-2 bg-surface-container rounded-m3-sm">
              <div>
                <div className="text-body-sm text-on-surface">{setting.key}</div>
                <div className="text-[10px] text-on-surface-variant">{setting.description}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-body-sm text-on-surface-variant font-mono">{setting.value}</span>
                <button className="w-6 h-6 flex items-center justify-center rounded-m3-full hover:bg-surface-container-high">
                  <X className="h-3 w-3 text-on-surface-variant" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </SettingCard>

      {/* Environment Variables */}
      <SettingCard>
        <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">Environment Variables</span>
        <div className="space-y-2 mt-3">
          {MOCK_ENV_VARS.map((env) => (
            <SettingRow key={env.key} label={env.label} description={env.key}>
              <span className="text-body-sm text-on-surface-variant font-mono">••••••••</span>
            </SettingRow>
          ))}
        </div>
      </SettingCard>

      {/* Secrets */}
      <SettingCard>
        <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">Secrets</span>
        <div className="space-y-2 mt-3">
          {MOCK_SECRETS.map((secret) => (
            <div key={secret.name} className="flex items-center justify-between p-2 bg-surface-container rounded-m3-sm">
              <div>
                <div className="text-body-sm text-on-surface">{secret.name}</div>
                <div className="text-[10px] text-on-surface-variant">{secret.description}</div>
              </div>
              <div className="flex items-center gap-2">
                {secret.configured ? (
                  <span className="text-[10px] text-green-500 bg-green-500/10 px-2 py-0.5 rounded-m3-full">Configured</span>
                ) : (
                  <span className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-m3-full">Not Set</span>
                )}
                <button className="w-6 h-6 flex items-center justify-center rounded-m3-full hover:bg-surface-container-high">
                  <RefreshCw className="h-3 w-3 text-on-surface-variant" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </SettingCard>
    </div>
  );
};

// OpenAI Billing Section (Enhanced to match real app)
const OpenAIBillingSection = () => {
  const [showData, setShowData] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setShowData(true);
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="space-y-4">
      <SettingCard>
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-label-sm text-on-surface font-medium">OpenAI Billing</span>
            <p className="text-[10px] text-on-surface-variant mt-0.5">Check your OpenAI API credits and usage</p>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
                  onClick={handleRefresh}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 text-on-surface-variant ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">{showData ? 'Refresh' : 'Check Balance'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container">
                  <ExternalLink className="h-4 w-4 text-on-surface-variant" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Open OpenAI Dashboard</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {!showData && !isLoading && (
          <div className="text-center py-8">
            <DollarSign className="h-8 w-8 text-on-surface-variant/30 mx-auto mb-2" />
            <p className="text-body-sm text-on-surface-variant">Click refresh to fetch billing data</p>
            <p className="text-[10px] text-on-surface-variant/70 mt-1">Note: Some endpoints require an Admin API key</p>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-8">
            <Loader2 className="h-6 w-6 text-on-surface-variant animate-spin mx-auto mb-2" />
            <p className="text-body-sm text-on-surface-variant">Fetching billing data...</p>
          </div>
        )}

        {showData && !isLoading && (
          <div className="space-y-4">
            {/* Subscription */}
            <div className="p-3 bg-surface-container rounded-m3-md">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-4 w-4 text-on-surface-variant" />
                <span className="text-label-sm text-on-surface-variant uppercase">Subscription</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-body-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Plan:</span>
                  <span className="text-on-surface font-medium">Pay As You Go</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Hard Limit:</span>
                  <span className="text-on-surface font-medium">$120.00/mo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Soft Limit:</span>
                  <span className="text-on-surface font-medium">$100.00/mo</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant">Payment:</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-600 rounded-full flex items-center gap-0.5">
                    <Check className="h-2.5 w-2.5" />
                    Active
                  </span>
                </div>
              </div>
            </div>

            {/* Credits */}
            <div className="p-3 bg-surface-container rounded-m3-md">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-on-surface-variant" />
                <span className="text-label-sm text-on-surface-variant uppercase">Credits</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-body-sm">
                  <span className="text-on-surface-variant">Available:</span>
                  <span className="text-green-600 font-semibold">$25.00</span>
                </div>
                <div className="flex justify-between text-body-sm">
                  <span className="text-on-surface-variant">Total Granted:</span>
                  <span className="text-on-surface">$100.00</span>
                </div>
                <div className="flex justify-between text-body-sm">
                  <span className="text-on-surface-variant">Total Used:</span>
                  <span className="text-on-surface">$75.00</span>
                </div>
                <div className="pt-2">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-on-surface-variant">Usage</span>
                    <span className="text-on-surface-variant">75%</span>
                  </div>
                  <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: '75%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Usage */}
            <div className="p-3 bg-surface-container rounded-m3-md">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-on-surface-variant" />
                <span className="text-label-sm text-on-surface-variant uppercase">Last 30 Days</span>
              </div>
              <div className="flex justify-between text-body-sm">
                <span className="text-on-surface-variant">Total Spend:</span>
                <span className="text-on-surface font-semibold">$47.23</span>
              </div>
            </div>

            <p className="text-[10px] text-on-surface-variant text-right">
              Last checked: {new Date().toLocaleTimeString()}
            </p>
          </div>
        )}
      </SettingCard>
    </div>
  );
};

// Settings Sections Configuration
const SETTINGS_SECTIONS = {
  "qonsol": { component: GeneralSection, icon: Settings, title: "General" },
  "naming": { component: PromptNamingSection, icon: Type, title: "Prompt Naming" },
  "models": { component: AIModelsSection, icon: Cpu, title: "AI Models" },
  "database": { component: DatabaseEnvironmentSection, icon: Database, title: "Database & Environment" },
  "assistants": { component: ConversationDefaultsSection, icon: MessageSquare, title: "Conversation Defaults" },
  "conversations": { component: ConversationsSection, icon: MessageSquare, title: "Conversations" },
  "confluence": { component: ConfluenceSection, icon: FileText, title: "Confluence" },
  "cost-analytics": { component: CostAnalyticsSection, icon: DollarSign, title: "Cost Analytics" },
  "openai-billing": { component: OpenAIBillingSection, icon: CreditCard, title: "OpenAI Billing" },
  "appearance": { component: ThemeSection, icon: Palette, title: "Appearance" },
  "workbench": { component: WorkbenchSettingsSection, icon: Briefcase, title: "Workbench" },
  "new-ui": { component: NewUISection, icon: Sparkles, title: "New UI (Beta)" },
  "notifications": { component: NotificationsSection, icon: Bell, title: "Notifications" },
  "profile": { component: ProfileSection, icon: User, title: "Profile" },
  "api-keys": { component: APIKeysSection, icon: Key, title: "API Keys" },
};

const MockupSettingsContent = ({ 
  activeSubItem = "qonsol",
  settings = {},
  isLoadingSettings = false,
  onUpdateSetting,
  models = [],
  isLoadingModels = false,
  onToggleModel,
  costTracking,
  conversationToolDefaults,
}) => {
  const section = SETTINGS_SECTIONS[activeSubItem] || SETTINGS_SECTIONS.qonsol;
  const SectionComponent = section.component;
  const Icon = section.icon;

  // Prepare props to pass to section components based on which section is active
  const getSectionProps = () => {
    const commonSettingsProps = { 
      settings, 
      onUpdateSetting, 
      isLoadingSettings 
    };
    
    switch (activeSubItem) {
      case 'qonsol':
        return { 
          ...commonSettingsProps,
          models, 
        };
      case 'models':
        return { 
          models, 
          isLoading: isLoadingModels, 
          onToggleModel,
          settings,
          onUpdateSetting,
        };
      case 'assistants':
        return { ...commonSettingsProps, conversationToolDefaults };
      case 'workbench':
        return { 
          ...commonSettingsProps,
          models 
        };
      case 'naming':
        return commonSettingsProps;
      case 'confluence':
        return commonSettingsProps;
      case 'cost-analytics':
        return { costTracking };
      default:
        return commonSettingsProps;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-0">
      {/* Header */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-outline-variant" style={{ height: "56px" }}>
        <Icon className="h-5 w-5 text-on-surface-variant" />
        <h2 className="text-title-sm text-on-surface font-medium">{section.title}</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-3xl">
          <SectionComponent {...getSectionProps()} />
        </div>
      </div>
    </div>
  );
};

export default MockupSettingsContent;
