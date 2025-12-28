import { useState, useEffect, useMemo } from "react";
import { useTimer } from "@/hooks/useTimer";
import { 
  FileText, Sliders, Variable, MessageSquare, Play, Copy, 
  Download, MoreVertical, Star, Trash2, Share2, Link2, 
  Hash, List, Braces, ToggleLeft, Library, ChevronDown, 
  Search, Plus, PanelRightOpen, Workflow, Bot, Thermometer,
  Zap, Code, Globe, Edit3, Check, X, User, Sparkles, Briefcase,
  Clock, Send, ArrowRight, Database, Settings, Eye, EyeOff,
  RefreshCw, ChevronRight, AlertCircle, Info, Loader2, GitBranch
} from "lucide-react";
import { VariablePicker } from "@/components/shared";
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
import { 
  EmptyVariables, 
  EmptyConversation,
  EmptyOutput 
} from "@/components/shared";

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
  const icons = {
    text: Variable,
    reference: Link2,
    number: Hash,
    list: List,
    json: Braces,
    enum: ToggleLeft
  };
  const Icon = icons[type] || Variable;
  return <Icon className="h-3.5 w-3.5 text-on-surface-variant" />;
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
            <DropdownMenuItem key={prompt.id} className="text-body-sm text-on-surface hover:bg-on-surface/[0.08] cursor-pointer">
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

// Import the resizable area components
import ResizablePromptArea from "../shared/ResizablePromptArea";
import ResizableOutputArea from "../shared/ResizableOutputArea";

// Prompt Tab Content
const PromptTabContent = ({ promptData, onUpdateField, onRunPrompt, selectedPromptId, isRunningPrompt, variables = [] }) => {
  // Use real data from promptData, with fallbacks
  const systemPrompt = promptData?.input_admin_prompt || '';
  const userPrompt = promptData?.input_user_prompt || '';
  const outputResponse = promptData?.output_response || '';
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
        onChange={(value) => onUpdateField?.('input_admin_prompt', value)}
        variables={variables}
      />

      {/* User Prompt */}
      <ResizablePromptArea 
        label="User Prompt"
        value={userPrompt}
        placeholder="Enter user prompt..."
        defaultHeight={64}
        onLibraryPick
        onChange={(value) => onUpdateField?.('input_user_prompt', value)}
        variables={variables}
      />

      {/* Output */}
      <ResizableOutputArea
        label="Output"
        value={outputResponse}
        placeholder="No output yet. Run the prompt to generate a response."
        metadata={metadata}
        defaultHeight={144}
        onRegenerate={() => onRunPrompt?.(selectedPromptId)}
        isRegenerating={isRunningPrompt}
      />
    </div>
  );
};

// Import model capabilities at top level (ESM)
import { getModelConfig, getModelCapabilities, ALL_SETTINGS } from '@/config/modelCapabilities';

