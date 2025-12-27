import React, { useState, useCallback, useMemo } from "react";
import { 
  FileText, Braces, Link2, Copy, Download, Trash2,
  LayoutTemplate, Variable, Code, Eye, Plus, GripVertical,
  ChevronRight, ChevronDown, Settings, ArrowRight, Layers,
  Edit3, Check, X, AlertCircle, Upload, Paperclip, CheckCircle2,
  Clock, XCircle, Loader2, Save, Sliders, Play, Workflow,
  MoreVertical, Star, Share2, PanelRightOpen, Library, Search,
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
import { MockupVariablePicker } from "../shared/MockupVariablePicker";

// Mock structure data (fallback when no structure exists)
const MOCK_STRUCTURE = [
  { 
    id: "1", 
    name: "System Context", 
    type: "system", 
    expanded: true,
    children: [
      { id: "1a", name: "Role Definition", type: "section" },
      { id: "1b", name: "Constraints", type: "section" },
    ]
  },
  { 
    id: "2", 
    name: "User Input Processing", 
    type: "user", 
    expanded: true,
    children: [
      { id: "2a", name: "Input Validation", type: "section" },
      { id: "2b", name: "Context Injection", type: "section" },
    ]
  },
  { 
    id: "3", 
    name: "Output Format", 
    type: "output", 
    expanded: false,
    children: []
  },
];

const MOCK_VARIABLE_MAPPINGS = [
  { variable: "customer_name", source: "manual", value: "" },
  { variable: "ticket_id", source: "parent_output", value: "parent.ticket.id" },
  { variable: "priority", source: "manual", value: "high" },
  { variable: "context", source: "confluence", value: "Product Requirements" },
];

const SOURCE_OPTIONS = [
  { id: "manual", label: "Manual Input", icon: Edit3 },
  { id: "parent_output", label: "Parent Output", icon: ArrowRight },
  { id: "confluence", label: "Confluence Page", icon: FileText },
  { id: "variable", label: "Variable Reference", icon: Variable },
];

// Mock attachments data
const MOCK_ATTACHMENTS = [
  { id: "1", name: "product-guide.pdf", type: "application/pdf", size: 2456789, uploadedAt: "2024-01-15" },
  { id: "2", name: "faq-responses.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 156234, uploadedAt: "2024-01-14" },
  { id: "3", name: "support-templates.json", type: "application/json", size: 8934, uploadedAt: "2024-01-13" },
];

// Mock models and schemas (for Settings tab)
const MOCK_MODELS = [
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
  { id: "o1-preview", name: "O1 Preview", provider: "OpenAI" },
  { id: "o1-mini", name: "O1 Mini", provider: "OpenAI" },
];

const MOCK_SCHEMAS = [
  { id: "1", name: "Action Response" },
  { id: "2", name: "Data Extraction" },
  { id: "3", name: "Sentiment Analysis" },
];

const LIBRARY_PROMPTS = [
  { id: "1", name: "Professional Tone", labels: ["Style"] },
  { id: "2", name: "Friendly Greeting", labels: ["Intro", "Style"] },
  { id: "3", name: "Error Handler", labels: ["System", "Technical"] },
  { id: "4", name: "JSON Output Format", labels: ["Format", "Technical"] },
];

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

// Library Picker Dropdown
const LibraryPickerDropdown = () => {
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredPrompts = LIBRARY_PROMPTS.filter(prompt => 
    prompt.name.toLowerCase().includes(searchQuery.toLowerCase())
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

// Editable Text Area Component with Variable Picker
const EditablePromptArea = ({ label, value, placeholder, minHeight = "min-h-32", onLibraryPick, onChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  React.useEffect(() => {
    setEditValue(value || '');
  }, [value]);

  const handleInsertVariable = (variable) => {
    const insertion = `{{${variable}}}`;
    setEditValue(prev => prev + insertion);
  };

  const handleDoneEditing = () => {
    setIsEditing(false);
    if (onChange && editValue !== value) {
      onChange(editValue);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">{label}</label>
        <div className="flex items-center gap-1">
          <MockupVariablePicker onInsert={handleInsertVariable} />
          {onLibraryPick && <LibraryPickerDropdown />}
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => isEditing ? handleDoneEditing() : setIsEditing(true)}
                className={`w-6 h-6 flex items-center justify-center rounded-sm transition-colors ${
                  isEditing ? "text-primary" : "text-on-surface-variant hover:bg-on-surface/[0.08]"
                }`}
              >
                {isEditing ? <Check className="h-3.5 w-3.5" /> : <Edit3 className="h-3.5 w-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">{isEditing ? "Done Editing" : "Edit"}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {isEditing ? (
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${minHeight} p-2.5 bg-surface-container rounded-m3-md border border-primary text-body-sm text-on-surface leading-relaxed focus:outline-none resize-y font-mono`}
        />
      ) : (
        <div className={`${minHeight} p-2.5 bg-surface-container rounded-m3-md border border-outline-variant text-body-sm text-on-surface leading-relaxed whitespace-pre-wrap`}>
          {value ? <HighlightedText text={value} /> : <span className="text-on-surface-variant opacity-50">{placeholder}</span>}
        </div>
      )}
    </div>
  );
};

// Prompt Tab Content (for Prompt Templates)
const TemplatePromptTabContent = ({ templateData, onUpdateField }) => {
  const systemPrompt = templateData?.structure?.input_admin_prompt || '';
  const userPrompt = templateData?.structure?.input_user_prompt || '';
  const outputResponse = templateData?.structure?.output_response || '';

  return (
    <div className="space-y-4">
      <EditablePromptArea 
        label="System Prompt"
        value={systemPrompt}
        placeholder="Enter system prompt..."
        minHeight="min-h-40"
        onLibraryPick
        onChange={(value) => onUpdateField?.('structure.input_admin_prompt', value)}
      />

      <EditablePromptArea 
        label="User Prompt"
        value={userPrompt}
        placeholder="Enter user prompt..."
        minHeight="min-h-16"
        onLibraryPick
        onChange={(value) => onUpdateField?.('structure.input_user_prompt', value)}
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

// Settings Tab Content (for Prompt Templates)
const TemplateSettingsTabContent = ({ templateData, onUpdateField }) => {
  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState("4096");
  const currentModel = templateData?.structure?.model || 'gpt-4o';

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Model</label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full h-8 px-2.5 flex items-center justify-between bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface">
              <span>{currentModel}</span>
              <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-full bg-surface-container-high border-outline-variant">
            {MOCK_MODELS.map(model => (
              <DropdownMenuItem 
                key={model.id} 
                className="text-body-sm text-on-surface"
              >
                <span className="flex-1">{model.name}</span>
                <span className="text-[10px] text-on-surface-variant">{model.provider}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Temperature</label>
          <span className="text-body-sm text-on-surface font-mono">{temperature[0]}</span>
        </div>
        <Slider
          value={temperature}
          onValueChange={setTemperature}
          max={2}
          step={0.1}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-on-surface-variant">
          <span>Precise</span>
          <span>Creative</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Max Tokens</label>
        <input
          type="number"
          value={maxTokens}
          onChange={(e) => setMaxTokens(e.target.value)}
          className="w-full h-8 px-2.5 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

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
            {MOCK_SCHEMAS.map(schema => (
              <DropdownMenuItem key={schema.id} className="text-body-sm text-on-surface">
                {schema.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="p-3 bg-surface-container-low rounded-m3-lg border border-outline-variant">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-on-surface-variant" />
            <div>
              <span className="text-body-sm text-on-surface font-medium">Assistant Mode</span>
              <p className="text-[10px] text-on-surface-variant">Enable conversational memory</p>
            </div>
          </div>
          <Switch />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Tools</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: Code, label: "Code Interpreter" },
            { icon: Search, label: "File Search" },
            { icon: Globe, label: "Web Search" },
            { icon: Zap, label: "Functions" },
            { icon: FileText, label: "Confluence" },
            { icon: Briefcase, label: "Jira" },
          ].map(tool => (
            <div key={tool.label} className="flex items-center justify-between p-2.5 bg-surface-container rounded-m3-sm border border-outline-variant">
              <div className="flex items-center gap-1.5">
                <tool.icon className="h-3.5 w-3.5 text-on-surface-variant" />
                <span className="text-[11px] text-on-surface">{tool.label}</span>
              </div>
              <Switch />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Variables Tab Content (for Prompt Templates)
const TemplateVariablesTabContent = ({ variables = [] }) => {
  const typeColors = {
    string: "bg-blue-500/10 text-blue-600",
    text: "bg-green-500/10 text-green-600",
    enum: "bg-purple-500/10 text-purple-600",
    number: "bg-amber-500/10 text-amber-600",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-label-sm text-on-surface-variant uppercase">Variables ({variables.length})</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
              <Plus className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">Add Variable</TooltipContent>
        </Tooltip>
      </div>

      {variables.length === 0 ? (
        <div className="text-center py-8 text-on-surface-variant">
          <Variable className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-body-sm">No variables defined</p>
          <p className="text-[10px] opacity-70 mt-0.5">Variables will be extracted from prompts</p>
        </div>
      ) : (
        <div className="space-y-2">
          {variables.map((variable, idx) => {
            const varType = variable.type || "string";
            return (
              <div key={idx} className="flex items-center gap-3 p-2.5 bg-surface-container rounded-m3-sm border border-outline-variant group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-body-sm text-on-surface font-mono font-medium">{variable.name || variable.variable_name}</code>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${typeColors[varType] || typeColors.string}`}>
                      {varType}
                    </span>
                    {(variable.required || variable.is_required) && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-600">required</span>
                    )}
                  </div>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">{variable.description || variable.variable_description || ""}</p>
                </div>
                
                {(variable.default || variable.default_value) && (
                  <div className="text-[10px] text-on-surface-variant">
                    default: <code className="text-on-surface">{variable.default || variable.default_value}</code>
                  </div>
                )}
                
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Edit</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-6 h-6 flex items-center justify-center rounded-m3-full text-destructive hover:bg-on-surface/[0.08]">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Delete</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {variables.length > 0 && variables.some(v => v.required || v.is_required) && (
        <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 rounded-m3-md border border-amber-500/20">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-body-sm text-amber-700 font-medium">Required variables</p>
            <p className="text-[10px] text-amber-600">Some variables need values before running</p>
          </div>
        </div>
      )}
    </div>
  );
};

// File type icon helper
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

      {/* Attached Files List */}
      <div className="space-y-1.5">
        <span className="text-label-sm text-on-surface-variant uppercase">Attached Files ({MOCK_ATTACHMENTS.length})</span>
        <div className="space-y-2">
          {MOCK_ATTACHMENTS.map(file => {
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

// Variable Editor Row Component
const VariableRow = ({ variable, isEditing = false }) => {
  const typeColors = {
    string: "bg-blue-500/10 text-blue-600",
    text: "bg-green-500/10 text-green-600",
    enum: "bg-purple-500/10 text-purple-600",
    number: "bg-amber-500/10 text-amber-600",
  };

  const varType = variable.type || "string";

  return (
    <div className="flex items-center gap-3 p-2.5 bg-surface-container rounded-m3-sm border border-outline-variant group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <code className="text-body-sm text-on-surface font-mono font-medium">{variable.name || variable.variable_name}</code>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${typeColors[varType] || typeColors.string}`}>
            {varType}
          </span>
          {(variable.required || variable.is_required) && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-600">required</span>
          )}
        </div>
        <p className="text-[10px] text-on-surface-variant mt-0.5">{variable.description || variable.variable_description || ""}</p>
      </div>
      
      {(variable.default || variable.default_value) && (
        <div className="text-[10px] text-on-surface-variant">
          default: <code className="text-on-surface">{variable.default || variable.default_value}</code>
        </div>
      )}
      
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">Edit</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="w-6 h-6 flex items-center justify-center rounded-m3-full text-destructive hover:bg-on-surface/[0.08]">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">Delete</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

// Variable Mapping Row Component
const MappingRow = ({ mapping }) => {
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
          <code className="text-[11px] text-on-surface-variant font-mono truncate">
            {mapping.value}
          </code>
        )}
      </div>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
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

const MockupTemplatesContent = ({ 
  selectedTemplate, 
  activeTemplateTab = "prompts",
  // Real data hooks - Phase 8-9
  templatesHook,
  jsonSchemaTemplatesHook,
}) => {
  const [activeEditorTab, setActiveEditorTab] = useState("prompt");
  const [editedName, setEditedName] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Get the display name and description from template
  const templateName = useMemo(() => {
    if (!selectedTemplate) return "";
    return selectedTemplate.template_name || selectedTemplate.schema_name || selectedTemplate.name || "Untitled";
  }, [selectedTemplate]);

  const templateDescription = useMemo(() => {
    if (!selectedTemplate) return "";
    return selectedTemplate.template_description || selectedTemplate.schema_description || selectedTemplate.description || "";
  }, [selectedTemplate]);

  // Extract variables from template
  const extractedVariables = useMemo(() => {
    if (!selectedTemplate?.structure || !templatesHook?.extractTemplateVariables) return [];
    const varNames = templatesHook.extractTemplateVariables(selectedTemplate.structure);
    return varNames.map(name => ({ name, type: "string", required: true }));
  }, [selectedTemplate, templatesHook]);

  // Variable definitions from template
  const variableDefinitions = useMemo(() => {
    if (!selectedTemplate?.variable_definitions) return [];
    if (Array.isArray(selectedTemplate.variable_definitions)) {
      return selectedTemplate.variable_definitions;
    }
    return [];
  }, [selectedTemplate]);

  const displayVariables = variableDefinitions.length > 0 ? variableDefinitions : extractedVariables;

  // Save handler
  const handleSave = useCallback(async () => {
    if (!selectedTemplate?.row_id) return;
    
    setIsSaving(true);
    try {
      if (activeTemplateTab === "prompts" && templatesHook?.updateTemplate) {
        await templatesHook.updateTemplate(selectedTemplate.row_id, {
          template_name: editedName || templateName,
          template_description: editedDescription || templateDescription,
        });
      } else if (activeTemplateTab === "schemas" && jsonSchemaTemplatesHook?.updateTemplate) {
        await jsonSchemaTemplatesHook.updateTemplate(selectedTemplate.row_id, {
          schema_name: editedName || templateName,
          schema_description: editedDescription || templateDescription,
        });
      }
    } finally {
      setIsSaving(false);
    }
  }, [selectedTemplate, activeTemplateTab, templatesHook, jsonSchemaTemplatesHook, editedName, editedDescription, templateName, templateDescription]);

  // Delete handler
  const handleDelete = useCallback(async () => {
    if (!selectedTemplate?.row_id) return;
    
    if (activeTemplateTab === "prompts" && templatesHook?.deleteTemplate) {
      await templatesHook.deleteTemplate(selectedTemplate.row_id);
    } else if (activeTemplateTab === "schemas" && jsonSchemaTemplatesHook?.deleteTemplate) {
      await jsonSchemaTemplatesHook.deleteTemplate(selectedTemplate.row_id);
    }
  }, [selectedTemplate, activeTemplateTab, templatesHook, jsonSchemaTemplatesHook]);

  // Empty state when no template selected
  if (!selectedTemplate) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface">
        <div className="text-center text-on-surface-variant">
          <LayoutTemplate className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-body-md">Select a template to view</p>
          <p className="text-label-md mt-1">or create a new one</p>
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
              labels={selectedTemplate?.labels || []} 
              onLabelsChange={() => {}}
              maxDisplay={2}
            />
          )}
        </div>
        <div className="flex items-center gap-0.5">
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
              <DropdownMenuItem onClick={handleDelete} className="text-body-sm text-destructive"><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</DropdownMenuItem>
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
              <TabButton icon={Sliders} label="Settings" isActive={activeEditorTab === "settings"} onClick={() => setActiveEditorTab("settings")} />
              <TabButton icon={Variable} label="Variables" isActive={activeEditorTab === "variables"} onClick={() => setActiveEditorTab("variables")} />
            </>
          )}
          {activeTemplateTab === "schemas" && (
            <>
              <TabButton icon={Code} label="Schema" isActive={activeEditorTab === "schema"} onClick={() => setActiveEditorTab("schema")} />
              <TabButton icon={Eye} label="Preview" isActive={activeEditorTab === "preview"} onClick={() => setActiveEditorTab("preview")} />
            </>
          )}
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
              templateData={selectedTemplate}
              onUpdateField={() => {}}
            />
          )}

          {/* Settings Tab - for Prompt Templates */}
          {activeEditorTab === "settings" && activeTemplateTab === "prompts" && (
            <TemplateSettingsTabContent 
              templateData={selectedTemplate}
              onUpdateField={() => {}}
            />
          )}

          {/* Variables Tab - for Prompt Templates */}
          {activeEditorTab === "variables" && activeTemplateTab === "prompts" && (
            <TemplateVariablesTabContent 
              variables={displayVariables}
            />
          )}
        </div>

        {/* Schema Tab */}
        {activeTemplateTab === "schemas" && activeEditorTab === "schema" && (
          <div className="space-y-3 max-w-2xl">
            <div className="space-y-1.5">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">JSON Schema</label>
              <div className="min-h-56 p-3 bg-surface-container rounded-m3-md border border-outline-variant font-mono text-[10px] text-on-surface whitespace-pre overflow-auto">
                {selectedTemplate.json_schema ? (
                  JSON.stringify(selectedTemplate.json_schema, null, 2)
                ) : (
`{
  "type": "object",
  "properties": {},
  "required": []
}`
                )}
              </div>
            </div>
            
            <SettingCard label="Schema Options">
              <div className="space-y-3">
                <SettingRow label="Strict mode" description="Enforce exact schema matching">
                  <Switch defaultChecked />
                </SettingRow>
                <SettingDivider />
                <SettingRow label="Allow additional properties">
                  <Switch />
                </SettingRow>
              </div>
            </SettingCard>
          </div>
        )}

        {/* Schema Preview Tab */}
        {activeTemplateTab === "schemas" && activeEditorTab === "preview" && (
          <div className="space-y-3 max-w-2xl">
            <span className="text-label-sm text-on-surface-variant uppercase">Sample Output</span>
            <div className="p-3 bg-surface-container rounded-m3-md border border-outline-variant font-mono text-[11px] text-on-surface whitespace-pre overflow-auto">
{`{
  "action": "example_action",
  "data": {}
}`}
            </div>
            <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-m3-md">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-body-sm text-green-700">Valid against schema</span>
            </div>
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
              {MOCK_VARIABLE_MAPPINGS.map(mapping => (
                <MappingRow key={mapping.variable} mapping={mapping} />
              ))}
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

export default MockupTemplatesContent;