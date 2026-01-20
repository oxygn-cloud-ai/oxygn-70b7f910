import { useState, useEffect, useMemo, useRef } from "react";
import { useTimer } from "@/hooks/useTimer";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  FileText, Sliders, Variable, MessageSquare, Play, Copy, 
  Download, MoreVertical, Star, Trash2, Share2, Link2, 
  Hash, List, Braces, ToggleLeft, Library, ChevronDown, 
  Search, Plus, PanelRightOpen, PanelLeftOpen, PanelLeftClose, Workflow, Bot, Thermometer,
  Zap, Code, Globe, Edit3, Check, X, User, Sparkles, Briefcase,
  Clock, Send, ArrowRight, Database, Settings, Eye, EyeOff,
  RefreshCw, ChevronRight, AlertCircle, Info, Loader2, GitBranch, GitCommit,
  Paperclip, Upload, Square, Target, Minimize2, LayoutDashboard,
  SkipForward, AlertTriangle, MessageCircleQuestion
} from "lucide-react";
import { usePromptVersions } from "@/hooks/usePromptVersions";
import { VersionHistoryPanel, CommitDialog } from "@/components/versions";
import ConfluenceSearchModal from "@/components/ConfluenceSearchModal";
import { useConversationFiles } from "@/hooks/useConversationFiles";
import { useConfluencePages } from "@/hooks/useConfluencePages";
import VariablesTabContent from "./VariablesTabContent";
import DashboardTabContent from "./DashboardTabContent";
import FilesPagesSection from "@/components/FilesPagesSection";
import ConfluencePagesSection from "@/components/ConfluencePagesSection";
import QuestionNodeSettings from "@/components/QuestionNodeSettings";
import ActionNodeSettings from "@/components/ActionNodeSettings";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { LabelPicker } from "@/components/ui/label-picker";
import { LabelBadge } from "@/components/ui/label-badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SettingSelect, SettingModelSelect } from "@/components/ui/setting-select";
import { 
  EmptyVariables, 
  ResizablePromptArea, ResizableOutputArea, VariablePicker,
  EmptyConversation,
  EmptyOutput 
} from "@/components/shared";
import MarkdownNotesArea from "@/components/shared/MarkdownNotesArea";
// Variable definitions for hover tooltips
const VARIABLE_DEFINITIONS = {
  customer_message: { name: "customer_message", type: "text", description: "The customer's original inquiry or message", source: "User Input", required: true },
  ticket_count: { name: "ticket_count", type: "number", description: "Number of previous support tickets", source: "Database", required: false, default: "0" },
  company_name: { name: "company_name", type: "text", description: "Name of the company", source: "Settings", required: true },
  support_email: { name: "support_email", type: "text", description: "Support contact email address", source: "Settings", required: true },
  parent_output: { name: "parent.output", type: "reference", description: "Output from parent prompt", source: "Cascade", required: false },
};

// No mock data - all data comes from props

// Component to render text with highlighted variables
const HighlightedText = ({ text }) => {
  const variablePattern = /\{\{(\w+(?:\.\w+)?)\}\}/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = variablePattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
    }
    
    const varName = match[1];
    const varDef = VARIABLE_DEFINITIONS[varName] || VARIABLE_DEFINITIONS[varName.replace('.', '_')];
    
    parts.push(
      <Tooltip key={`var-${match.index}`}>
        <TooltipTrigger asChild>
          <span className="text-primary font-medium cursor-help bg-primary/10 px-0.5 rounded">
            {`{{${varName}}}`}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs p-2 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-label-sm font-medium text-on-surface">{varName}</span>
            <span className="text-[10px] px-1 py-0.5 rounded bg-secondary-container text-secondary-container-foreground">{varDef?.type || "text"}</span>
            {varDef?.required && <span className="text-[10px] text-destructive">*required</span>}
          </div>
          {varDef?.description && (
            <p className="text-[10px] text-on-surface-variant">{varDef.description}</p>
          )}
          {varDef?.source && (
            <p className="text-[10px] text-on-surface-variant">Source: {varDef.source}</p>
          )}
        </TooltipContent>
      </Tooltip>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }
  
  return <>{parts}</>;
};

const TabButton = ({ icon: Icon, label, isActive, onClick, badge }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={onClick}
        className={`h-8 w-9 flex items-center justify-center rounded-m3-sm transition-all duration-200 relative ${
          isActive 
            ? "bg-secondary-container text-secondary-container-foreground" 
            : "text-on-surface-variant hover:bg-on-surface/[0.08] hover:scale-105"
        }`}
      >
        <Icon className="h-4 w-4" />
        {badge && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full animate-pulse" />
        )}
      </button>
    </TooltipTrigger>
    <TooltipContent className="text-[10px]">{label}</TooltipContent>
  </Tooltip>
);

const VariableTypeIcon = ({ type }) => {
  // All variable types use the Braces icon for consistency
  return <Braces className="h-3.5 w-3.5 text-on-surface-variant" />;
};

const SourceIcon = ({ source }) => {
  const icons = {
    input: User,
    database: Database,
    settings: Settings,
    secret: EyeOff,
    cascade: ArrowRight,
    api: Globe
  };
  const Icon = icons[source] || Variable;
  return <Icon className="h-3 w-3" />;
};

