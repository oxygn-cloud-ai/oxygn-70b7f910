import { useState, useEffect, useCallback } from "react";
import { 
  Settings, Palette, Bell, User, 
  Link2, MessageSquare, Sparkles,
  Sun, Moon, Monitor, Check, Eye, EyeOff, Plus, Trash2, Copy,
  RefreshCw, ExternalLink, X, Type, Cpu, FileText,
  HelpCircle, ChevronDown, ChevronUp, Bot, AlertCircle, Loader2,
  Code, Search, Globe, Zap, Save, XCircle, History, BookOpen, Key
} from "lucide-react";
import DeletedItemsContent from './DeletedItemsContent';
import KnowledgeManager from '@/components/admin/KnowledgeManager';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { SettingCard } from "@/components/ui/setting-card";
import { SettingRow } from "@/components/ui/setting-row";
import { SettingDivider } from "@/components/ui/setting-divider";
import { SettingInput } from "@/components/ui/setting-input";
import { Checkbox } from "@/components/ui/checkbox";
import { getThemePreference, setThemePreference } from '@/components/ui/sonner';
import { useSupabase } from "@/hooks/useSupabase";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUndo } from "@/contexts/UndoContext";
import { useUserCredentials } from "@/hooks/useUserCredentials";
import { useBuildInfo } from "@/hooks/useBuildInfo";
import { toast } from "@/components/ui/sonner";
import { trackEvent } from '@/lib/posthog';

// No mock data - all models come from database via useModels hook

const DEFAULT_NAMING_LEVELS = [
  { level: 0, name: "Prompt", prefix: "", suffix: "" },
  { level: 1, name: "Sub-prompt", prefix: "", suffix: "" },
  { level: 2, name: "Task", prefix: "", suffix: "" },
];

// General Settings Section - Connected to real settings
const GeneralSection = ({ settings = {}, onUpdateSetting, models = [], isLoadingSettings }) => {
  const [editedValues, setEditedValues] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const { retentionMinutes, updateRetention, undoStack, clearAllUndo } = useUndo();
  const [localRetention, setLocalRetention] = useState(retentionMinutes);
  const { build: githubBuild, releaseUrl, releaseDate, isLoading: isBuildLoading, error: buildError } = useBuildInfo();

  // Sync local retention with context
  useEffect(() => {
    setLocalRetention(retentionMinutes);
  }, [retentionMinutes]);

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

  const handleRetentionChange = (value) => {
    const numValue = parseInt(value) || 30;
    setLocalRetention(numValue);
  };

  const handleRetentionSave = () => {
    updateRetention(localRetention);
    toast.success(`Undo history retention set to ${localRetention} minutes`);
    trackEvent('undo_retention_updated', { retention_minutes: localRetention });
  };

  const getValue = (key, fallback = '') => {
    if (editedValues[key] !== undefined) return editedValues[key];
    return settings[key]?.value || fallback;
  };

  const hasChanges = (key) => {
    return editedValues[key] !== undefined && editedValues[key] !== (settings[key]?.value || '');
  };

  const hasRetentionChanges = localRetention !== retentionMinutes;

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
          <SettingRow label="Build" description={releaseDate ? `Released ${releaseDate}` : "Latest GitHub release"}>
            <div className="flex items-center gap-2">
              {isBuildLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant" />
              ) : buildError ? (
                <span className="text-body-sm text-on-surface-variant">—</span>
              ) : (
                <>
                  <span className="text-body-sm text-on-surface font-mono">{githubBuild || '—'}</span>
                  {releaseUrl && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={releaseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] hover:text-primary"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent className="text-[10px]">View release on GitHub</TooltipContent>
                    </Tooltip>
                  )}
                </>
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

      {/* Undo History Settings */}
      <SettingCard label="Undo History">
        <div className="space-y-3">
          <SettingRow 
            label="Auto-cleanup after" 
            description="Undo actions older than this will be automatically removed"
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="1440"
                value={localRetention}
                onChange={(e) => handleRetentionChange(e.target.value)}
                className="h-8 w-20 px-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-body-sm text-on-surface-variant">minutes</span>
              {hasRetentionChanges && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleRetentionSave}
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
          <SettingRow 
            label="Current history" 
            description={`${undoStack.length} action${undoStack.length !== 1 ? 's' : ''} in undo history`}
          >
            <div className="flex items-center gap-2">
              {undoStack.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        clearAllUndo();
                        toast.success('Undo history cleared');
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Clear all history</TooltipContent>
                </Tooltip>
              )}
              <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-container rounded-m3-sm">
                <History className="h-3.5 w-3.5 text-on-surface-variant" />
                <span className="text-body-sm text-on-surface">{undoStack.length}</span>
              </div>
            </div>
          </SettingRow>
        </div>
      </SettingCard>

      {/* UI State Settings */}
      <SettingCard label="UI State">
        <div className="space-y-3">
          <SettingRow 
            label="Reset UI preferences" 
            description="Clear saved panel states, tree expansion, and selected items"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    // List of all localStorage keys used for UI state
                    const uiStateKeys = [
                      'qonsol-folder-panel-open',
                      'qonsol-conversation-panel-open',
                      'qonsol-active-nav',
                      'qonsol-selected-prompt-id',
                      'qonsol-expanded-folders',
                    ];
                    // Also clear all prompt/output height keys and panel layout
                    Object.keys(localStorage).forEach(key => {
                      if (key.startsWith('qonsol-prompt-height-') || 
                          key.startsWith('qonsol-output-height-') ||
                          key.startsWith('react-resizable-panels:')) {
                        localStorage.removeItem(key);
                      }
                    });
                    uiStateKeys.forEach(key => localStorage.removeItem(key));
                    toast.success('UI state reset. Refresh to apply defaults.');
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] hover:text-destructive"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Reset UI State</TooltipContent>
            </Tooltip>
          </SettingRow>
        </div>
      </SettingCard>
    </div>
  );
};