// Settings Tab Content with dynamic model-aware parameters
const SettingsTabContent = ({ promptData, onUpdateField, models = [], schemas = [] }) => {

  // Use real data from promptData
  const currentModel = promptData?.model || 'gpt-4o';
  const currentProvider = models.find(m => m.model_id === currentModel)?.provider || 'openai';
  const modelConfig = getModelConfig(currentModel);
  const modelCapabilities = getModelCapabilities(currentModel, currentProvider);
  
  const currentTemp = promptData?.temperature ? parseFloat(promptData.temperature) : 0.7;
  const currentMaxTokens = promptData?.max_tokens || promptData?.max_completion_tokens || String(modelConfig.maxTokens);
  const isAssistant = promptData?.is_assistant || false;

  const [temperature, setTemperature] = useState([currentTemp]);
  const [maxTokens, setMaxTokens] = useState(currentMaxTokens);

  // Sync state when promptData or model changes
  useEffect(() => {
    if (promptData?.temperature) {
      setTemperature([parseFloat(promptData.temperature)]);
    }
  }, [promptData?.temperature]);
  
  useEffect(() => {
    const tokenValue = promptData?.max_tokens || promptData?.max_completion_tokens;
    if (tokenValue) {
      setMaxTokens(tokenValue);
    } else {
      // Set to model's max when no value exists
      setMaxTokens(String(modelConfig.maxTokens));
    }
  }, [promptData?.max_tokens, promptData?.max_completion_tokens, modelConfig.maxTokens]);

  const handleTemperatureChange = (value) => {
    setTemperature(value);
    onUpdateField?.('temperature', String(value[0]));
  };

  const handleMaxTokensChange = (e) => {
    const value = e.target.value;
    setMaxTokens(value);
    // Use the correct parameter name based on model
    onUpdateField?.(modelConfig.tokenParam, value);
  };

  const handleModelChange = (modelId) => {
    onUpdateField?.('model', modelId);
    // Update max tokens to new model's max
    const newConfig = getModelConfig(modelId);
    setMaxTokens(String(newConfig.maxTokens));
    onUpdateField?.(newConfig.tokenParam, String(newConfig.maxTokens));
  };

  const handleAssistantToggle = (checked) => {
    onUpdateField?.('is_assistant', checked);
  };

  // Get display name for current model
  const currentModelDisplay = models.find(m => m.model_id === currentModel || m.id === currentModel)?.model_name || currentModel;

  return (
    <div className="space-y-4">
      {/* Model Selection - shows all models, inactive ones greyed out */}
      <div className="space-y-1.5">
        <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Model</label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full h-8 px-2.5 flex items-center justify-between bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface">
              <span>{currentModelDisplay}</span>
              <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-full max-h-64 overflow-auto bg-surface-container-high border-outline-variant">
            {models.length === 0 ? (
              <DropdownMenuItem className="text-body-sm text-on-surface-variant">
                No models available
              </DropdownMenuItem>
            ) : models.map(model => {
              const isActive = model.is_active !== false;
              return (
                <Tooltip key={model.row_id || model.id || model.model_id}>
                  <TooltipTrigger asChild>
                    <DropdownMenuItem 
                      onClick={() => isActive && handleModelChange(model.model_id || model.id)}
                      className={`text-body-sm ${isActive ? 'text-on-surface cursor-pointer' : 'text-on-surface-variant/50 cursor-not-allowed opacity-60'}`}
                      disabled={!isActive}
                    >
                      <span className="flex-1">{model.model_name || model.name}</span>
                      <span className="text-[10px] text-on-surface-variant">{model.provider || 'OpenAI'}</span>
                    </DropdownMenuItem>
                  </TooltipTrigger>
                  {!isActive && (
                    <TooltipContent side="right" className="text-[10px]">
                      Activate in Settings → AI Models
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Temperature - only show if model supports it */}
      {modelConfig.supportsTemperature && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Temperature</label>
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
        </div>
      )}

      {/* Max Tokens / Max Completion Tokens - dynamic label based on model */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">
            {modelConfig.tokenParam === 'max_completion_tokens' ? 'Max Completion Tokens' : 'Max Tokens'}
          </label>
          <span className="text-[10px] text-on-surface-variant">Max: {modelConfig.maxTokens.toLocaleString()}</span>
        </div>
        <input
          type="number"
          value={maxTokens}
          onChange={handleMaxTokensChange}
          max={modelConfig.maxTokens}
          min={1}
          className="w-full h-8 px-2.5 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Reasoning Effort - only for GPT-5 and O-series */}
      {modelCapabilities.includes('reasoning_effort') && (
        <div className="space-y-1.5">
          <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Reasoning Effort</label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full h-8 px-2.5 flex items-center justify-between bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface">
                <span className="capitalize">{promptData?.reasoning_effort || 'medium'}</span>
                <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-full bg-surface-container-high border-outline-variant">
              {['low', 'medium', 'high'].map(level => (
                <DropdownMenuItem 
                  key={level}
                  onClick={() => onUpdateField?.('reasoning_effort', level)}
                  className="text-body-sm text-on-surface capitalize"
                >
                  {level}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="text-[10px] text-on-surface-variant">Higher = better reasoning, but slower & more expensive</p>
        </div>
      )}

      {/* Frequency Penalty - only if supported */}
      {modelCapabilities.includes('frequency_penalty') && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Frequency Penalty</label>
            <span className="text-body-sm text-on-surface font-mono">{promptData?.frequency_penalty || '0'}</span>
          </div>
          <Slider
            value={[parseFloat(promptData?.frequency_penalty || '0')]}
            onValueChange={(v) => onUpdateField?.('frequency_penalty', String(v[0]))}
            min={-2}
            max={2}
            step={0.1}
            className="w-full"
          />
        </div>
      )}

      {/* Presence Penalty - only if supported */}
      {modelCapabilities.includes('presence_penalty') && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Presence Penalty</label>
            <span className="text-body-sm text-on-surface font-mono">{promptData?.presence_penalty || '0'}</span>
          </div>
          <Slider
            value={[parseFloat(promptData?.presence_penalty || '0')]}
            onValueChange={(v) => onUpdateField?.('presence_penalty', String(v[0]))}
            min={-2}
            max={2}
            step={0.1}
            className="w-full"
          />
        </div>
      )}

      {/* JSON Schema */}
      <div className="space-y-1.5">
        <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">JSON Schema (Optional)</label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full h-8 px-2.5 flex items-center justify-between bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface-variant">
              <span>Select a schema...</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-full bg-surface-container-high border-outline-variant">
            {schemas.length === 0 ? (
              <DropdownMenuItem className="text-body-sm text-on-surface-variant">
                No schemas available
              </DropdownMenuItem>
            ) : schemas.map(schema => (
              <DropdownMenuItem key={schema.row_id || schema.id} className="text-body-sm text-on-surface">
                {schema.schema_name || schema.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Assistant Mode Toggle */}
      <div className="p-3 bg-surface-container-low rounded-m3-lg border border-outline-variant">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-on-surface-variant" />
            <div>
              <span className="text-body-sm text-on-surface font-medium">Assistant Mode</span>
              <p className="text-[10px] text-on-surface-variant">Enable conversational memory</p>
            </div>
          </div>
          <Switch checked={isAssistant} onCheckedChange={handleAssistantToggle} />
        </div>
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
                <span className="text-[11px] text-on-surface">{tool.label}</span>
              </div>
              <Switch 
                checked={promptData?.[tool.key] || false}
                onCheckedChange={(checked) => onUpdateField?.(tool.key, checked)} 
              />
            </div>
          ))}
        </div>
      </div>

      {/* Actions & Cascade Section */}
      <ActionConfigSection promptData={promptData} onUpdateField={onUpdateField} />
    </div>
  );
};
// Action Configuration Section
const ACTION_TYPES = [
  { id: "none", label: "None", description: "No post-action" },
  { id: "create_children_text", label: "Create Children (Text)", description: "Parse output and create child prompts from text" },
  { id: "create_children_json", label: "Create Children (JSON)", description: "Parse JSON output to create child prompts" },
  { id: "create_template", label: "Create Template", description: "Generate a template from the output" },
];

const ActionConfigSection = () => {
  const [actionType, setActionType] = useState("create_children_json");
  const [includeInCascade, setIncludeInCascade] = useState(true);

  return (
    <div className="space-y-4">
      {/* Action Type Selector */}
      <div className="space-y-1.5">
        <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Post Action</label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full h-8 px-2.5 flex items-center justify-between bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface">
              <span className="flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 text-on-surface-variant" />
                {ACTION_TYPES.find(a => a.id === actionType)?.label || "None"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 bg-surface-container-high border-outline-variant">
            {ACTION_TYPES.map(action => (
              <DropdownMenuItem 
                key={action.id} 
                onClick={() => setActionType(action.id)}
                className="text-body-sm text-on-surface hover:bg-on-surface/[0.08] cursor-pointer"
              >
                <div className="flex-1">
                  <span className="block">{action.label}</span>
                  <span className="text-[10px] text-on-surface-variant">{action.description}</span>
                </div>
                {actionType === action.id && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Action Configuration (shown when action type is not none) */}
      {actionType !== "none" && (
        <div className="p-3 bg-surface-container-low rounded-m3-lg border border-outline-variant space-y-3">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-on-surface-variant" />
            <span className="text-label-sm text-on-surface font-medium">Action Configuration</span>
          </div>

          {actionType === "create_children_json" && (
            <>
              {/* JSON Path */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">JSON Path</label>
                <input
                  type="text"
                  defaultValue="$.items[*]"
                  placeholder="$.items[*]"
                  className="w-full h-8 px-2.5 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[10px] text-on-surface-variant">Path to array of items to create as children</p>
              </div>

              {/* Name Field */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Name Field</label>
                <input
                  type="text"
                  defaultValue="title"
                  placeholder="title"
                  className="w-full h-8 px-2.5 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Content Field */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Content Field</label>
                <input
                  type="text"
                  defaultValue="content"
                  placeholder="content"
                  className="w-full h-8 px-2.5 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </>
          )}

          {actionType === "create_children_text" && (
            <>
              {/* Delimiter */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Delimiter</label>
                <input
                  type="text"
                  defaultValue="---"
                  placeholder="---"
                  className="w-full h-8 px-2.5 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[10px] text-on-surface-variant">Text separator between child items</p>
              </div>

              {/* Skip Empty */}
              <div className="flex items-center justify-between">
                <span className="text-body-sm text-on-surface">Skip empty sections</span>
                <Switch defaultChecked />
              </div>
            </>
          )}

          {actionType === "create_template" && (
            <>
              {/* Library Prompt */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Template Source</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-full h-8 px-2.5 flex items-center justify-between bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface">
                      <span className="flex items-center gap-2">
                        <Library className="h-3.5 w-3.5 text-on-surface-variant" />
                        JSON Output Format
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-full bg-surface-container-high border-outline-variant">
                    <DropdownMenuItem className="text-body-sm text-on-surface">Professional Tone</DropdownMenuItem>
                    <DropdownMenuItem className="text-body-sm text-on-surface">JSON Output Format</DropdownMenuItem>
                    <DropdownMenuItem className="text-body-sm text-on-surface">Error Handler</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Template Name Pattern */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Name Pattern</label>
                <input
                  type="text"
                  defaultValue="{{parent_name}}_template"
                  placeholder="{{parent_name}}_template"
                  className="w-full h-8 px-2.5 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Cascade Toggle */}
      <div className="p-3 bg-surface-container-low rounded-m3-lg border border-outline-variant">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-on-surface-variant" />
            <div>
              <span className="text-body-sm text-on-surface font-medium">Include in Cascade</span>
              <p className="text-[10px] text-on-surface-variant">Run this prompt during cascade execution</p>
            </div>
          </div>
          <Switch checked={includeInCascade} onCheckedChange={setIncludeInCascade} />
        </div>
      </div>

      {/* Action Preview */}
      {actionType !== "none" && (
        <div className="p-2 bg-secondary-container/30 rounded-m3-md border border-outline-variant">
          <div className="flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-on-surface-variant" />
            <span className="text-[10px] text-on-surface-variant">
              After execution, output will be parsed and {
                actionType === "create_children_json" ? "JSON items will become child prompts" :
                actionType === "create_children_text" ? "text sections will become child prompts" :
                "a new template will be created"
              }
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Enhanced Variables Tab Content
const VariablesTabContent = ({ promptData, promptVariables = [] }) => {
  const [showValues, setShowValues] = useState(true);
  
  // Use real extracted_variables from promptData, fallback to promptVariables, then mock
  const variables = useMemo(() => {
    // First try extracted_variables from the prompt
    if (promptData?.extracted_variables && Array.isArray(promptData.extracted_variables) && promptData.extracted_variables.length > 0) {
      return promptData.extracted_variables.map(v => ({
        name: v.name || v,
        value: v.value || '',
        type: v.type || 'text',
        source: v.source || 'input',
        required: v.required ?? true,
        description: v.description || '',
      }));
    }
    // Then try promptVariables from the hook
    if (promptVariables.length > 0) {
      return promptVariables.map(v => ({
        name: v.variable_name,
        value: v.variable_value || v.default_value || '',
        type: 'text',
        source: 'input',
        required: v.is_required ?? true,
        description: v.variable_description || '',
      }));
    }
    // No fallback - return empty array
    return [];
  }, [promptData?.extracted_variables, promptVariables]);
  
  // Group variables by source
  const groupedVariables = variables.reduce((acc, variable) => {
    const source = variable.source || 'other';
    if (!acc[source]) acc[source] = [];
    acc[source].push(variable);
    return acc;
  }, {});

  const sourceLabels = {
    input: "User Input",
    database: "Database",
    settings: "Settings",
    secret: "Secrets",
    cascade: "Cascade",
    api: "External API"
  };

  const sourceColors = {
    input: "text-blue-500 bg-blue-500/10",
    database: "text-purple-500 bg-purple-500/10",
    settings: "text-green-500 bg-green-500/10",
    secret: "text-amber-500 bg-amber-500/10",
    cascade: "text-pink-500 bg-pink-500/10",
    api: "text-cyan-500 bg-cyan-500/10"
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Variables</label>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
            {variables.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => setShowValues(!showValues)}
                className="w-6 h-6 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]"
              >
                {showValues ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">{showValues ? "Hide Values" : "Show Values"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-6 h-6 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Add Variable</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Variables by source */}
      <div className="space-y-3">
        {Object.entries(groupedVariables).map(([source, variables]) => (
          <div key={source} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <SourceIcon source={source} />
              <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">
                {sourceLabels[source] || source}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${sourceColors[source] || 'bg-surface-container-high'}`}>
                {variables.length}
              </span>
            </div>
            <div className="space-y-1">
              {variables.map((variable) => (
                <div 
                  key={variable.name}
                  className="flex items-center gap-2.5 p-2 bg-surface-container rounded-m3-sm border border-outline-variant group"
                >
                  <VariableTypeIcon type={variable.type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-body-sm text-on-surface font-medium font-mono">{variable.name}</span>
                      {variable.required && <span className="text-[10px] text-destructive">*</span>}
                      {variable.isSecret && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-600">secret</span>
                      )}
                    </div>
                    {variable.description && (
                      <p className="text-[10px] text-on-surface-variant truncate">{variable.description}</p>
                    )}
                  </div>
                  <div className="w-36 shrink-0">
                    {showValues ? (
                      <input
                        type={variable.isSecret ? "password" : "text"}
                        defaultValue={variable.value}
                        placeholder="Enter value..."
                        className="w-full h-7 px-2 bg-surface-container-high rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                      />
                    ) : (
                      <div className="h-7 px-2 flex items-center bg-surface-container-high rounded-m3-sm border border-outline-variant text-body-sm text-on-surface-variant">
                        ••••••
                      </div>
                    )}
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-6 h-6 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08] opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Delete</TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Missing Variables Warning */}
      <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 rounded-m3-md border border-amber-500/20">
        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-body-sm text-amber-700 font-medium">1 missing required variable</p>
          <p className="text-[10px] text-amber-600">customer_message needs a value before running</p>
        </div>
      </div>
    </div>
  );
};

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
  models = [],
  schemas = [],
  libraryItems = [],
  // Run prompt handlers
  onRunPrompt,
  onRunCascade,
  isRunningPrompt = false,
  isRunningCascade = false,
}) => {
  const [activeTab, setActiveTab] = useState("prompt");
  const [isAssistantEnabled, setIsAssistantEnabled] = useState(promptData?.is_assistant || false);
  const formattedTime = useTimer(isRunningPrompt);

  // Update isAssistantEnabled when promptData changes
  useEffect(() => {
    if (promptData) {
      setIsAssistantEnabled(promptData.is_assistant || false);
    }
  }, [promptData?.is_assistant]);

  const tabs = [
    { id: "prompt", icon: FileText, label: "Prompt" },
    { id: "settings", icon: Sliders, label: "Settings" },
    { id: "variables", icon: Variable, label: "Variables" },
  ];

  if (!hasSelection) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-auto bg-surface">
        {/* Header with toggle button when conversation panel is closed */}
        {!conversationPanelOpen && onToggleConversation && (
          <div className="h-14 flex items-center justify-end px-3 border-b border-outline-variant shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onToggleConversation} className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                  <PanelRightOpen className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Show Conversation</TooltipContent>
            </Tooltip>
          </div>
        )}
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
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-outline-variant shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-title-sm text-on-surface font-medium">{promptName}</h2>
          <LabelPicker 
            labels={promptData?.labels || []} 
            onLabelsChange={(newLabels) => onUpdateField?.('labels', newLabels)}
            maxDisplay={2}
          />
        </div>
        <div className="flex items-center gap-0.5">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-surface-container-high border-outline-variant">
              <DropdownMenuItem className="text-body-sm"><Star className="h-3.5 w-3.5 mr-2" /> Star</DropdownMenuItem>
              <DropdownMenuItem className="text-body-sm"><Copy className="h-3.5 w-3.5 mr-2" /> Duplicate</DropdownMenuItem>
              <DropdownMenuItem className="text-body-sm"><Share2 className="h-3.5 w-3.5 mr-2" /> Share</DropdownMenuItem>
              <DropdownMenuSeparator className="bg-outline-variant" />
              <DropdownMenuItem className="text-body-sm text-destructive"><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
        </div>
        <div className="flex items-center gap-0.5 ml-2">
          {isRunningPrompt && (
            <span className="text-[10px] text-primary font-medium tabular-nums mr-1">
              {formattedTime}
            </span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => onRunPrompt?.(selectedPromptId)}
                disabled={isRunningPrompt}
                className={`w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container ${isRunningPrompt ? 'text-primary' : 'text-on-surface-variant'}`}
              >
                {isRunningPrompt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">{isRunningPrompt ? 'Running...' : 'Run Prompt'}</TooltipContent>
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
              variables={variables}
            />
          )}
          {activeTab === "settings" && (
            <SettingsTabContent 
              promptData={promptData}
              onUpdateField={onUpdateField}
              models={models}
            />
          )}
          {activeTab === "variables" && (
            <VariablesTabContent 
              promptData={promptData}
              promptVariables={variables}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PromptsContent;