const LibraryPickerDropdown = ({ libraryItems = [] }) => {
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredPrompts = libraryItems.filter(prompt => 
    (prompt.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button className="w-6 h-6 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
              <Library className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent className="text-[10px]">Insert from Library</TooltipContent>
      </Tooltip>
      <DropdownMenuContent className="w-52 bg-surface-container-high border-outline-variant">
        <div className="px-2 py-1 text-[10px] text-on-surface-variant uppercase tracking-wider">Library Prompts</div>
        <div className="px-2 pb-2">
          <div className="flex items-center gap-2 h-7 px-2 bg-surface-container rounded-m3-sm border border-outline-variant">
            <Search className="h-3 w-3 text-on-surface-variant" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search prompts..."
              className="flex-1 bg-transparent text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
            />
          </div>
        </div>
        <DropdownMenuSeparator className="bg-outline-variant" />
        <div className="max-h-40 overflow-auto">
          {filteredPrompts.map(prompt => (
            <DropdownMenuItem key={prompt.id} className="text-tree text-on-surface hover:bg-on-surface/[0.08] cursor-pointer">
              <span className="flex-1">{prompt.name}</span>
              <div className="flex gap-1">
                {prompt.labels?.slice(0, 1).map(lbl => (
                  <LabelBadge key={lbl} label={lbl} size="xs" />
                ))}
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};


// Prompt Tab Content
const PromptTabContent = ({ promptData, onUpdateField, onRunPrompt, selectedPromptId, isRunningPrompt, formattedTime, variables = [], onCancelRun, runProgress, isLocked = false }) => {
  // Use real data from promptData, with fallbacks
  const systemPrompt = promptData?.input_admin_prompt || '';
  const userPrompt = promptData?.input_user_prompt || '';
  const outputResponse = promptData?.output_response || promptData?.user_prompt_result || '';
  const metadata = promptData?.last_ai_call_metadata;

  return (
    <div className="space-y-4">
      {/* System Prompt */}
      <ResizablePromptArea 
        label="System Prompt"
        value={systemPrompt}
        placeholder="Enter system prompt..."
        defaultHeight={160}
        onLibraryPick
        onSave={isLocked ? undefined : (value) => onUpdateField('input_admin_prompt', value)}
        variables={variables}
        readOnly={isLocked}
        familyRootPromptRowId={promptData?.root_prompt_row_id || promptData?.row_id}
      />

      {/* User Prompt */}
      <ResizablePromptArea 
        label="User Prompt"
        value={userPrompt}
        placeholder="Enter user prompt..."
        defaultHeight={64}
        onLibraryPick
        onSave={isLocked ? undefined : (value) => onUpdateField('input_user_prompt', value)}
        variables={variables}
        readOnly={isLocked}
        familyRootPromptRowId={promptData?.root_prompt_row_id || promptData?.row_id}
      />

      {/* Output */}
      <ResizableOutputArea
        label="Output"
        value={outputResponse}
        placeholder="No output yet. Run the prompt to generate a response."
        metadata={metadata}
        defaultHeight={144}
        onRegenerate={() => onRunPrompt?.(selectedPromptId)}
        onCancel={onCancelRun}
        isRegenerating={isRunningPrompt}
        runTime={formattedTime}
        progress={runProgress}
        syntaxHighlight={promptData?.node_type === 'action' && promptData?.post_action === 'create_children_json'}
      />

      {/* Notes */}
      <MarkdownNotesArea 
        label="Notes"
        value={promptData?.note || ''}
        placeholder="Add notes about this prompt..."
        defaultHeight={80}
        onSave={isLocked ? undefined : (value) => onUpdateField('note', value)}
        readOnly={isLocked}
      />
    </div>
  );
};

// Import model capabilities at top level (ESM)
import { ALL_SETTINGS } from '@/config/modelCapabilities';
import { useModels } from '@/hooks/useModels';

// Settings Tab Content with dynamic model-aware parameters
const SettingsTabContent = ({ promptData, onUpdateField, models = [], schemas = [], onEditSchema }) => {
  const { getModelConfig, isSettingSupported } = useModels();

  // Use real data from promptData
  const currentModel = promptData?.model || models.find(m => m.is_active)?.model_id || '';
  const modelConfig = getModelConfig(currentModel);
  const currentModelData = models.find(m => m.model_id === currentModel);
  const supportedSettings = currentModelData?.supported_settings || modelConfig.supportedSettings || [];
  
  const currentTemp = promptData?.temperature ? parseFloat(promptData.temperature) : 0.7;
  const isAssistant = promptData?.is_assistant || false;

  // RESPONSES API: Only max_output_tokens is used for prompt runs/cascades
  // No need to distinguish between GPT-4 and GPT-5 - all use max_output_tokens
  const currentMaxOutputTokens = promptData?.max_output_tokens || String(modelConfig.maxTokens || 4096);

  const [temperature, setTemperature] = useState([currentTemp]);
  const [maxOutputTokens, setMaxOutputTokens] = useState(currentMaxOutputTokens);
  
  // Local state for sliders to enable immediate visual feedback
  const [frequencyPenalty, setFrequencyPenalty] = useState([parseFloat(promptData?.frequency_penalty || '0')]);
  const [presencePenalty, setPresencePenalty] = useState([parseFloat(promptData?.presence_penalty || '0')]);
  const [topP, setTopP] = useState([parseFloat(promptData?.top_p || '1')]);
  
  // Debounce ref for slider saves
  const sliderDebounceRef = useRef({});

  // Cleanup slider debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(sliderDebounceRef.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);
  // Sync state when promptData or model changes
  useEffect(() => {
    if (promptData?.temperature) {
      setTemperature([parseFloat(promptData.temperature)]);
    }
  }, [promptData?.temperature]);
  
  // Sync max_output_tokens when promptData changes
  useEffect(() => {
    if (promptData?.max_output_tokens) {
      setMaxOutputTokens(promptData.max_output_tokens);
    } else if (modelConfig.maxTokens) {
      setMaxOutputTokens(String(modelConfig.maxTokens));
    }
  }, [promptData?.max_output_tokens, modelConfig.maxTokens]);
  
  // Sync other slider states when promptData changes
  useEffect(() => {
    setFrequencyPenalty([parseFloat(promptData?.frequency_penalty || '0')]);
  }, [promptData?.frequency_penalty]);
  
  useEffect(() => {
    setPresencePenalty([parseFloat(promptData?.presence_penalty || '0')]);
  }, [promptData?.presence_penalty]);
  
  useEffect(() => {
    setTopP([parseFloat(promptData?.top_p || '1')]);
  }, [promptData?.top_p]);

  // Debounced slider change handler
  const handleDebouncedSliderChange = (field, value, setter) => {
    setter(value);
    
    // Clear existing debounce timer
    if (sliderDebounceRef.current[field]) {
      clearTimeout(sliderDebounceRef.current[field]);
    }
    
    // Set new debounce timer (500ms delay)
    sliderDebounceRef.current[field] = setTimeout(() => {
      onUpdateField?.(field, String(value[0]));
    }, 500);
  };

  const handleTemperatureChange = (value) => {
    handleDebouncedSliderChange('temperature', value, setTemperature);
  };

  // Single handler for max_output_tokens (Responses API)
  const handleMaxOutputTokensChange = (e) => {
    const value = e.target.value;
    setMaxOutputTokens(value);
    onUpdateField?.('max_output_tokens', value);
  };

  const handleModelChange = (modelId) => {
    onUpdateField?.('model', modelId);
    onUpdateField?.('model_on', true);
    // Don't auto-reset max_tokens - preserve user's setting
    // Edge function uses model defaults if max_tokens_on is false
  };

  // Get display name for current model
  const currentModelDisplay = models.find(m => m.model_id === currentModel || m.id === currentModel)?.model_name || currentModel;

  // Helper to check if a setting is supported
  const hasSetting = (setting) => supportedSettings.includes(setting);

  // Node type state
  const nodeType = promptData?.node_type || 'standard';
  const isActionNode = nodeType === 'action';
  const isQuestionNode = nodeType === 'question';
  const hasOrphanedPostAction = !!promptData?.post_action && nodeType !== 'action';
  const hasOrphanedQuestionConfig = !!promptData?.question_config && nodeType !== 'question';

  // Node type change handler
  const handleNodeTypeChange = (value) => {
    onUpdateField?.('node_type', value);
    
    if (value === 'action') {
      if (!promptData?.response_format_on) {
        const structuredFormat = JSON.stringify({
          type: 'json_schema',
          json_schema: {
            name: 'action_response',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      content: { type: 'string' }
                    },
                    required: ['name', 'content'],
                    additionalProperties: false
                  }
                }
              },
              required: ['items'],
              additionalProperties: false
            }
          }
        });
        onUpdateField?.('response_format', structuredFormat);
        onUpdateField?.('response_format_on', true);
      }
      onUpdateField?.('question_config', null);
    } else if (value === 'question') {
      const defaultConfig = { max_questions: 10, completion_mode: 'ai_decides', show_progress: true };
      onUpdateField?.('question_config', defaultConfig);
      onUpdateField?.('post_action', null);
      onUpdateField?.('post_action_config', null);
      onUpdateField?.('json_schema_template_id', null);
      onUpdateField?.('extracted_variables', null);
      onUpdateField?.('last_action_result', null);
      onUpdateField?.('response_format_on', false);
    } else {
      onUpdateField?.('post_action', null);
      onUpdateField?.('post_action_config', null);
      onUpdateField?.('json_schema_template_id', null);
      onUpdateField?.('extracted_variables', null);
      onUpdateField?.('last_action_result', null);
      onUpdateField?.('response_format_on', false);
      onUpdateField?.('question_config', null);
    }
  };

  const handleQuestionConfigChange = (newConfig) => {
    onUpdateField?.('question_config', newConfig);
  };

  // Auto-fix handlers
  const handleAutoFixNodeType = () => {
    onUpdateField?.('node_type', 'action');
  };

  const handleAutoFixQuestionType = () => {
    onUpdateField?.('node_type', 'question');
  };

  // Compact toggle row
  const CompactToggles = () => (
    <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-m3-md border border-outline-variant mb-4">
      {/* Auto-fix warning icon for orphaned post_action */}
      {hasOrphanedPostAction && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
              onClick={handleAutoFixNodeType}
            >
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-[10px]">Post-action configured but not an action node. Click to fix.</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Auto-fix warning icon for orphaned question_config */}
      {hasOrphanedQuestionConfig && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
              onClick={handleAutoFixQuestionType}
            >
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-[10px]">Question config set but not a question node. Click to fix.</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Action Node Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
            onClick={() => handleNodeTypeChange(isActionNode ? 'standard' : 'action')}
          >
            <Zap className={`h-4 w-4 ${isActionNode ? 'text-primary' : 'text-on-surface-variant'}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-[10px]">{isActionNode ? 'Action prompt (click to disable)' : 'Enable action prompt'}</p>
        </TooltipContent>
      </Tooltip>

      {/* Question Node Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
            onClick={() => handleNodeTypeChange(isQuestionNode ? 'standard' : 'question')}
          >
            <MessageCircleQuestion className={`h-4 w-4 ${isQuestionNode ? 'text-primary' : 'text-on-surface-variant'}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-[10px]">{isQuestionNode ? 'Question prompt (click to disable)' : 'Enable question prompt'}</p>
        </TooltipContent>
      </Tooltip>

      {/* Exclude from Cascade Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
            onClick={() => onUpdateField?.('exclude_from_cascade', !promptData?.exclude_from_cascade)}
          >
            <SkipForward className={`h-4 w-4 ${promptData?.exclude_from_cascade ? 'text-primary' : 'text-on-surface-variant'}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-[10px]">{promptData?.exclude_from_cascade ? 'Excluded from cascade (click to include)' : 'Included in cascade (click to exclude)'}</p>
        </TooltipContent>
      </Tooltip>

      {/* Exclude from Export Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
            onClick={() => onUpdateField?.('exclude_from_export', !promptData?.exclude_from_export)}
          >
            <Upload className={`h-4 w-4 ${promptData?.exclude_from_export ? 'text-primary' : 'text-on-surface-variant'}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-[10px]">{promptData?.exclude_from_export ? 'Excluded from export (click to include)' : 'Included in export (click to exclude)'}</p>
        </TooltipContent>
      </Tooltip>

      <div className="h-5 w-px bg-outline-variant mx-1" />
      
      <span className="text-[10px] text-on-surface-variant">
        {(hasOrphanedPostAction || hasOrphanedQuestionConfig) && <span className="text-amber-500">Needs fix · </span>}
        {isActionNode && 'Action'}
        {isQuestionNode && 'Question'}
        {promptData?.exclude_from_cascade && ((isActionNode || isQuestionNode) ? ' · ' : '') + 'Skip cascade'}
        {promptData?.exclude_from_export && ((isActionNode || isQuestionNode || promptData?.exclude_from_cascade) ? ' · ' : '') + 'Skip export'}
        {!isActionNode && !isQuestionNode && !promptData?.exclude_from_cascade && !promptData?.exclude_from_export && !hasOrphanedPostAction && !hasOrphanedQuestionConfig && 'Standard prompt'}
      </span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Compact Toggles at top */}
      <CompactToggles />

      {/* Action Node Settings */}
      {isActionNode && (
        <ActionNodeSettings
          localData={promptData}
          handleChange={(key, value) => onUpdateField?.(key, value)}
          handleSave={() => {}} // No-op - onUpdateField already saves
        />
      )}

      {/* Question Node Settings */}
      {isQuestionNode && (
        <QuestionNodeSettings
          config={promptData?.question_config}
          onChange={handleQuestionConfigChange}
        />
      )}
      {/* Model Selection */}
      <SettingModelSelect
        value={promptData?.model || currentModel}
        onValueChange={handleModelChange}
        models={models}
        label="Model"
      />
        
      {/* Show supported settings info */}
      {supportedSettings.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {supportedSettings.map(setting => (
            <span key={setting} className="text-[9px] px-1.5 py-0.5 bg-surface-container rounded text-on-surface-variant">
              {setting.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      {/* Dynamic Model Settings Section */}
      <div className="p-3 bg-surface-container-low rounded-m3-md space-y-3">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-on-surface-variant" />
          <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Model Parameters</span>
        </div>

        {/* Temperature - only show if model supports it */}
        {hasSetting('temperature') && currentModelData?.supports_temperature !== false && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Temperature</label>
              <Switch 
                checked={promptData?.temperature_on || false}
                onCheckedChange={(checked) => onUpdateField?.('temperature_on', checked)} 
              />
            </div>
            {promptData?.temperature_on && (
              <>
                <div className="flex items-center justify-end">
                  <span className="text-body-sm text-on-surface font-mono">{temperature[0]}</span>
                </div>
                <Slider
                  value={temperature}
                  onValueChange={handleTemperatureChange}
                  max={2}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-on-surface-variant">
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Max Output Tokens - only show if model supports it */}
        {hasSetting('max_output_tokens') && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Max Output Tokens</label>
              <Switch 
                checked={promptData?.max_output_tokens_on || false}
                onCheckedChange={(checked) => onUpdateField?.('max_output_tokens_on', checked)} 
              />
            </div>
            {promptData?.max_output_tokens_on && (
              <>
                <input
                  type="number"
                  value={maxOutputTokens}
                  onChange={handleMaxOutputTokensChange}
                  max={modelConfig.maxTokens}
                  min={1}
                  className="w-full h-8 px-2.5 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-[10px] text-on-surface-variant">Max: {modelConfig.maxTokens?.toLocaleString() ?? 'N/A'}</span>
              </>
            )}
            <p className="text-[10px] text-on-surface-variant">Limits response length</p>
          </div>
        )}

        {/* Reasoning Effort - only for models that support it */}
        {hasSetting('reasoning_effort') && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Reasoning Effort</label>
              <Switch 
                checked={promptData?.reasoning_effort_on || false}
                onCheckedChange={(checked) => onUpdateField?.('reasoning_effort_on', checked)} 
              />
            </div>
            {promptData?.reasoning_effort_on && (
              <SettingSelect
                value={promptData?.reasoning_effort || 'medium'}
                onValueChange={(value) => onUpdateField?.('reasoning_effort', value)}
                options={[
                  { value: 'low', label: 'low' },
                  { value: 'medium', label: 'medium' },
                  { value: 'high', label: 'high' },
                ]}
                label=""
                hint="Higher = better reasoning, but slower & more expensive"
              />
            )}
          </div>
        )}

        {/* Frequency Penalty */}
        {hasSetting('frequency_penalty') && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Frequency Penalty</label>
              <Switch 
                checked={promptData?.frequency_penalty_on || false}
                onCheckedChange={(checked) => onUpdateField?.('frequency_penalty_on', checked)} 
              />
            </div>
            {promptData?.frequency_penalty_on && (
              <>
                <div className="flex items-center justify-end">
                  <span className="text-body-sm text-on-surface font-mono">{frequencyPenalty[0]}</span>
                </div>
                <Slider
                  value={frequencyPenalty}
                  onValueChange={(v) => handleDebouncedSliderChange('frequency_penalty', v, setFrequencyPenalty)}
                  min={-2}
                  max={2}
                  step={0.1}
                  className="w-full"
                />
              </>
            )}
            <p className="text-[10px] text-on-surface-variant">Reduce repetition of token sequences</p>
          </div>
        )}

        {/* Presence Penalty */}
        {hasSetting('presence_penalty') && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Presence Penalty</label>
              <Switch 
                checked={promptData?.presence_penalty_on || false}
                onCheckedChange={(checked) => onUpdateField?.('presence_penalty_on', checked)} 
              />
            </div>
            {promptData?.presence_penalty_on && (
              <>
                <div className="flex items-center justify-end">
                  <span className="text-body-sm text-on-surface font-mono">{presencePenalty[0]}</span>
                </div>
                <Slider
                  value={presencePenalty}
                  onValueChange={(v) => handleDebouncedSliderChange('presence_penalty', v, setPresencePenalty)}
                  min={-2}
                  max={2}
                  step={0.1}
                  className="w-full"
                />
              </>
            )}
            <p className="text-[10px] text-on-surface-variant">Encourage new topics</p>
          </div>
        )}

        {/* Top P */}
        {hasSetting('top_p') && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Top P</label>
              <Switch 
                checked={promptData?.top_p_on || false}
                onCheckedChange={(checked) => onUpdateField?.('top_p_on', checked)} 
              />
            </div>
            {promptData?.top_p_on && (
              <>
                <div className="flex items-center justify-end">
                  <span className="text-body-sm text-on-surface font-mono">{topP[0]}</span>
                </div>
                <Slider
                  value={topP}
                  onValueChange={(v) => handleDebouncedSliderChange('top_p', v, setTopP)}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                />
              </>
            )}
            <p className="text-[10px] text-on-surface-variant">Nucleus sampling threshold</p>
          </div>
        )}

        {/* Seed */}
        {hasSetting('seed') && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Seed</label>
              <Switch 
                checked={promptData?.seed_on || false}
                onCheckedChange={(checked) => onUpdateField?.('seed_on', checked)} 
              />
            </div>
            {promptData?.seed_on && (
              <input
                type="number"
                value={promptData?.seed || ''}
                onChange={(e) => onUpdateField?.('seed', e.target.value)}
                placeholder="Enter seed value"
                className="w-full h-8 px-2.5 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            )}
            <p className="text-[10px] text-on-surface-variant">Fixed seed for reproducible outputs</p>
          </div>
        )}

        {/* Response Format - hidden for action nodes (controlled by JSON Schema Template picker) */}
        {hasSetting('response_format') && promptData?.node_type !== 'action' && (
          <SettingSelect
            value={promptData?.response_format || 'text'}
            onValueChange={(value) => onUpdateField?.('response_format', value)}
            options={[
              { value: 'text', label: 'text' },
              { value: 'json_object', label: 'json object' },
            ]}
            label="Response Format"
          />
        )}

        {/* Tool Choice - only if supported */}
        {hasSetting('tool_choice') && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Tool Choice</label>
              <Switch 
                checked={promptData?.tool_choice_on || false}
                onCheckedChange={(checked) => onUpdateField?.('tool_choice_on', checked)} 
              />
            </div>
            {promptData?.tool_choice_on && (
              <SettingSelect
                value={promptData?.tool_choice || 'auto'}
                onValueChange={(value) => onUpdateField?.('tool_choice', value)}
                options={[
                  { value: 'auto', label: 'auto' },
                  { value: 'none', label: 'none' },
                  { value: 'required', label: 'required' },
                ]}
                label=""
                hint="Controls when the model uses tools"
              />
            )}
          </div>
        )}

        {/* No settings available message */}
        {supportedSettings.length === 0 && (
          <p className="text-body-sm text-on-surface-variant text-center py-2">
            No configurable settings for this model
          </p>
        )}
      </div>


      {/* Tools Section */}
      <div className="space-y-2">
        <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Tools</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: "code_interpreter_on", icon: Code, label: "Code Interpreter" },
            { key: "file_search_on", icon: Search, label: "File Search" },
            { key: "web_search_on", icon: Globe, label: "Web Search" },
            { key: "function_calling_on", icon: Zap, label: "Functions" },
            { key: "confluence_enabled", icon: FileText, label: "Confluence" },
            { key: "jira_enabled", icon: Briefcase, label: "Jira" },
          ].map(tool => (
            <div key={tool.label} className="flex items-center justify-between p-2.5 bg-surface-container rounded-m3-sm border border-outline-variant">
              <div className="flex items-center gap-1.5">
                <tool.icon className="h-3.5 w-3.5 text-on-surface-variant" />
                <span className="text-tree text-on-surface">{tool.label}</span>
              </div>
              <Switch 
                checked={promptData?.[tool.key] || false}
                onCheckedChange={(checked) => onUpdateField?.(tool.key, checked)} 
              />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
// Schema Viewer Component
const SchemaViewer = ({ schema, schemaName, schemaId, onEditSchema }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  if (!schema) return null;
  
  const schemaString = typeof schema === 'string' ? schema : JSON.stringify(schema, null, 2);
  
  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(schemaString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-[10px] text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <Eye className="h-3 w-3" />
          <span>{isOpen ? 'Hide' : 'View'} Schema</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleCopy}
              className="w-6 h-6 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3 text-on-surface-variant" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>{copied ? 'Copied!' : 'Copy Schema'}</TooltipContent>
        </Tooltip>
        {schemaId && onEditSchema && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onEditSchema(schemaId)}
                className="w-6 h-6 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
              >
                <Edit3 className="h-3 w-3 text-on-surface-variant" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Edit Schema Template</TooltipContent>
          </Tooltip>
        )}
      </div>
      {isOpen && (
        <ScrollArea className="rounded-m3-sm border border-outline-variant h-48 bg-surface-container">
          <SyntaxHighlighter
            language="json"
            style={vs}
            customStyle={{
              margin: 0,
              padding: '8px',
              fontSize: '10px',
              background: 'transparent',
            }}
          >
            {schemaString}
          </SyntaxHighlighter>
        </ScrollArea>
      )}
    </div>
  );
};

// JSON Path Configuration Component with schema-aware path picker
const JsonPathConfig = ({ 
  actionConfig, 
  getDisplayValue, 
  updateActionConfigDebounced, 
  selectedSchemaId, 
  selectedSchema, 
  schemas, 
  onUpdateField,
  onEditSchema,
}) => {
  const [showPathPicker, setShowPathPicker] = useState(false);
  const [showFieldMapping, setShowFieldMapping] = useState(false);
  
  // Extract array paths from schema with enhanced info
  const arrayPaths = useMemo(() => {
    if (!selectedSchema?.json_schema) return [];
    
    const findArrays = (obj, currentPath = '') => {
      if (!obj || typeof obj !== 'object') return [];
      
      const paths = [];
      
      if (obj.type === 'array') {
        const itemType = obj.items?.type || 'any';
        const itemProps = obj.items?.properties ? Object.keys(obj.items.properties) : [];
        paths.push({
          path: currentPath || 'root',
          itemType,
          itemProps,
          description: obj.description || '',
        });
        
        // Traverse into array items to find nested arrays
        if (obj.items) {
          paths.push(...findArrays(obj.items, currentPath));
        }
      }
      
      if (obj.properties) {
        Object.entries(obj.properties).forEach(([key, value]) => {
          const path = currentPath ? `${currentPath}.${key}` : key;
          paths.push(...findArrays(value, path));
        });
      }
      
      return paths;
    };
    
    return findArrays(selectedSchema.json_schema);
  }, [selectedSchema]);

  // Auto-select path if only one array exists and no path is set
  useEffect(() => {
    if (arrayPaths.length === 1 && !getDisplayValue('json_path')) {
      updateActionConfigDebounced('json_path', arrayPaths[0].path);
    }
  }, [arrayPaths, getDisplayValue, updateActionConfigDebounced]);

  // Detect which field will be used for title
  const detectedTitleField = useMemo(() => {
    const currentPath = getDisplayValue('json_path');
    const arrayInfo = arrayPaths.find(a => a.path === currentPath);
    if (!arrayInfo?.itemProps?.length) return null;
    
    // Common title field names
    const titleFields = ['title', 'name', 'heading', 'label', 'subject'];
    return arrayInfo.itemProps.find(p => titleFields.includes(p.toLowerCase())) || arrayInfo.itemProps[0];
  }, [arrayPaths, getDisplayValue]);

  const handleSelectPath = (pathInfo) => {
    updateActionConfigDebounced('json_path', pathInfo.path);
    setShowPathPicker(false);
  };

  const currentNameField = getDisplayValue('name_field');
  const currentContentField = getDisplayValue('content_field');

  return (
    <>
      {/* JSON Schema */}
      <SettingSelect
        value={selectedSchemaId || 'none'}
        onValueChange={(value) => onUpdateField?.('json_schema_template_id', value === 'none' ? null : value)}
        options={[
          { value: 'none', label: 'None' },
          ...schemas.map(s => ({ value: s.row_id || s.id, label: s.schema_name || s.name }))
        ]}
        label="JSON Schema (Optional)"
      />

      {/* Array Path */}
      <div className="space-y-1">
        <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Array Path</label>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={getDisplayValue('json_path')}
            onChange={(e) => updateActionConfigDebounced('json_path', e.target.value)}
            placeholder="sections"
            className="flex-1 h-8 px-2.5 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {arrayPaths.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setShowPathPicker(!showPathPicker)}
                  className={`w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container ${
                    showPathPicker ? 'text-primary' : 'text-on-surface-variant'
                  }`}
                >
                  <Target className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Select array from schema</TooltipContent>
            </Tooltip>
          )}
        </div>
        {showPathPicker && arrayPaths.length > 0 && (
          <div className="bg-surface-container border border-outline-variant rounded-m3-sm p-1.5 space-y-0.5">
            {arrayPaths.map((pathInfo) => (
              <button
                key={pathInfo.path}
                type="button"
                onClick={() => handleSelectPath(pathInfo)}
                className="w-full text-left px-2 py-1.5 text-body-sm text-on-surface hover:bg-surface-container-high rounded-m3-sm transition-colors"
              >
                <span className="font-mono">{pathInfo.path}</span>
                <span className="text-[10px] text-on-surface-variant ml-2">
                  (array of {pathInfo.itemType}s{pathInfo.itemProps.length > 0 ? `: ${pathInfo.itemProps.slice(0, 3).join(', ')}${pathInfo.itemProps.length > 3 ? '...' : ''}` : ''})
                </span>
              </button>
            ))}
          </div>
        )}
        <p className="text-[10px] text-on-surface-variant">Path to the array that will become child prompts</p>
      </div>

      {/* Schema Viewer */}
      {selectedSchema && selectedSchema.json_schema && (
        <SchemaViewer 
          schema={selectedSchema.json_schema} 
          schemaName={selectedSchema.schema_name || selectedSchema.name}
          schemaId={selectedSchema.row_id || selectedSchema.id}
          onEditSchema={onEditSchema}
        />
      )}

      {/* Field Mapping Preview & Override */}
      <div className="space-y-2">
        {/* Preview of auto-detected mapping */}
        {getDisplayValue('json_path') && !showFieldMapping && (
          <div className="flex items-center justify-between text-[10px] text-on-surface-variant">
            <span>
              Title: <span className="font-mono text-on-surface">{currentNameField || detectedTitleField || 'auto-detect'}</span>
              {' · '}
              Content: <span className="font-mono text-on-surface">{currentContentField || 'full item'}</span>
            </span>
            <button
              type="button"
              onClick={() => setShowFieldMapping(true)}
              className="text-primary hover:underline"
            >
              Customize
            </button>
          </div>
        )}

        {/* Expanded field mapping controls */}
        {showFieldMapping && (
          <div className="p-2 bg-surface-container rounded-m3-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Field Mapping</span>
              <button
                type="button"
                onClick={() => setShowFieldMapping(false)}
                className="w-6 h-6 flex items-center justify-center rounded-m3-full hover:bg-surface-container-high"
              >
                <X className="h-3 w-3 text-on-surface-variant" />
              </button>
            </div>
            
            {/* Title Property */}
            <div className="space-y-1">
              <label className="text-[10px] text-on-surface-variant">Title Property</label>
              <input
                type="text"
                value={getDisplayValue('name_field')}
                onChange={(e) => updateActionConfigDebounced('name_field', e.target.value)}
                placeholder={detectedTitleField || 'auto-detect'}
                className="w-full h-7 px-2 bg-surface-container-high rounded-m3-sm border border-outline-variant text-body-sm text-on-surface font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-[9px] text-on-surface-variant">Property for child prompt name (leave empty to auto-detect)</p>
            </div>

            {/* Content Property */}
            <div className="space-y-1">
              <label className="text-[10px] text-on-surface-variant">Content Property</label>
              <input
                type="text"
                value={getDisplayValue('content_field')}
                onChange={(e) => updateActionConfigDebounced('content_field', e.target.value)}
                placeholder="full item JSON"
                className="w-full h-7 px-2 bg-surface-container-high rounded-m3-sm border border-outline-variant text-body-sm text-on-surface font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-[9px] text-on-surface-variant">Property for prompt content (leave empty to use full item)</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// VariablesTabContent is now imported from ./VariablesTabContent.jsx

// Conversation Tab Content with Messages
const ConversationTabContent = ({ isAssistantEnabled = true, messages = [] }) => {
  const [inputValue, setInputValue] = useState("");

  if (!isAssistantEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-56 text-center">
        <MessageSquare className="h-10 w-10 text-on-surface-variant/30 mb-2" />
        <p className="text-body-sm text-on-surface-variant">Enable Assistant Mode</p>
        <p className="text-[10px] text-on-surface-variant/70 mt-0.5">to use conversations</p>
      </div>
    );
  }

  return (
    <div className="rounded-m3-lg border border-outline-variant bg-surface-container-low overflow-hidden">
      {/* Conversation Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <span className="text-body-sm text-on-surface font-medium">Thread #1</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600">Active</span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-6 h-6 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">New Thread</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-6 h-6 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Clear</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Messages (page-level scroll handles overflow) */}
      <div className="p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-8 w-8 mx-auto text-on-surface-variant/30 mb-2" />
            <p className="text-body-sm text-on-surface-variant">No messages yet</p>
          </div>
        ) : messages.map((message) => (
          <div 
            key={message.id}
            className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-3 w-3 text-primary" />
              </div>
            )}
            <div className={`max-w-[80%] ${message.role === 'user' ? 'order-first' : ''}`}>
              <div 
                className={`p-2.5 rounded-m3-md text-body-sm ${
                  message.role === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-br-sm' 
                    : 'bg-surface-container border border-outline-variant text-on-surface rounded-bl-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
              <p className={`text-[10px] text-on-surface-variant mt-0.5 ${message.role === 'user' ? 'text-right' : ''}`}>
                {message.timestamp}
              </p>
            </div>
            {message.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-secondary-container flex items-center justify-center shrink-0">
                <User className="h-3 w-3 text-secondary-container-foreground" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-outline-variant">
        <div className="flex items-end gap-2">
          <div className="flex-1 min-h-[36px] max-h-24 bg-surface-container rounded-m3-md border border-outline-variant">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type a message..."
              rows={1}
              className="w-full h-full min-h-[36px] p-2 bg-transparent text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none resize-none"
            />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-9 h-9 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container shrink-0">
                <Send className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Send</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

// Main Prompts Content Component
const PromptsContent = ({ 
  hasSelection = true,
  selectedPromptId,
  promptData,
  isLoadingPrompt = false,
  onUpdateField,
  variables = [],
  isLoadingVariables = false,
  onAddVariable,
  onUpdateVariable,
  onDeleteVariable,
  selectedPromptHasChildren = false,
  onExport, 
  onToggleConversation, 
  conversationPanelOpen = true,
  onToggleFolderPanel,
  folderPanelOpen = true,
  onToggleReadingPane,
  readingPaneOpen = true,
  models = [],
  schemas = [],
  libraryItems = [],
  // Run prompt handlers
  onRunPrompt,
  onRunCascade,
  isRunningPrompt = false,
  isRunningCascade = false,
  onCancelRun,
  runProgress,
  onEditSchema,
  // Lock state
  isCascadeRunning = false,
  singleRunPromptId = null,
}) => {
  const [activeTab, setActiveTab] = useState("prompt");
  const [confluenceModalOpen, setConfluenceModalOpen] = useState(false);
  const [versionPanelOpen, setVersionPanelOpen] = useState(false);
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const fileInputRef = useRef(null);
  const formattedTime = useTimer(isRunningPrompt);

  // Version history hook
  const {
    hasUncommittedChanges,
    currentVersion,
    commit,
    isCommitting,
  } = usePromptVersions(promptData?.row_id);

  // Detect if current prompt uses a Manus model (async/webhook-based, requires cascade)
  const isManusModel = useMemo(() => {
    const promptModel = promptData?.model;
    if (!promptModel) return false;
    const modelData = models.find(m => m.model_id === promptModel || m.model_name === promptModel);
    return modelData?.provider === 'manus';
  }, [promptData?.model, models]);

  // Get assistant row id from promptData (always available now - conversation mode always on)
  const assistantRowId = promptData?.assistant_row_id;
  const promptRowId = promptData?.row_id;

  // File and Confluence hooks
  const {
    files,
    isUploading,
    uploadFile,
  } = useConversationFiles(assistantRowId);

  const {
    pages: confluencePages,
    fetchAttachedPages,
  } = useConfluencePages(assistantRowId, promptRowId);

  // Handle file upload
  const handleFileUpload = async (e) => {
    const selectedFiles = e.target.files;
    if (selectedFiles?.length > 0) {
      await uploadFile(Array.from(selectedFiles));
    }
    e.target.value = '';
  };


  const tabs = [
    { id: "prompt", icon: FileText, label: "Prompt" },
    { id: "settings", icon: Sliders, label: "Settings" },
    { id: "variables", icon: Braces, label: "Variables" },
    { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  ];

  if (!hasSelection) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-auto bg-surface">
        {/* Header with toggle buttons */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-outline-variant shrink-0">
          <div>
            {!folderPanelOpen && onToggleFolderPanel && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={onToggleFolderPanel} className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container">
                    <PanelLeftOpen className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Show folders</TooltipContent>
              </Tooltip>
            )}
          </div>
          <div>
            {!conversationPanelOpen && onToggleConversation && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={onToggleConversation} className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container">
                    <PanelRightOpen className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Show chat</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-on-surface-variant">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-body-sm">Select a prompt to view</p>
            <p className="text-[10px] opacity-70 mt-0.5">or create a new one</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoadingPrompt) {
    return (
      <div className="flex-1 flex flex-col bg-surface min-h-0">
        <div className="h-14 flex items-center px-3 border-b border-outline-variant">
          <div className="flex items-center gap-2">
            <div className="h-5 w-32 bg-on-surface/[0.08] rounded-m3-sm animate-pulse" />
            <div className="h-4 w-16 bg-on-surface/[0.08] rounded-m3-sm animate-pulse" />
          </div>
        </div>
        <div className="flex-1 p-4">
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-1.5">
              <div className="h-3 w-20 bg-on-surface/[0.08] rounded-m3-sm animate-pulse" />
              <div className="w-full h-40 bg-on-surface/[0.08] rounded-m3-md animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-16 bg-on-surface/[0.08] rounded-m3-sm animate-pulse" />
              <div className="w-full h-20 bg-on-surface/[0.08] rounded-m3-md animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const promptName = promptData?.prompt_name || 'Untitled Prompt';

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-0">
      {/* Run Lock Banner */}
      {(isCascadeRunning || singleRunPromptId === selectedPromptId) && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 shrink-0">
          <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
          <span className="text-body-sm text-amber-700 dark:text-amber-400">
            {isCascadeRunning ? 'Cascade in progress' : 'Prompt running'} — editing disabled
          </span>
        </div>
      )}
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-outline-variant shrink-0">
        <div className="flex items-center gap-2">
          {!folderPanelOpen && onToggleFolderPanel && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onToggleFolderPanel} className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container">
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Show folders</TooltipContent>
            </Tooltip>
          )}
          <h2 className="text-title-sm text-on-surface font-medium">{promptName}</h2>
          {promptData?.is_assistant && promptData?.parent_row_id && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 rounded-m3-sm">
                  <Link2 className="h-3 w-3 text-primary" />
                  <span className="text-[10px] text-primary font-medium">Inherited</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">
                Uses parent's conversation context
              </TooltipContent>
            </Tooltip>
          )}
          <LabelPicker 
            labels={promptData?.labels || []} 
            onLabelsChange={(newLabels) => onUpdateField?.('labels', newLabels)}
            maxDisplay={2}
          />
          
          {/* Version indicator */}
          {currentVersion > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-surface-container rounded-m3-sm text-on-surface-variant font-mono">
              v{currentVersion}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {/* Version History Icon */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setVersionPanelOpen(true)}
                className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container relative"
              >
                <GitBranch className="h-4 w-4" />
                {hasUncommittedChanges && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">
              Version History {currentVersion > 0 ? `(v${currentVersion})` : ''}
              {hasUncommittedChanges && ' • Uncommitted changes'}
            </TooltipContent>
          </Tooltip>

          {/* Commit Icon */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCommitDialogOpen(true)}
                disabled={!hasUncommittedChanges || isCommitting}
                className={`w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container ${
                  hasUncommittedChanges ? 'text-on-surface-variant' : 'text-on-surface-variant/40'
                }`}
              >
                <GitCommit className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">
              {isCommitting ? 'Committing...' : hasUncommittedChanges ? 'Commit Changes' : 'No changes to commit'}
            </TooltipContent>
          </Tooltip>
          {/* Hidden file input */}
          <input 
            ref={fileInputRef}
            type="file" 
            multiple 
            className="hidden" 
            onChange={handleFileUpload} 
            disabled={isUploading} 
          />
          
          {onToggleReadingPane && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onToggleReadingPane} className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                  <Minimize2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Hide prompt panel</TooltipContent>
            </Tooltip>
          )}
          
          {!conversationPanelOpen && onToggleConversation && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onToggleConversation} className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                  <PanelRightOpen className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Show Conversation</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Tabs with Actions */}
      <div className="flex items-center px-3 py-1.5 border-b border-outline-variant shrink-0">
        <div className="flex items-center gap-0.5">
          {tabs.map(tab => (
            <TabButton 
              key={tab.id} 
              icon={tab.icon} 
              label={tab.label} 
              isActive={activeTab === tab.id} 
              onClick={() => setActiveTab(tab.id)} 
            />
          ))}
          {/* Attachments Tab - left aligned with other tabs */}
          <TabButton 
            icon={isUploading ? Loader2 : Paperclip} 
            label="Attachments" 
            isActive={activeTab === 'attachments'} 
            onClick={() => setActiveTab('attachments')} 
          />
        </div>
        <div className="flex items-center gap-0.5 ml-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => !isManusModel && onRunPrompt?.(selectedPromptId)}
                disabled={isRunningPrompt || isManusModel}
                className={`w-8 h-8 flex items-center justify-center rounded-m3-full ${
                  isRunningPrompt ? 'text-primary hover:bg-surface-container' : 
                  isManusModel ? 'text-on-surface-variant/40 cursor-not-allowed' : 
                  'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {isRunningPrompt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">
              {isRunningPrompt ? 'Running...' : 
               isManusModel ? 'Manus models require cascade execution' : 
               'Play'}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => onRunCascade?.(selectedPromptId)}
                disabled={isRunningCascade || !selectedPromptHasChildren}
                className={`w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-on-surface/[0.08] ${isRunningCascade ? 'text-primary' : !selectedPromptHasChildren ? 'text-on-surface-variant/40' : 'text-on-surface-variant'}`}
              >
                {isRunningCascade ? <Loader2 className="h-4 w-4 animate-spin" /> : <Workflow className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">{isRunningCascade ? 'Running Cascade...' : !selectedPromptHasChildren ? 'No children to cascade' : 'Run Cascade'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onExport} className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                <Download className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Export</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="w-full">
          {activeTab === "prompt" && (
            <PromptTabContent 
              promptData={promptData}
              onUpdateField={onUpdateField}
              onRunPrompt={onRunPrompt}
              selectedPromptId={selectedPromptId}
              isRunningPrompt={isRunningPrompt}
              formattedTime={formattedTime}
              variables={variables}
              onCancelRun={onCancelRun}
              runProgress={runProgress}
              isLocked={isCascadeRunning || singleRunPromptId === selectedPromptId}
            />
          )}
          {activeTab === "settings" && (
            <SettingsTabContent 
              promptData={promptData}
              onUpdateField={onUpdateField}
              models={models}
              schemas={schemas}
              onEditSchema={onEditSchema}
            />
          )}
          {activeTab === "variables" && (
            <VariablesTabContent 
              promptData={promptData}
              promptRowId={promptData?.row_id}
              parentData={null}
              childrenData={[]}
              siblingsData={[]}
              userVariables={variables}
              isLoadingVariables={isLoadingVariables}
              addVariable={onAddVariable}
              updateVariable={onUpdateVariable}
              deleteVariable={onDeleteVariable}
            />
          )}
          {activeTab === "attachments" && (
            <div className="space-y-4 p-4">
              <FilesPagesSection conversationRowId={assistantRowId} />
              <ConfluencePagesSection 
                conversationRowId={assistantRowId} 
                promptRowId={promptRowId} 
              />
            </div>
          )}
          {activeTab === "dashboard" && (
            <DashboardTabContent />
          )}
        </div>
      </div>

      {/* Confluence Search Modal */}
      <ConfluenceSearchModal
        open={confluenceModalOpen}
        onOpenChange={setConfluenceModalOpen}
        conversationRowId={assistantRowId}
        promptRowId={promptRowId}
        onPageAttached={fetchAttachedPages}
      />

      {/* Version History Panel */}
      {versionPanelOpen && (
        <div className="fixed inset-y-0 right-0 z-50">
          <VersionHistoryPanel
            promptRowId={promptData?.row_id}
            onClose={() => setVersionPanelOpen(false)}
          />
        </div>
      )}

      {/* Commit Dialog */}
      <CommitDialog
        open={commitDialogOpen}
        onOpenChange={setCommitDialogOpen}
        onCommit={async (message, tagName) => {
          await commit(message, tagName);
          setCommitDialogOpen(false);
        }}
        isCommitting={isCommitting}
      />
    </div>
  );
};

export default PromptsContent;
