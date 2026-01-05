import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useModels } from '@/hooks/useModels';
import { usePromptLibrary } from '@/hooks/usePromptLibrary';
import { 
  FileText, Braces, Link2, Copy, Download, Trash2,
  LayoutTemplate, Variable, Code, Eye, Plus, GripVertical,
  ChevronRight, ChevronDown, Settings, ArrowRight, Layers,
  Edit3, Check, X, AlertCircle, Upload, Paperclip, CheckCircle2,
  Clock, XCircle, Loader2, Save, Sliders, Play, Workflow,
  MoreVertical, Star, Share2, PanelRightOpen, PanelLeftOpen, Library, Search,
  Bot, Thermometer, Zap, Globe, Briefcase, GitBranch, Hash,
  List, ToggleLeft, User, Database, EyeOff, RefreshCw
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LabelPicker } from "@/components/ui/label-picker";
import { LabelBadge } from "@/components/ui/label-badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { SettingCard } from "@/components/ui/setting-card";
import { SettingRow } from "@/components/ui/setting-row";
import { SettingDivider } from "@/components/ui/setting-divider";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SettingSelect, SettingModelSelect } from "@/components/ui/setting-select";
import { VariablePicker, ResizablePromptArea } from "@/components/shared";
import TemplateStructureEditor from "@/components/templates/TemplateStructureEditor";
import TemplateVariablesTab from "@/components/templates/TemplateVariablesTab";
import JsonSchemaEditor from "@/components/templates/JsonSchemaEditor";

// Source options for variable mappings
const SOURCE_OPTIONS = [
  { id: "manual", label: "Manual Input", icon: Edit3 },
  { id: "parent_output", label: "Parent Output", icon: ArrowRight },
  { id: "confluence", label: "Confluence Page", icon: FileText },
  { id: "variable", label: "Variable Reference", icon: Variable },
];

// No mock data - all data comes from props

// Variable definitions for hover tooltips
const VARIABLE_DEFINITIONS = {
  customer_message: { name: "customer_message", type: "text", description: "The customer's original inquiry or message", source: "User Input", required: true },
  ticket_count: { name: "ticket_count", type: "number", description: "Number of previous support tickets", source: "Database", required: false, default: "0" },
  company_name: { name: "company_name", type: "text", description: "Name of the company", source: "Settings", required: true },
  support_email: { name: "support_email", type: "text", description: "Support contact email address", source: "Settings", required: true },
  parent_output: { name: "parent.output", type: "reference", description: "Output from parent prompt", source: "Cascade", required: false },
};

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

// Tab Button for editor tabs
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