// Prompt Naming Section - Connected to q_settings
const PromptNamingSection = ({ settings = {}, onUpdateSetting }) => {
  const [levels, setLevels] = useState(DEFAULT_NAMING_LEVELS);
  const [expandedSet, setExpandedSet] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load from settings on mount
  useEffect(() => {
    const savedNaming = settings['prompt_naming_defaults']?.value;
    if (savedNaming) {
      try {
        const parsed = JSON.parse(savedNaming);
        if (parsed.levels && Array.isArray(parsed.levels)) {
          setLevels(parsed.levels);
        }
      } catch (e) {
        console.error('Failed to parse naming defaults:', e);
      }
    }
  }, [settings]);

  const handleLevelChange = (index, field, value) => {
    setLevels(prev => prev.map((lvl, i) => 
      i === index ? { ...lvl, [field]: value } : lvl
    ));
    setHasChanges(true);
  };

  const handleAddLevel = () => {
    setLevels(prev => [...prev, { level: prev.length, name: `Level ${prev.length}`, prefix: "", suffix: "" }]);
    setHasChanges(true);
  };

  const handleRemoveLevel = (index) => {
    if (levels.length <= 1) return;
    setLevels(prev => prev.filter((_, i) => i !== index).map((lvl, i) => ({ ...lvl, level: i })));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!onUpdateSetting) return;
    setIsSaving(true);
    try {
      await onUpdateSetting('prompt_naming_defaults', JSON.stringify({ levels }));
      setHasChanges(false);
      toast.success('Naming defaults saved');
    } catch (e) {
      toast.error('Failed to save naming defaults');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Template Codes Help */}
      <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-m3-lg">
        <p className="text-body-sm text-on-surface-variant">
          Use template codes in prefix/suffix fields for dynamic naming.
        </p>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-8 h-8 flex items-center justify-center rounded-m3-full text-primary hover:bg-on-surface/[0.08]"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Save Changes</TooltipContent>
            </Tooltip>
          )}
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
            <div key={index} className="grid grid-cols-[40px,1fr,1fr,1fr,100px,40px] gap-2 items-center p-2 bg-surface-container rounded-m3-sm">
              <span className="text-body-sm text-on-surface-variant">{index}</span>
              <input 
                type="text" 
                value={level.name}
                onChange={(e) => handleLevelChange(index, 'name', e.target.value)}
                className="h-7 px-2 bg-surface-container-high rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input 
                type="text" 
                value={level.prefix}
                onChange={(e) => handleLevelChange(index, 'prefix', e.target.value)}
                placeholder="Prefix"
                className="h-7 px-2 bg-surface-container-high rounded-m3-sm border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input 
                type="text" 
                value={level.suffix}
                onChange={(e) => handleLevelChange(index, 'suffix', e.target.value)}
                placeholder="Suffix"
                className="h-7 px-2 bg-surface-container-high rounded-m3-sm border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-[10px] text-on-surface-variant truncate">{level.prefix}{level.name}{level.suffix}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={() => handleRemoveLevel(index)}
                    disabled={levels.length <= 1}
                    className={`w-6 h-6 flex items-center justify-center rounded-m3-full hover:bg-on-surface/[0.08] ${levels.length <= 1 ? 'opacity-30' : 'text-destructive'}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Remove Level</TooltipContent>
              </Tooltip>
            </div>
          ))}
          
          {/* Add Level */}
          <button 
            onClick={handleAddLevel}
            className="flex items-center gap-1.5 px-2 py-1.5 text-body-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
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
                  <span className="text-tree text-on-surface-variant truncate">{conv.model_override || conv.model || '-'}</span>
                  <span className="text-tree text-on-surface-variant truncate">{conv.prompt_name || "-"}</span>
                  <span className="text-tree text-on-surface-variant">{formatDate(conv.created_at)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </SettingCard>
    </div>
  );
};

// AI Models Section - Uses real data from database with per-model usage stats and inline settings
const AIModelsSection = ({ models = [], isLoading = false, onToggleModel, onAddModel, onUpdateModel, onDeleteModel, settings = {}, onUpdateSetting }) => {
  const [expandedModel, setExpandedModel] = useState(null);
  const [usagePeriod, setUsagePeriod] = useState('all');
  const [modelUsage, setModelUsage] = useState({});
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [formData, setFormData] = useState({
    model_id: '',
    model_name: '',
    provider: 'openai',
    context_window: '',
    max_output_tokens: '',
    input_cost_per_million: '',
    output_cost_per_million: '',
    supports_temperature: true,
    api_model_id: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  // Fetch usage stats from q_ai_costs
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        setLoadingUsage(true);
        let query = supabase
          .from(import.meta.env.VITE_AI_COSTS_TBL || 'q_ai_costs')
          .select('model, tokens_input, tokens_output, cost_total_usd');
        
        if (usagePeriod === '30days') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          query = query.gte('created_at', thirtyDaysAgo.toISOString());
        } else if (usagePeriod === '7days') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          query = query.gte('created_at', sevenDaysAgo.toISOString());
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        // Aggregate by model
        const aggregated = {};
        (data || []).forEach(row => {
          const modelId = row.model || 'unknown';
          if (!aggregated[modelId]) {
            aggregated[modelId] = { totalTokens: 0, totalCost: 0, callCount: 0 };
          }
          aggregated[modelId].totalTokens += (row.tokens_input || 0) + (row.tokens_output || 0);
          aggregated[modelId].totalCost += parseFloat(row.cost_total_usd) || 0;
          aggregated[modelId].callCount += 1;
        });
        setModelUsage(aggregated);
      } catch (error) {
        console.error('Error fetching model usage:', error);
      } finally {
        setLoadingUsage(false);
      }
    };
    fetchUsage();
  }, [usagePeriod]);

  const getUsageForModel = (modelId) => {
    if (modelUsage[modelId]) return modelUsage[modelId];
    for (const [key, value] of Object.entries(modelUsage)) {
      if (key.startsWith(modelId) || modelId.startsWith(key)) {
        return value;
      }
    }
    return { totalTokens: 0, totalCost: 0, callCount: 0 };
  };

  const formatTokens = (tokens) => {
    if (tokens === null || tokens === undefined) return 'N/A';
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  const handleToggle = (modelId) => {
    if (onToggleModel) {
      onToggleModel(modelId);
    }
  };

  const resetForm = () => {
    setFormData({
      model_id: '',
      model_name: '',
      provider: 'openai',
      context_window: '',
      max_output_tokens: '',
      input_cost_per_million: '',
      output_cost_per_million: '',
      supports_temperature: true,
      api_model_id: '',
    });
    setShowAddForm(false);
    setEditingModel(null);
  };

  const handleEdit = (model) => {
    setEditingModel(model.row_id);
    setFormData({
      model_id: model.model_id || '',
      model_name: model.model_name || '',
      provider: model.provider || 'openai',
      context_window: model.context_window?.toString() || '',
      max_output_tokens: model.max_output_tokens?.toString() || '',
      input_cost_per_million: model.input_cost_per_million?.toString() || '',
      output_cost_per_million: model.output_cost_per_million?.toString() || '',
      supports_temperature: model.supports_temperature ?? true,
      api_model_id: model.api_model_id || '',
    });
    setShowAddForm(false);
  };

  const handleSave = async () => {
    if (!formData.model_id || !formData.model_name) {
      toast.error('Model ID and Name are required');
      return;
    }

    const modelData = {
      model_id: formData.model_id,
      model_name: formData.model_name,
      provider: formData.provider,
      context_window: formData.context_window ? parseInt(formData.context_window) : null,
      max_output_tokens: formData.max_output_tokens ? parseInt(formData.max_output_tokens) : null,
      input_cost_per_million: formData.input_cost_per_million ? parseFloat(formData.input_cost_per_million) : null,
      output_cost_per_million: formData.output_cost_per_million ? parseFloat(formData.output_cost_per_million) : null,
      supports_temperature: formData.supports_temperature,
      api_model_id: formData.api_model_id || formData.model_id,
    };

    if (editingModel) {
      await onUpdateModel?.(editingModel, modelData);
    } else {
      await onAddModel?.(modelData);
    }
    resetForm();
  };

  const handleDelete = async (rowId) => {
    await onDeleteModel?.(rowId);
    setDeleteConfirm(null);
  };

  // Form component for add/edit
  const ModelForm = ({ isEditing }) => (
    <div className="p-3 bg-surface-container-low rounded-m3-md border border-outline-variant space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-body-sm text-on-surface font-medium">{isEditing ? 'Edit Model' : 'Add New Model'}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={resetForm} className="w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
              <X className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">Cancel</TooltipContent>
        </Tooltip>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Model ID *</label>
          <input
            type="text"
            value={formData.model_id}
            onChange={(e) => setFormData(prev => ({ ...prev, model_id: e.target.value }))}
            placeholder="gpt-4o"
            disabled={isEditing}
            className="w-full h-8 px-2 mt-1 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Display Name *</label>
          <input
            type="text"
            value={formData.model_name}
            onChange={(e) => setFormData(prev => ({ ...prev, model_name: e.target.value }))}
            placeholder="GPT-4o"
            className="w-full h-8 px-2 mt-1 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Provider</label>
          <select
            value={formData.provider}
            onChange={(e) => setFormData(prev => ({ ...prev, provider: e.target.value }))}
            className="w-full h-8 px-2 mt-1 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">API Model ID</label>
          <input
            type="text"
            value={formData.api_model_id}
            onChange={(e) => setFormData(prev => ({ ...prev, api_model_id: e.target.value }))}
            placeholder="Same as Model ID if empty"
            className="w-full h-8 px-2 mt-1 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Context Window</label>
          <input
            type="number"
            value={formData.context_window}
            onChange={(e) => setFormData(prev => ({ ...prev, context_window: e.target.value }))}
            placeholder="128000"
            className="w-full h-8 px-2 mt-1 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Max Output Tokens</label>
          <input
            type="number"
            value={formData.max_output_tokens}
            onChange={(e) => setFormData(prev => ({ ...prev, max_output_tokens: e.target.value }))}
            placeholder="4096"
            className="w-full h-8 px-2 mt-1 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Input Cost ($/1M tokens)</label>
          <input
            type="number"
            step="0.01"
            value={formData.input_cost_per_million}
            onChange={(e) => setFormData(prev => ({ ...prev, input_cost_per_million: e.target.value }))}
            placeholder="2.50"
            className="w-full h-8 px-2 mt-1 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Output Cost ($/1M tokens)</label>
          <input
            type="number"
            step="0.01"
            value={formData.output_cost_per_million}
            onChange={(e) => setFormData(prev => ({ ...prev, output_cost_per_million: e.target.value }))}
            placeholder="10.00"
            className="w-full h-8 px-2 mt-1 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Checkbox 
          id="supports_temp" 
          checked={formData.supports_temperature}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, supports_temperature: checked }))}
        />
        <label htmlFor="supports_temp" className="text-body-sm text-on-surface">Supports Temperature</label>
      </div>
      
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={resetForm}
          className="px-3 h-8 text-body-sm text-on-surface-variant hover:bg-on-surface/[0.08] rounded-m3-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-3 h-8 text-body-sm bg-primary text-on-primary rounded-m3-sm hover:bg-primary/90 flex items-center gap-1"
        >
          <Save className="h-4 w-4" />
          {isEditing ? 'Update' : 'Add Model'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Period Selector and Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-body-sm text-on-surface-variant">Usage period:</span>
          <select
            value={usagePeriod}
            onChange={(e) => setUsagePeriod(e.target.value)}
            className="h-7 px-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Time</option>
            <option value="30days">Last 30 Days</option>
            <option value="7days">Last 7 Days</option>
          </select>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => { setShowAddForm(true); setEditingModel(null); resetForm(); setShowAddForm(true); }}
              className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
            >
              <Plus className="h-5 w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">Add Model</TooltipContent>
        </Tooltip>
      </div>

      {/* Add Form */}
      {showAddForm && <ModelForm isEditing={false} />}

      {/* Edit Form (shown inline when editing) */}
      {editingModel && <ModelForm isEditing={true} />}

      <SettingCard label="Available Models">
        <div className="space-y-1">
          {/* Table Header */}
          <div className="grid grid-cols-[1fr,90px,80px,60px,70px] gap-2 px-3 py-2 text-[10px] text-on-surface-variant uppercase tracking-wider">
            <span>Model</span>
            <span className="text-right">Tokens Used</span>
            <span className="text-right">Cost Spent</span>
            <span className="text-center">Active</span>
            <span className="text-center">Actions</span>
          </div>
          
          {isLoading ? (
            <div className="flex items-center gap-2 py-4 px-3">
              <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant" />
              <span className="text-body-sm text-on-surface-variant">Loading models...</span>
            </div>
          ) : models.length === 0 ? (
            <div className="p-4 text-center">
              <Cpu className="h-8 w-8 text-on-surface-variant mx-auto mb-2" />
              <p className="text-body-sm text-on-surface-variant">No models configured.</p>
              <p className="text-[10px] text-on-surface-variant mt-1">Click the + button above to add a model.</p>
            </div>
          ) : (
            models.map((model, i) => {
              const usage = getUsageForModel(model.model_id);
              const isExpanded = expandedModel === model.model_id;
              
              return (
                <div key={model.model_id || model.row_id}>
                  {i > 0 && <SettingDivider />}
                  {/* Model Row */}
                  <div className="grid grid-cols-[1fr,90px,80px,60px,70px] gap-2 px-3 py-2 items-center">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpandedModel(isExpanded ? null : model.model_id)}
                        className="w-5 h-5 flex items-center justify-center rounded text-on-surface-variant hover:bg-on-surface/[0.08]"
                      >
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                      <div>
                        <span className="text-body-sm text-on-surface font-medium">{model.model_name}</span>
                        <span className="text-[10px] text-on-surface-variant ml-2">{model.provider || 'openai'}</span>
                      </div>
                    </div>
                    <span className="text-body-sm text-on-surface-variant text-right">
                      {loadingUsage ? '...' : formatTokens(usage.totalTokens)}
                    </span>
                    <span className="text-body-sm text-on-surface-variant text-right">
                      {loadingUsage ? '...' : `$${usage.totalCost.toFixed(2)}`}
                    </span>
                    <div className="flex justify-center">
                      <Switch 
                        checked={model.is_active ?? true} 
                        onCheckedChange={() => handleToggle(model.model_id)} 
                      />
                    </div>
                    <div className="flex justify-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleEdit(model)}
                            className="w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px]">Edit</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setDeleteConfirm(model.row_id)}
                            className="w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-red-500/10 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px]">Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  
                  {/* Delete Confirmation */}
                  {deleteConfirm === model.row_id && (
                    <div className="px-3 py-2 bg-red-500/10 border-t border-outline-variant flex items-center justify-between">
                      <span className="text-body-sm text-red-500">Delete {model.model_name}?</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2 h-6 text-tree text-on-surface-variant hover:bg-on-surface/[0.08] rounded"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(model.row_id)}
                          className="px-2 h-6 text-tree bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Expanded Settings Panel */}
                  {isExpanded && (
                    <div className="px-3 py-3 bg-surface-container-low border-t border-outline-variant">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-tree">
                        <div>
                          <span className="text-on-surface-variant">Context Window:</span>
                          <span className="text-on-surface ml-1 font-medium">{model.context_window ? formatTokens(model.context_window) : 'Not set'}</span>
                        </div>
                        <div>
                          <span className="text-on-surface-variant">Max Output:</span>
                          <span className="text-on-surface ml-1 font-medium">{model.max_output_tokens ? formatTokens(model.max_output_tokens) : 'Not set'}</span>
                        </div>
                        <div>
                          <span className="text-on-surface-variant">API Model:</span>
                          <span className="text-on-surface ml-1 font-mono">{model.api_model_id || model.model_id}</span>
                        </div>
                        <div>
                          <span className="text-on-surface-variant">Temperature:</span>
                          <span className={`ml-1 font-medium ${model.supports_temperature ? 'text-green-600' : 'text-red-500'}`}>
                            {model.supports_temperature ? 'Supported' : 'Not Supported'}
                          </span>
                        </div>
                        <div>
                          <span className="text-on-surface-variant">Input Cost:</span>
                          <span className="text-on-surface ml-1 font-medium">{model.input_cost_per_million ? `$${model.input_cost_per_million}/1M` : 'Not set'}</span>
                        </div>
                        <div>
                          <span className="text-on-surface-variant">Output Cost:</span>
                          <span className="text-on-surface ml-1 font-medium">{model.output_cost_per_million ? `$${model.output_cost_per_million}/1M` : 'Not set'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </SettingCard>
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
              <span className={`text-tree ${theme === option.id ? "text-secondary-container-foreground font-medium" : "text-on-surface-variant"}`}>
                {option.label}
              </span>
              {theme === option.id && <Check className="h-3.5 w-3.5 text-secondary-container-foreground" />}
            </button>
          ))}
        </div>
      </SettingCard>

    </div>
  );
};

// Notifications Section - Connected to q_settings
const NotificationsSection = ({ settings = {}, onUpdateSetting }) => {
  const [prefs, setPrefs] = useState({
    email_notifications: true,
    cascade_completion: true,
    error_alerts: true,
    usage_warnings: false,
  });
  const [isSaving, setIsSaving] = useState({});

  // Load from settings on mount
  useEffect(() => {
    const savedPrefs = settings['notification_preferences']?.value;
    if (savedPrefs) {
      try {
        const parsed = JSON.parse(savedPrefs);
        setPrefs(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Failed to parse notification preferences:', e);
      }
    }
  }, [settings]);

  const handleToggle = async (key, value) => {
    if (!onUpdateSetting) return;
    
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    setIsSaving(prev => ({ ...prev, [key]: true }));
    
    try {
      await onUpdateSetting('notification_preferences', JSON.stringify(newPrefs));
    } catch (e) {
      // Revert on error
      setPrefs(prefs);
      toast.error('Failed to save preference');
    } finally {
      setIsSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  return (
    <SettingCard>
      <div className="space-y-3">
        <SettingRow label="Email notifications" description="Receive updates via email">
          <Switch 
            checked={prefs.email_notifications} 
            onCheckedChange={(v) => handleToggle('email_notifications', v)}
            disabled={isSaving.email_notifications}
          />
        </SettingRow>
        <SettingDivider />
        <SettingRow label="Cascade completion" description="Notify when cascades finish">
          <Switch 
            checked={prefs.cascade_completion} 
            onCheckedChange={(v) => handleToggle('cascade_completion', v)}
            disabled={isSaving.cascade_completion}
          />
        </SettingRow>
        <SettingDivider />
        <SettingRow label="Error alerts" description="Get notified about failures">
          <Switch 
            checked={prefs.error_alerts} 
            onCheckedChange={(v) => handleToggle('error_alerts', v)}
            disabled={isSaving.error_alerts}
          />
        </SettingRow>
        <SettingDivider />
        <SettingRow label="Usage warnings" description="Alert when approaching limits">
          <Switch 
            checked={prefs.usage_warnings} 
            onCheckedChange={(v) => handleToggle('usage_warnings', v)}
            disabled={isSaving.usage_warnings}
          />
        </SettingRow>
      </div>
    </SettingCard>
  );
};

// Profile Section - Connected to auth context
const ProfileSection = () => {
  const { user, userProfile } = useAuth();
  
  const displayName = userProfile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const email = userProfile?.email || user?.email || 'No email';
  const avatarUrl = userProfile?.avatar_url || user?.user_metadata?.avatar_url;

  return (
    <SettingCard>
      <div className="flex items-center gap-3 mb-4">
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt={displayName}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-tertiary-container flex items-center justify-center">
            <User className="h-6 w-6 text-on-surface-variant" />
          </div>
        )}
        <div>
          <h4 className="text-title-sm text-on-surface font-medium">{displayName}</h4>
          <p className="text-body-sm text-on-surface-variant">{email}</p>
        </div>
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-on-surface-variant">Display Name</label>
          <input 
            type="text"
            value={displayName}
            readOnly
            className="w-full h-8 px-2.5 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-on-surface-variant">Email</label>
          <input 
            type="text"
            value={email}
            readOnly
            className="w-full h-8 px-2.5 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface-variant"
          />
        </div>
        <p className="text-[10px] text-on-surface-variant/70 italic">
          Profile is managed through your Google account.
        </p>
      </div>
    </SettingCard>
  );
};

// Confluence Section - Connected to real settings with integrated credential management
const ConfluenceSection = ({ settings = {}, onUpdateSetting }) => {
  const { 
    credentialStatus, 
    getCredentialStatus, 
    setCredential, 
    deleteCredential,
    isServiceConfigured,
    isLoading: isCredLoading 
  } = useUserCredentials();
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [confluenceEmail, setConfluenceEmail] = useState('');
  const [confluenceToken, setConfluenceToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [editedUrl, setEditedUrl] = useState('');
  const [hasUrlChanges, setHasUrlChanges] = useState(false);
  
  // Fetch credential status on mount
  useEffect(() => {
    getCredentialStatus('confluence');
  }, [getCredentialStatus]);
  
  // Check if confluence is configured - base URL from settings, credentials per-user
  const confluenceUrl = settings['confluence_base_url']?.value || settings['CONFLUENCE_URL']?.value || settings['confluence_url']?.value || '';
  const hasUserCredentials = isServiceConfigured('confluence');
  const isConnected = !!(confluenceUrl && hasUserCredentials);
  
  // Sync edited URL with settings
  useEffect(() => {
    setEditedUrl(confluenceUrl);
    setHasUrlChanges(false);
  }, [confluenceUrl]);
  
  const autoSync = settings['confluence_auto_sync']?.value === 'true';

  const handleUrlChange = (value) => {
    setEditedUrl(value);
    setHasUrlChanges(value !== confluenceUrl);
  };

  const handleSaveUrl = async () => {
    if (!onUpdateSetting || !editedUrl.trim()) return;
    setIsSaving(true);
    try {
      await onUpdateSetting('confluence_base_url', editedUrl.trim());
      setHasUrlChanges(false);
      toast.success('Confluence URL saved');
      trackEvent('confluence_url_saved');
    } catch {
      toast.error('Failed to save URL');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAutoSync = async (value) => {
    if (!onUpdateSetting) return;
    try {
      await onUpdateSetting('confluence_auto_sync', value ? 'true' : 'false');
    } catch {
      toast.error('Failed to save');
    }
  };

  const handleSaveCredentials = async () => {
    if (!confluenceEmail || !confluenceToken) {
      toast.error('Both email and API token are required');
      return;
    }
    setIsSaving(true);
    try {
      await setCredential('confluence', 'email', confluenceEmail);
      await setCredential('confluence', 'api_token', confluenceToken);
      toast.success('Confluence credentials saved securely');
      setConfluenceEmail('');
      setConfluenceToken('');
      await getCredentialStatus('confluence');
      trackEvent('confluence_credentials_saved');
    } catch (error) {
      toast.error('Failed to save credentials');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCredentials = async () => {
    setIsSaving(true);
    try {
      await deleteCredential('confluence');
      toast.success('Confluence credentials removed');
      await getCredentialStatus('confluence');
      trackEvent('confluence_credentials_deleted');
    } catch (error) {
      toast.error('Failed to remove credentials');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke('confluence-manager', {
        body: { action: 'test-connection' }
      });
      if (error) {
        setConnectionStatus({ success: false, message: error.message });
      } else if (data?.success) {
        setConnectionStatus({ success: true, message: `Connected! Found ${data.spaces || 0} spaces.` });
        trackEvent('confluence_connection_test_success');
      } else {
        setConnectionStatus({ success: false, message: data?.message || 'Connection failed' });
      }
    } catch (err) {
      setConnectionStatus({ success: false, message: err.message || 'Connection failed' });
    } finally {
      setIsTesting(false);
    }
  };

  // Extract domain from URL for display
  let displayDomain = 'Not configured';
  if (confluenceUrl) {
    try {
      const url = new URL(confluenceUrl.startsWith('http') ? confluenceUrl : `https://${confluenceUrl}`);
      displayDomain = url.hostname;
    } catch {
      displayDomain = confluenceUrl;
    }
  }

  return (
    <div className="space-y-4">
      {/* Connection Status Card */}
      <SettingCard label="Connection">
        <div className="flex items-center gap-3 mb-3">
          <Link2 className="h-5 w-5 text-on-surface-variant" />
          <div className="flex-1">
            <h4 className="text-body-sm text-on-surface font-medium">
              {isConnected ? 'Connected' : 'Not Connected'}
            </h4>
            <p className="text-[10px] text-on-surface-variant">{displayDomain}</p>
          </div>
          {isConnected ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600">Active</span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600">Incomplete</span>
          )}
        </div>

        {/* Test Connection */}
        {hasUserCredentials && confluenceUrl && (
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] disabled:opacity-50"
                  >
                    {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Test Connection</TooltipContent>
              </Tooltip>
              {connectionStatus && (
                <span className={`text-[10px] ${connectionStatus.success ? 'text-green-600' : 'text-red-500'}`}>
                  {connectionStatus.message}
                </span>
              )}
            </div>
          </div>
        )}
      </SettingCard>

      {/* Base URL Card */}
      <SettingCard label="Confluence URL">
        <SettingRow label="Base URL" description="Your Atlassian Cloud URL (e.g. https://company.atlassian.net)">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editedUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://company.atlassian.net"
              className="h-8 w-56 px-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {hasUrlChanges && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleSaveUrl}
                    disabled={isSaving || !editedUrl.trim()}
                    className="w-8 h-8 flex items-center justify-center rounded-m3-full text-primary hover:bg-on-surface/[0.08] disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Save URL</TooltipContent>
              </Tooltip>
            )}
          </div>
        </SettingRow>
      </SettingCard>

      {/* Credentials Card */}
      <SettingCard label="Credentials">
        <div className="flex items-center gap-3 mb-3">
          <Key className="h-5 w-5 text-on-surface-variant" />
          <div className="flex-1">
            <h4 className="text-body-sm text-on-surface font-medium">
              {hasUserCredentials ? 'Configured' : 'Not Set'}
            </h4>
            <p className="text-[10px] text-on-surface-variant">
              {hasUserCredentials 
                ? 'Your Confluence credentials are stored securely' 
                : 'Add your Atlassian email and API token'}
            </p>
          </div>
          {hasUserCredentials ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600">Set</span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600">Not Set</span>
          )}
        </div>
        
        <div className="space-y-3">
          <SettingRow label="Email" description="Your Atlassian account email">
            <input
              type="email"
              value={confluenceEmail}
              onChange={(e) => setConfluenceEmail(e.target.value)}
              placeholder={hasUserCredentials ? "••••••••" : "email@company.com"}
              className="h-8 w-48 px-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </SettingRow>
          
          <SettingDivider />
          
          <SettingRow label="API Token" description="Generate at id.atlassian.com">
            <div className="flex items-center gap-2">
              <input
                type={showToken ? "text" : "password"}
                value={confluenceToken}
                onChange={(e) => setConfluenceToken(e.target.value)}
                placeholder={hasUserCredentials ? "••••••••" : "Enter token"}
                className="h-8 w-40 px-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">{showToken ? 'Hide' : 'Show'}</TooltipContent>
              </Tooltip>
            </div>
          </SettingRow>
          
          <div className="flex items-center justify-between pt-2">
            <a 
              href="https://id.atlassian.com/manage-profile/security/api-tokens" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[10px] text-primary hover:underline flex items-center gap-1"
            >
              Generate API Token <ExternalLink className="h-3 w-3" />
            </a>
            <div className="flex items-center gap-2">
              {hasUserCredentials && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleDeleteCredentials}
                      disabled={isSaving || isCredLoading}
                      className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Remove credentials</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleSaveCredentials}
                    disabled={isSaving || isCredLoading || (!confluenceEmail && !confluenceToken)}
                    className="w-8 h-8 flex items-center justify-center rounded-m3-full text-primary hover:bg-on-surface/[0.08] disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Save credentials</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </SettingCard>

      {/* Settings Card */}
      <SettingCard label="Settings">
        <div className="space-y-3">
          <SettingRow label="Auto-sync pages" description="Sync linked pages automatically">
            <Switch 
              checked={autoSync} 
              onCheckedChange={handleToggleAutoSync}
              disabled={!isConnected}
            />
          </SettingRow>
        </div>
      </SettingCard>
    </div>
  );
};

// Knowledge Base Section (Admin only) - moved up after removing Workbench

// Knowledge Base Section (Admin only)
const KnowledgeSection = () => <KnowledgeManager />;

// Settings Sections Configuration
const SETTINGS_SECTIONS = {
  "qonsol": { component: GeneralSection, icon: Settings, title: "General" },
  "naming": { component: PromptNamingSection, icon: Type, title: "Prompt Naming" },
  "models": { component: AIModelsSection, icon: Cpu, title: "AI Models" },
  "assistants": { component: ConversationDefaultsSection, icon: MessageSquare, title: "Conversation Defaults" },
  "conversations": { component: ConversationsSection, icon: MessageSquare, title: "Conversations" },
  "confluence": { component: ConfluenceSection, icon: FileText, title: "Confluence" },
  "appearance": { component: ThemeSection, icon: Palette, title: "Appearance" },
  "notifications": { component: NotificationsSection, icon: Bell, title: "Notifications" },
  "profile": { component: ProfileSection, icon: User, title: "Profile" },
  "knowledge": { component: KnowledgeSection, icon: BookOpen, title: "Knowledge Base" },
};

const SettingsContent = ({ 
  activeSubItem = "qonsol",
  settings = {},
  isLoadingSettings = false,
  onUpdateSetting,
  models = [],
  isLoadingModels = false,
  onToggleModel,
  onAddModel,
  onUpdateModel,
  onDeleteModel,
  costTracking,
  conversationToolDefaults,
}) => {
  // Special case: Trash has its own full-page component
  if (activeSubItem === 'trash') {
    return <DeletedItemsContent />;
  }

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
          onAddModel,
          onUpdateModel,
          onDeleteModel,
          settings,
          onUpdateSetting,
        };
      case 'assistants':
        return { ...commonSettingsProps, conversationToolDefaults };
      case 'naming':
        return commonSettingsProps;
      case 'confluence':
        return commonSettingsProps;
      case 'notifications':
        return commonSettingsProps;
      case 'profile':
        return {};
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

export default SettingsContent;