// Library Picker Dropdown
const LibraryPickerDropdown = ({ libraryItems = [], onSelect }) => {
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
          {filteredPrompts.length === 0 ? (
            <div className="px-2 py-3 text-body-sm text-on-surface-variant text-center">No prompts found</div>
          ) : (
            filteredPrompts.map(prompt => (
              <DropdownMenuItem 
                key={prompt.row_id} 
                className="text-body-sm text-on-surface hover:bg-on-surface/[0.08] cursor-pointer"
                onClick={() => onSelect?.(prompt.content || '')}
              >
                <span className="flex-1">{prompt.name}</span>
                {prompt.category && (
                  <LabelBadge label={prompt.category} size="xs" />
                )}
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// EditablePromptArea is now replaced by ResizablePromptArea from shared components

// Prompt Tab Content (for Prompt Templates)
const TemplatePromptTabContent = ({ templateData, onUpdateField, libraryItems = [] }) => {
  const systemPrompt = templateData?.structure?.input_admin_prompt || '';
  const userPrompt = templateData?.structure?.input_user_prompt || '';
  const outputResponse = templateData?.structure?.output_response || '';

  return (
    <div className="space-y-4">
      <ResizablePromptArea 
        label="System Prompt"
        value={systemPrompt}
        placeholder="Enter system prompt..."
        defaultHeight={160}
        onLibraryPick
        libraryItems={libraryItems}
        onSave={(value) => onUpdateField('structure.input_admin_prompt', value)}
        storageKey={`template-${templateData?.row_id || 'new'}-system`}
      />

      <ResizablePromptArea 
        label="User Prompt"
        value={userPrompt}
        placeholder="Enter user prompt..."
        defaultHeight={64}
        onLibraryPick
        libraryItems={libraryItems}
        onSave={(value) => onUpdateField('structure.input_user_prompt', value)}
        storageKey={`template-${templateData?.row_id || 'new'}-user`}
      />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Output</label>
            {outputResponse && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 flex items-center gap-1">
                <Check className="h-2.5 w-2.5" />
                Generated
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-6 h-6 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Regenerate</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-6 h-6 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Copy Output</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="min-h-36 p-2.5 bg-surface-container-low rounded-m3-md border border-outline-variant text-body-sm text-on-surface leading-relaxed whitespace-pre-wrap">
          {outputResponse || <span className="text-on-surface-variant opacity-50">No output yet. Run the prompt to generate a response.</span>}
        </div>
      </div>
    </div>
  );
};

// Settings Tab Content (for Prompt Templates) - with dynamic model-aware parameters
const TemplateSettingsTabContent = ({ templateData, onUpdateField, models = [] }) => {
  const { getModelConfig } = useModels();

  const currentModel = templateData?.structure?.model || models.find(m => m.is_active)?.model_id || '';
  const modelConfig = getModelConfig(currentModel);
  const supportedSettings = modelConfig.supportedSettings || [];

  const [temperature, setTemperature] = useState([templateData?.structure?.temperature || 0.7]);
  const [maxTokens, setMaxTokens] = useState(templateData?.structure?.max_tokens || String(modelConfig.maxTokens));
  
  // Debounce ref for slider saves
  const sliderDebounceRef = useRef({});

  // Update max tokens when model changes
  useEffect(() => {
    if (!templateData?.structure?.max_tokens) {
      setMaxTokens(String(modelConfig.maxTokens));
    }
  }, [modelConfig.maxTokens, templateData?.structure?.max_tokens]);

  const handleModelChange = (modelId) => {
    onUpdateField?.('structure.model', modelId);
    const newConfig = getModelConfig(modelId);
    setMaxTokens(String(newConfig.maxTokens));
    onUpdateField?.(`structure.${newConfig.tokenParam}`, String(newConfig.maxTokens));
  };
  
  // Debounced slider change handler
  const handleDebouncedSliderChange = (field, value, setter) => {
    setter(value);
    
    // Clear existing debounce timer
    if (sliderDebounceRef.current[field]) {
      clearTimeout(sliderDebounceRef.current[field]);
    }
    
    // Set new debounce timer (500ms delay)
    sliderDebounceRef.current[field] = setTimeout(() => {
      onUpdateField?.(field, value[0]);
    }, 500);
  };

  // Get display name for current model
  const currentModelDisplay = models.find(m => m.model_id === currentModel || m.id === currentModel)?.model_name || currentModel;

  return (
    <div className="space-y-4">
      <SettingModelSelect
        value={templateData?.structure?.model || currentModel}
        onValueChange={handleModelChange}
        models={models}
        label="Model"
      />

      {/* Temperature - only show if model supports it */}
      {modelConfig.supportsTemperature && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Temperature</label>
            <span className="text-body-sm text-on-surface font-mono">{temperature[0]}</span>
          </div>
          <Slider
            value={temperature}
            onValueChange={(v) => handleDebouncedSliderChange('structure.temperature', v, setTemperature)}
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

      {/* Max Tokens - dynamic label based on model */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">
            {modelConfig.tokenParam === 'max_completion_tokens' ? 'Max Completion Tokens' : 'Max Tokens'}
          </label>
          <span className="text-[10px] text-on-surface-variant">Max: {modelConfig.maxTokens?.toLocaleString() ?? 'N/A'}</span>
        </div>
        <input
          type="number"
          value={maxTokens}
          onChange={(e) => {
            setMaxTokens(e.target.value);
            onUpdateField?.(`structure.${modelConfig.tokenParam}`, e.target.value);
          }}
          max={modelConfig.maxTokens}
          min={1}
          className="w-full h-8 px-2.5 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Reasoning Effort - only for GPT-5 and O-series */}
      {supportedSettings.includes('reasoning_effort') && (
        <SettingSelect
          value={templateData?.structure?.reasoning_effort || 'medium'}
          onValueChange={(value) => onUpdateField?.('structure.reasoning_effort', value)}
          options={[
            { value: 'none', label: 'none' },
            { value: 'minimal', label: 'minimal' },
            { value: 'low', label: 'low' },
            { value: 'medium', label: 'medium' },
            { value: 'high', label: 'high' },
            { value: 'xhigh', label: 'xhigh' },
          ]}
          label="Reasoning Effort"
        />
      )}

      <SettingSelect
        value=""
        onValueChange={() => {}}
        options={[]}
        label="JSON Schema (Optional)"
        placeholder="Select a schema..."
      />

      <div className="p-3 bg-surface-container-low rounded-m3-lg border border-outline-variant">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-on-surface-variant" />
            <div>
              <span className="text-body-sm text-on-surface font-medium">Assistant Mode</span>
              <p className="text-[10px] text-on-surface-variant">Enable conversational memory</p>
            </div>
          </div>
          <Switch 
            checked={templateData?.structure?.is_assistant || false}
            onCheckedChange={(checked) => onUpdateField?.('structure.is_assistant', checked)}
          />
        </div>
      </div>

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
                checked={templateData?.structure?.[tool.key] || false}
                onCheckedChange={(checked) => onUpdateField?.(`structure.${tool.key}`, checked)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Node Editor Panel for Structure Tab
const StructureNodeEditor = ({ node, onUpdate, onClose }) => {
  const [editedNode, setEditedNode] = useState({ ...node });

  const handleFieldChange = (field, value) => {
    setEditedNode(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onUpdate(editedNode);
    onClose();
  };

  return (
    <div className="bg-surface-container rounded-m3-lg border border-outline-variant p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Edit3 className="h-4 w-4 text-on-surface-variant" />
          <span className="text-body-sm text-on-surface font-medium">Edit Prompt</span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={handleSave}
                className="w-7 h-7 flex items-center justify-center rounded-m3-full text-primary hover:bg-primary/10"
              >
                <Check className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Save</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
              >
                <X className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Cancel</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Prompt Name */}
      <div className="space-y-1">
        <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Prompt Name</label>
        <input
          type="text"
          value={editedNode.prompt_name || editedNode.name || ''}
          onChange={(e) => handleFieldChange('prompt_name', e.target.value)}
          className="w-full px-3 py-2 text-body-sm bg-surface-container-low border border-outline-variant rounded-m3-sm text-on-surface focus:outline-none focus:border-primary"
          placeholder="Enter prompt name..."
        />
      </div>

      {/* System Prompt */}
      <div className="space-y-1">
        <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">System Prompt</label>
        <textarea
          value={editedNode.input_admin_prompt || ''}
          onChange={(e) => handleFieldChange('input_admin_prompt', e.target.value)}
          className="w-full px-3 py-2 text-body-sm bg-surface-container-low border border-outline-variant rounded-m3-sm text-on-surface focus:outline-none focus:border-primary min-h-24 resize-y font-mono text-[11px]"
          placeholder="Enter system prompt..."
        />
      </div>

      {/* User Prompt */}
      <div className="space-y-1">
        <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">User Prompt</label>
        <textarea
          value={editedNode.input_user_prompt || ''}
          onChange={(e) => handleFieldChange('input_user_prompt', e.target.value)}
          className="w-full px-3 py-2 text-body-sm bg-surface-container-low border border-outline-variant rounded-m3-sm text-on-surface focus:outline-none focus:border-primary min-h-16 resize-y font-mono text-[11px]"
          placeholder="Enter user prompt..."
        />
      </div>

      {/* Settings Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between p-2 bg-surface-container-low rounded-m3-sm border border-outline-variant">
          <div className="flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5 text-on-surface-variant" />
            <span className="text-tree text-on-surface">Assistant</span>
          </div>
          <Switch 
            checked={editedNode.is_assistant || false}
            onCheckedChange={(checked) => handleFieldChange('is_assistant', checked)}
          />
        </div>
        <div className="flex items-center justify-between p-2 bg-surface-container-low rounded-m3-sm border border-outline-variant">
          <div className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-on-surface-variant" />
            <span className="text-tree text-on-surface">Web Search</span>
          </div>
          <Switch 
            checked={editedNode.web_search_on || false}
            onCheckedChange={(checked) => handleFieldChange('web_search_on', checked)}
          />
        </div>
        <div className="flex items-center justify-between p-2 bg-surface-container-low rounded-m3-sm border border-outline-variant">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-on-surface-variant" />
            <span className="text-tree text-on-surface">Confluence</span>
          </div>
          <Switch 
            checked={editedNode.confluence_enabled || false}
            onCheckedChange={(checked) => handleFieldChange('confluence_enabled', checked)}
          />
        </div>
        <div className="flex items-center justify-between p-2 bg-surface-container-low rounded-m3-sm border border-outline-variant">
          <div className="flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 text-on-surface-variant" />
            <span className="text-tree text-on-surface">File Search</span>
          </div>
          <Switch 
            checked={editedNode.file_search_on || false}
            onCheckedChange={(checked) => handleFieldChange('file_search_on', checked)}
          />
        </div>
      </div>

      {/* Model Settings */}
      <div className="space-y-2">
        <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Model Settings</label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="text-[10px] text-on-surface-variant">Model</span>
            <input
              type="text"
              value={editedNode.model || ''}
              onChange={(e) => handleFieldChange('model', e.target.value)}
              className="w-full px-2 py-1.5 text-tree bg-surface-container-low border border-outline-variant rounded-m3-sm text-on-surface focus:outline-none focus:border-primary"
              placeholder="e.g. gpt-4o"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-on-surface-variant">Temperature</span>
            <input
              type="text"
              value={editedNode.temperature || ''}
              onChange={(e) => handleFieldChange('temperature', e.target.value)}
              className="w-full px-2 py-1.5 text-tree bg-surface-container-low border border-outline-variant rounded-m3-sm text-on-surface focus:outline-none focus:border-primary"
              placeholder="0.7"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Structure Tab Content - for Prompt Templates (shows hierarchy of child prompts)
const TemplateStructureTabContent = ({ structure, onStructureChange }) => {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [localStructure, setLocalStructure] = useState(structure);

  // Sync local structure with prop
  useEffect(() => {
    setLocalStructure(structure);
  }, [structure]);

  // Find node by id recursively
  const findNodeById = (node, id) => {
    if (!node) return null;
    const nodeId = node._id || node.id || node.row_id;
    if (nodeId === id) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNodeById(child, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Update node in structure recursively
  const updateNodeInStructure = (node, id, updates) => {
    if (!node) return node;
    const nodeId = node._id || node.id || node.row_id;
    if (nodeId === id) {
      return { ...node, ...updates };
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map(child => updateNodeInStructure(child, id, updates))
      };
    }
    return node;
  };

  const handleNodeUpdate = (updatedNode) => {
    const nodeId = updatedNode._id || updatedNode.id || updatedNode.row_id;
    const newStructure = updateNodeInStructure(localStructure, nodeId, updatedNode);
    setLocalStructure(newStructure);
    onStructureChange?.(newStructure);
  };

  // Recursively count total children
  const countChildren = (node) => {
    if (!node?.children?.length) return 0;
    return node.children.length + node.children.reduce((acc, child) => acc + countChildren(child), 0);
  };

  const totalChildren = countChildren(localStructure);
  const hasChildren = localStructure?.children?.length > 0;
  const selectedNode = selectedNodeId ? findNodeById(localStructure, selectedNodeId) : null;

  // Recursive structure node renderer
  const StructureTreeNode = ({ node, level = 0 }) => {
    const [expanded, setExpanded] = useState(true);
    const nodeChildren = node?.children || [];
    const hasNodeChildren = nodeChildren.length > 0;
    const nodeId = node?._id || node?.id || node?.row_id;
    const isSelected = nodeId === selectedNodeId;

    return (
      <div>
        <div 
          className={`flex items-center gap-2 p-2 rounded-m3-sm cursor-pointer group transition-colors ${
            isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-on-surface/[0.08]'
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => setSelectedNodeId(isSelected ? null : nodeId)}
        >
          {hasNodeChildren ? (
            <button 
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} 
              className="p-0.5"
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-on-surface-variant" />
              )}
            </button>
          ) : (
            <div className="w-4" />
          )}
          
          <FileText className={`h-3.5 w-3.5 ${isSelected ? 'text-primary' : 'text-on-surface-variant'}`} />
          
          <span className={`text-body-sm flex-1 truncate ${isSelected ? 'text-primary font-medium' : 'text-on-surface'}`}>
            {node?.prompt_name || node?.name || "Unnamed Prompt"}
          </span>
          
          {node?.is_assistant && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              assistant
            </span>
          )}
          
          {hasNodeChildren && (
            <span className="text-[10px] text-on-surface-variant">
              {nodeChildren.length} child{nodeChildren.length !== 1 ? 'ren' : ''}
            </span>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={(e) => { e.stopPropagation(); setSelectedNodeId(nodeId); }}
                className="w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant opacity-0 group-hover:opacity-100 hover:bg-on-surface/[0.08]"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Edit</TooltipContent>
          </Tooltip>
        </div>
        
        {expanded && hasNodeChildren && (
          <div>
            {nodeChildren.map((child, idx) => (
              <StructureTreeNode 
                key={child._id || child.id || child.row_id || idx} 
                node={child} 
                level={level + 1} 
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!localStructure) {
    return (
      <div className="text-center py-12 text-on-surface-variant">
        <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-body-sm">No structure defined</p>
        <p className="text-[10px] opacity-70 mt-1">This template has no prompt hierarchy</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-on-surface-variant" />
          <span className="text-label-sm text-on-surface-variant uppercase">
            Prompt Hierarchy ({totalChildren + 1} prompt{totalChildren > 0 ? 's' : ''})
          </span>
        </div>
        {selectedNode && (
          <span className="text-[10px] text-primary">Click prompt to edit</span>
        )}
      </div>

      <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant p-2">
        {/* Root prompt */}
        <StructureTreeNode node={localStructure} level={0} />
      </div>

      {/* Node Editor Panel */}
      {selectedNode && (
        <StructureNodeEditor 
          node={selectedNode}
          onUpdate={handleNodeUpdate}
          onClose={() => setSelectedNodeId(null)}
        />
      )}

      {!hasChildren && !selectedNode && (
        <div className="flex items-start gap-2 p-2.5 bg-surface-container rounded-m3-md border border-outline-variant">
          <AlertCircle className="h-4 w-4 text-on-surface-variant shrink-0 mt-0.5" />
          <div>
            <p className="text-body-sm text-on-surface">Single prompt template</p>
            <p className="text-[10px] text-on-surface-variant">This template has no child prompts</p>
          </div>
        </div>
      )}

      {hasChildren && !selectedNode && (
        <div className="flex items-start gap-2 p-2.5 bg-primary/5 rounded-m3-md border border-primary/20">
          <Layers className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-body-sm text-on-surface">Cascade template</p>
            <p className="text-[10px] text-on-surface-variant">
              Contains {totalChildren} child prompt{totalChildren !== 1 ? 's' : ''} that will be created as a hierarchy
            </p>
          </div>
        </div>
      )}
    </div>
  );
};


const getFileIcon = (type) => {
  if (type.includes('pdf')) return FileText;
  if (type.includes('json')) return Braces;
  if (type.includes('word') || type.includes('document')) return FileText;
  return Paperclip;
};

// Format file size
const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Attachments Tab Component
const AttachmentsTab = () => {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Upload Dropzone */}
      <div 
        className={`border-2 border-dashed rounded-m3-lg p-6 text-center transition-colors ${
          isDragging 
            ? "border-primary bg-primary/5" 
            : "border-outline-variant hover:border-on-surface-variant"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={() => setIsDragging(false)}
      >
        <Upload className="h-8 w-8 text-on-surface-variant mx-auto mb-2" />
        <p className="text-body-sm text-on-surface">Drop files here or click to upload</p>
        <p className="text-[10px] text-on-surface-variant mt-1">PDF, DOCX, TXT, JSON up to 10MB</p>
      </div>

      <div className="space-y-1.5">
        <span className="text-label-sm text-on-surface-variant uppercase">Attached Files (0)</span>
        <div className="space-y-2 text-center py-4">
          <p className="text-body-sm text-on-surface-variant">No files attached</p>
        </div>
      </div>
    </div>
  );
};

// AttachmentsTabWithFiles component accepts real files via props

// Continue with file list (empty by default)
const AttachmentsTabWithFiles = ({ files = [] }) => {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="space-y-4 max-w-2xl">
      <div 
        className={`border-2 border-dashed rounded-m3-lg p-6 text-center transition-colors ${
          isDragging 
            ? "border-primary bg-primary/5" 
            : "border-outline-variant hover:border-on-surface-variant"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={() => setIsDragging(false)}
      >
        <Upload className="h-8 w-8 text-on-surface-variant mx-auto mb-2" />
        <p className="text-body-sm text-on-surface">Drop files here or click to upload</p>
      </div>
      <div className="space-y-1.5">
        <span className="text-label-sm text-on-surface-variant uppercase">Attached Files ({files.length})</span>
        {files.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant text-center py-4">No files attached</p>
        ) : files.map(file => {
            const FileIcon = getFileIcon(file.type);
            return (
              <div key={file.id} className="flex items-center gap-3 p-2.5 bg-surface-container rounded-m3-sm border border-outline-variant group">
                <div className="w-8 h-8 flex items-center justify-center bg-surface-container-high rounded-m3-sm">
                  <FileIcon className="h-4 w-4 text-on-surface-variant" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm text-on-surface truncate">{file.name}</p>
                  <p className="text-[10px] text-on-surface-variant">{formatFileSize(file.size)} • {file.uploadedAt}</p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="w-6 h-6 flex items-center justify-center rounded-m3-full text-destructive opacity-0 group-hover:opacity-100 hover:bg-on-surface/[0.08]">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Remove</TooltipContent>
                </Tooltip>
              </div>
            );
          })}
      </div>
    </div>
  );
};

// Structure Tree Node Component
const StructureNode = ({ node, level = 0 }) => {
  const [expanded, setExpanded] = useState(node.expanded);
  const hasChildren = node.children && node.children.length > 0;
  
  const typeColors = {
    system: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    user: "bg-green-500/10 text-green-600 border-green-500/20",
    output: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    section: "bg-surface-container text-on-surface-variant border-outline-variant",
  };

  return (
    <div>
      <div 
        className={`flex items-center gap-2 p-2 rounded-m3-sm hover:bg-on-surface/[0.08] cursor-pointer group`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        <GripVertical className="h-3.5 w-3.5 text-on-surface-variant/50 opacity-0 group-hover:opacity-100" />
        
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="p-0.5">
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-on-surface-variant" />
            )}
          </button>
        ) : (
          <div className="w-4" />
        )}
        
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${typeColors[node.type] || typeColors.section}`}>
          {node.type}
        </span>
        
        <span className="text-body-sm text-on-surface flex-1">{node.name || node.prompt_name || "Unnamed"}</span>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant opacity-0 group-hover:opacity-100 hover:bg-on-surface/[0.08]">
              <Settings className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">Settings</TooltipContent>
        </Tooltip>
      </div>
      
      {expanded && hasChildren && (
        <div>
          {node.children.map((child, idx) => (
            <StructureNode key={child.id || child._id || idx} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

// Variable Mapping Row Component
const MappingRow = ({ mapping, onEdit }) => {
  const source = SOURCE_OPTIONS.find(s => s.id === mapping.source);
  const SourceIcon = source?.icon || Variable;

  return (
    <div className="flex items-center gap-3 p-2.5 bg-surface-container rounded-m3-sm border border-outline-variant">
      <code className="text-body-sm text-on-surface font-mono font-medium w-32 truncate">
        {mapping.variable}
      </code>
      
      <ArrowRight className="h-3.5 w-3.5 text-on-surface-variant flex-shrink-0" />
      
      <div className="flex items-center gap-2 flex-1">
        <span className="flex items-center gap-1.5 text-[10px] px-2 py-1 bg-secondary-container text-secondary-container-foreground rounded-m3-sm">
          <SourceIcon className="h-3 w-3" />
          {source?.label}
        </span>
        
        {mapping.value && (
          <code className="text-tree text-on-surface-variant font-mono truncate">
            {mapping.value}
          </code>
        )}
      </div>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            onClick={() => onEdit?.(mapping)}
            className="w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="text-[10px]">Edit Mapping</TooltipContent>
      </Tooltip>
    </div>
  );
};

// Enhanced Preview Panel with Live Variable Resolution
const EnhancedPreviewPanel = ({ template, variables = [] }) => {
  const [resolveMode, setResolveMode] = useState(false);
  
  const resolvedValues = useMemo(() => {
    const values = {};
    variables.forEach(v => {
      const name = v.name || v.variable_name;
      values[name] = v.default || v.default_value || `[${name}]`;
    });
    return values;
  }, [variables]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-label-sm text-on-surface-variant uppercase">Live Preview</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-on-surface-variant">Resolve Variables</span>
          <Switch checked={resolveMode} onCheckedChange={setResolveMode} />
        </div>
      </div>
      
      <div className="p-3 bg-surface-container-low rounded-m3-lg border border-outline-variant">
        <div className="space-y-3">
          <div className="p-3 bg-surface-container rounded-m3-md">
            <span className="text-[10px] text-on-surface-variant uppercase">System Prompt</span>
            <p className="text-body-sm text-on-surface mt-1">
              {template?.structure?.input_admin_prompt || "No system prompt defined"}
            </p>
          </div>
          
          <div className="p-3 bg-surface-container rounded-m3-md">
            <span className="text-[10px] text-on-surface-variant uppercase">User Prompt</span>
            <p className="text-body-sm text-on-surface mt-1">
              {template?.structure?.input_user_prompt || "No user prompt defined"}
            </p>
          </div>
        </div>
      </div>
      
      {/* Variable Status */}
      {variables.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] text-on-surface-variant uppercase">Variable Status</span>
          <div className="grid grid-cols-2 gap-2">
            {variables.slice(0, 4).map((v, idx) => {
              const name = v.name || v.variable_name;
              return (
                <div key={idx} className="flex items-center gap-2 p-2 bg-surface-container rounded-m3-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  <code className="text-[10px] text-on-surface font-mono">{name}</code>
                  {resolveMode && resolvedValues[name] && (
                    <span className="text-[10px] text-on-surface-variant truncate ml-auto">= {resolvedValues[name]}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-m3-md">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <span className="text-body-sm text-green-700">All variables resolved</span>
      </div>
    </div>
  );
};

const TemplatesContent = ({ 
  selectedTemplate, 
  activeTemplateTab = "prompts",
  // Real data hooks - Phase 5
  templatesHook,
  jsonSchemaTemplatesHook,
  onTemplateChange,
  models = [],
  folderPanelOpen,
  onToggleFolderPanel,
}) => {
  const { items: libraryItems } = usePromptLibrary();
  const [activeEditorTab, setActiveEditorTab] = useState("prompt");
  const [editedTemplate, setEditedTemplate] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Sync editedTemplate with selectedTemplate
  useEffect(() => {
    if (selectedTemplate) {
      setEditedTemplate({ ...selectedTemplate });
      setHasUnsavedChanges(false);
    } else {
      setEditedTemplate(null);
    }
  }, [selectedTemplate?.row_id]);

  // Reset active tab when switching template types
  useEffect(() => {
    if (activeTemplateTab === "prompts") {
      setActiveEditorTab("prompt");
    } else if (activeTemplateTab === "schemas") {
      setActiveEditorTab("schema");
    } else if (activeTemplateTab === "mappings") {
      setActiveEditorTab("fields");
    }
  }, [activeTemplateTab]);

  // Get the display name and description from template
  const templateName = useMemo(() => {
    if (!editedTemplate) return "";
    return editedTemplate.template_name || editedTemplate.schema_name || editedTemplate.name || "Untitled";
  }, [editedTemplate]);

  const templateDescription = useMemo(() => {
    if (!editedTemplate) return "";
    return editedTemplate.template_description || editedTemplate.schema_description || editedTemplate.description || "";
  }, [editedTemplate]);

  // Extract variables from template
  const extractedVariables = useMemo(() => {
    if (!editedTemplate?.structure || !templatesHook?.extractTemplateVariables) return [];
    const varNames = templatesHook.extractTemplateVariables(editedTemplate.structure);
    return varNames.map(name => ({ name, type: "string", required: true }));
  }, [editedTemplate, templatesHook]);

  // Variable definitions from template
  const variableDefinitions = useMemo(() => {
    if (!editedTemplate?.variable_definitions) return [];
    if (Array.isArray(editedTemplate.variable_definitions)) {
      return editedTemplate.variable_definitions;
    }
    return [];
  }, [editedTemplate]);

  const displayVariables = variableDefinitions.length > 0 ? variableDefinitions : extractedVariables;

  // Handle field updates for template
  const handleUpdateField = useCallback((fieldPath, value) => {
    setEditedTemplate(prev => {
      if (!prev) return prev;
      // Handle nested paths like 'structure.input_admin_prompt'
      if (fieldPath.includes('.')) {
        const parts = fieldPath.split('.');
        const newTemplate = { ...prev };
        let current = newTemplate;
        for (let i = 0; i < parts.length - 1; i++) {
          current[parts[i]] = { ...(current[parts[i]] || {}) };
          current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
        return newTemplate;
      }
      return { ...prev, [fieldPath]: value };
    });
    setHasUnsavedChanges(true);
  }, []);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!editedTemplate?.row_id) return;
    
    setIsSaving(true);
    try {
      if (activeTemplateTab === "prompts" && templatesHook?.updateTemplate) {
        await templatesHook.updateTemplate(editedTemplate.row_id, {
          template_name: editedTemplate.template_name,
          template_description: editedTemplate.template_description,
          structure: editedTemplate.structure,
          variable_definitions: editedTemplate.variable_definitions,
          category: editedTemplate.category,
        });
      } else if (activeTemplateTab === "schemas" && jsonSchemaTemplatesHook?.updateTemplate) {
        await jsonSchemaTemplatesHook.updateTemplate(editedTemplate.row_id, {
          schema_name: editedTemplate.schema_name,
          schema_description: editedTemplate.schema_description,
          json_schema: editedTemplate.json_schema,
          category: editedTemplate.category,
        });
      }
      setHasUnsavedChanges(false);
      onTemplateChange?.(editedTemplate);
    } finally {
      setIsSaving(false);
    }
  }, [editedTemplate, activeTemplateTab, templatesHook, jsonSchemaTemplatesHook, onTemplateChange]);

  // Delete handler
  const handleDelete = useCallback(async () => {
    if (!editedTemplate?.row_id) return;
    
    if (activeTemplateTab === "prompts" && templatesHook?.deleteTemplate) {
      await templatesHook.deleteTemplate(editedTemplate.row_id);
    } else if (activeTemplateTab === "schemas" && jsonSchemaTemplatesHook?.deleteTemplate) {
      await jsonSchemaTemplatesHook.deleteTemplate(editedTemplate.row_id);
    }
    onTemplateChange?.(null);
  }, [editedTemplate, activeTemplateTab, templatesHook, jsonSchemaTemplatesHook, onTemplateChange]);

  // Duplicate handler
  const handleDuplicate = useCallback(async () => {
    if (!editedTemplate) return;
    
    if (activeTemplateTab === "prompts" && templatesHook?.createTemplate) {
      const newTemplate = await templatesHook.createTemplate({
        template_name: `${templateName} (copy)`,
        template_description: templateDescription,
        structure: editedTemplate.structure,
        variable_definitions: editedTemplate.variable_definitions,
        category: editedTemplate.category,
      });
      onTemplateChange?.(newTemplate);
    } else if (activeTemplateTab === "schemas" && jsonSchemaTemplatesHook?.createTemplate) {
      const newTemplate = await jsonSchemaTemplatesHook.createTemplate({
        schemaName: `${templateName} (copy)`,
        schemaDescription: templateDescription,
        jsonSchema: editedTemplate.json_schema,
        category: editedTemplate.category,
      });
      onTemplateChange?.(newTemplate);
    }
  }, [editedTemplate, activeTemplateTab, templatesHook, jsonSchemaTemplatesHook, templateName, templateDescription, onTemplateChange]);

  // Empty state when no template selected
  if (!selectedTemplate) {
    return (
      <div className="flex-1 flex flex-col bg-surface min-h-0">
        {/* Header with toggle button */}
        <div className="h-14 flex items-center px-3 border-b border-outline-variant shrink-0">
          {!folderPanelOpen && onToggleFolderPanel && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={onToggleFolderPanel} 
                  className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Show templates panel</TooltipContent>
            </Tooltip>
          )}
        </div>
        {/* Empty state content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-on-surface-variant">
            <LayoutTemplate className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-body-md">Select a template to view</p>
            <p className="text-label-md mt-1">or create a new one</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-0">
      {/* Header - 56px */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-outline-variant shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-title-sm text-on-surface font-medium">{templateName}</h2>
          {activeTemplateTab === "prompts" && (
            <LabelPicker 
              labels={editedTemplate?.labels || []} 
              onLabelsChange={(labels) => handleUpdateField('labels', labels)}
              maxDisplay={2}
            />
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Save button - shown when there are unsaved changes */}
          {hasUnsavedChanges && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-8 h-8 flex items-center justify-center rounded-m3-full text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Save Changes</TooltipContent>
            </Tooltip>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-surface-container-high border-outline-variant">
              <DropdownMenuItem className="text-tree"><Star className="h-3.5 w-3.5 mr-2" /> Star</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate} className="text-tree"><Copy className="h-3.5 w-3.5 mr-2" /> Duplicate</DropdownMenuItem>
              <DropdownMenuItem className="text-tree"><Share2 className="h-3.5 w-3.5 mr-2" /> Share</DropdownMenuItem>
              <DropdownMenuSeparator className="bg-outline-variant" />
              <DropdownMenuItem onClick={handleDelete} className="text-tree text-destructive"><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs with Actions */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-outline-variant shrink-0">
        <div className="flex items-center gap-0.5">
          {activeTemplateTab === "prompts" && (
            <>
              <TabButton icon={FileText} label="Prompt" isActive={activeEditorTab === "prompt"} onClick={() => setActiveEditorTab("prompt")} />
              <TabButton icon={GitBranch} label="Structure" isActive={activeEditorTab === "structure"} onClick={() => setActiveEditorTab("structure")} />
              <TabButton icon={Sliders} label="Settings" isActive={activeEditorTab === "settings"} onClick={() => setActiveEditorTab("settings")} />
              <TabButton icon={Variable} label="Variables" isActive={activeEditorTab === "variables"} onClick={() => setActiveEditorTab("variables")} />
            </>
          )}
          {/* JsonSchemaEditor has internal tabs - no external tabs needed for schemas */}
          {activeTemplateTab === "mappings" && (
            <>
              <TabButton icon={FileText} label="Fields" isActive={activeEditorTab === "fields"} onClick={() => setActiveEditorTab("fields")} />
              <TabButton icon={Link2} label="Mappings" isActive={activeEditorTab === "mappings"} onClick={() => setActiveEditorTab("mappings")} />
            </>
          )}
        </div>
        {activeTemplateTab === "prompts" && (
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container">
                  <Play className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Run Prompt</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                  <Workflow className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Run Cascade</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                  <Download className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Export</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-3xl">
          {/* Prompt Tab - for Prompt Templates */}
{activeEditorTab === "prompt" && activeTemplateTab === "prompts" && (
            <TemplatePromptTabContent 
              templateData={editedTemplate}
              onUpdateField={handleUpdateField}
              libraryItems={libraryItems}
            />
          )}

          {/* Settings Tab - for Prompt Templates */}
          {activeEditorTab === "settings" && activeTemplateTab === "prompts" && (
            <TemplateSettingsTabContent 
              templateData={editedTemplate}
              onUpdateField={handleUpdateField}
              models={models}
            />
          )}

          {/* Variables Tab - for Prompt Templates - uses working component */}
          {activeEditorTab === "variables" && activeTemplateTab === "prompts" && (
            <TemplateVariablesTab 
              structure={editedTemplate?.structure}
              variableDefinitions={editedTemplate?.variable_definitions || []}
              onChange={(newVars) => handleUpdateField('variable_definitions', newVars)}
            />
          )}

          {/* Structure Tab - for Prompt Templates - uses unified TemplateStructureEditor */}
          {activeEditorTab === "structure" && activeTemplateTab === "prompts" && (
            <TemplateStructureEditor 
              structure={editedTemplate?.structure} 
              onChange={(newStructure) => handleUpdateField('structure', newStructure)}
              variableDefinitions={displayVariables}
            />
          )}
        </div>

        {/* Schema Editor - handles visual, JSON, and preview tabs internally */}
        {activeTemplateTab === "schemas" && editedTemplate && (
          <div className="max-w-3xl">
            <JsonSchemaEditor 
              template={editedTemplate}
              onUpdate={async (rowId, updates) => {
                if (jsonSchemaTemplatesHook?.updateTemplate) {
                  await jsonSchemaTemplatesHook.updateTemplate(rowId, updates);
                }
                setEditedTemplate(prev => ({ ...prev, ...updates }));
                setHasUnsavedChanges(false);
                onTemplateChange?.(editedTemplate);
              }}
            />
          </div>
        )}

        {/* Mappings Fields Tab */}
        {activeTemplateTab === "mappings" && activeEditorTab === "fields" && (
          <div className="space-y-4 max-w-2xl">
            <div className="space-y-1.5">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Selected Fields</label>
              <div className="flex flex-wrap gap-1.5">
                {["System Prompt", "User Prompt", "Output", "Variables", "Model Settings"].map(field => (
                  <span key={field} className="text-body-sm px-2 py-1 bg-secondary-container text-secondary-container-foreground rounded-m3-sm flex items-center gap-1">
                    {field}
                    <button className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
            
            <SettingCard label="Export Options">
              <div className="space-y-3">
                <SettingRow label="Include metadata" description="Add timestamps and version info">
                  <Switch defaultChecked />
                </SettingRow>
                <SettingDivider />
                <SettingRow label="Resolve variables" description="Replace variables with actual values">
                  <Switch />
                </SettingRow>
              </div>
            </SettingCard>
          </div>
        )}

        {/* Mappings Tab */}
        {activeTemplateTab === "mappings" && activeEditorTab === "mappings" && (
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center justify-between">
              <span className="text-label-sm text-on-surface-variant uppercase">Variable Mappings</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                    <Plus className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Add Mapping</TooltipContent>
              </Tooltip>
            </div>
            
            <div className="space-y-2">
              {(editedTemplate?.mappings || []).length === 0 ? (
                <div className="text-center py-8 text-on-surface-variant">
                  <Link2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-body-sm">No mappings defined</p>
                  <p className="text-[10px] opacity-70 mt-0.5">Add mappings to connect variables to data sources</p>
                </div>
              ) : (
                (editedTemplate?.mappings || []).map(mapping => (
                  <MappingRow key={mapping.variable} mapping={mapping} onEdit={(m) => console.log('Edit mapping:', m)} />
                ))
              )}
            </div>
            
            <p className="text-[10px] text-on-surface-variant">
              Map template variables to data sources for automatic population.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplatesContent;