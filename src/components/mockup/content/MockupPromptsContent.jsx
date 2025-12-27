import React, { useState } from "react";
import { 
  FileText, Sliders, Variable, MessageSquare, Play, Copy, 
  Download, MoreVertical, Star, Trash2, Share2, Link2, 
  Hash, List, Braces, ToggleLeft, Library, ChevronDown, 
  Search, Plus, PanelRightOpen, Workflow, Bot, Thermometer,
  Zap, Code, Globe
} from "lucide-react";
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

// Variable definitions for hover tooltips
const VARIABLE_DEFINITIONS = {
  customer_message: { name: "customer_message", type: "text", description: "The customer's original inquiry or message", source: "User Input", required: true },
  ticket_count: { name: "ticket_count", type: "number", description: "Number of previous support tickets", source: "Database", required: false, default: "0" },
  company_name: { name: "company_name", type: "text", description: "Name of the company", source: "Settings", required: true },
  support_email: { name: "support_email", type: "text", description: "Support contact email address", source: "Settings", required: true },
};

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

const MOCK_VARIABLES = [
  { name: "customer_message", value: "", required: true, type: "text" },
  { name: "ticket_count", value: "3", required: false, type: "number" },
  { name: "api_key", value: "••••••••", required: true, type: "text", isSecret: true },
  { name: "base_url", value: "https://api.example.com", required: true, type: "text" },
  { name: "context_ref", value: "{{parent.output}}", required: false, type: "reference" },
  { name: "max_retries", value: "3", required: false, type: "number" },
];

const LIBRARY_PROMPTS = [
  { id: "1", name: "Professional Tone", category: "Style" },
  { id: "2", name: "Friendly Greeting", category: "Intro" },
  { id: "3", name: "Error Handler", category: "System" },
  { id: "4", name: "JSON Output Format", category: "Format" },
];

// Component to render text with highlighted variables
const HighlightedText = ({ text }) => {
  const variablePattern = /\{\{(\w+)\}\}/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = variablePattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
    }
    
    const varName = match[1];
    const varDef = VARIABLE_DEFINITIONS[varName];
    
    parts.push(
      <Tooltip key={`var-${match.index}`}>
        <TooltipTrigger asChild>
          <span className="text-primary font-medium cursor-help bg-primary/10 px-0.5 rounded">
            {`{{${varName}}}`}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-label-md font-semibold text-on-surface">{varName}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">{varDef?.type || "text"}</span>
            {varDef?.required && <span className="text-[10px] text-destructive">*required</span>}
          </div>
          {varDef?.description && (
            <p className="text-[11px] text-on-surface-variant">{varDef.description}</p>
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

const TabButton = ({ icon: Icon, label, isActive, onClick }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={onClick}
        className={`h-8 w-10 flex items-center justify-center rounded-m3-sm transition-colors ${
          isActive 
            ? "bg-secondary-container text-secondary-container-foreground" 
            : "text-on-surface-variant hover:bg-on-surface/[0.08]"
        }`}
      >
        <Icon className="h-5 w-5" />
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
  return <Icon className="h-4 w-4 text-primary" />;
};

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
            <button className="w-7 h-7 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
              <Library className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent className="text-[10px]">Insert from Library</TooltipContent>
      </Tooltip>
      <DropdownMenuContent className="w-56 bg-surface-container-high border-outline-variant">
        <div className="px-2 py-1.5 text-[10px] text-on-surface-variant uppercase tracking-wider">Library Prompts</div>
        <div className="px-2 pb-2">
          <div className="flex items-center gap-2 h-8 px-2 bg-surface-container rounded-m3-sm border border-outline-variant">
            <Search className="h-3.5 w-3.5 text-on-surface-variant" />
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
        <div className="max-h-48 overflow-auto">
          {filteredPrompts.map(prompt => (
            <DropdownMenuItem key={prompt.id} className="text-body-sm text-on-surface hover:bg-on-surface/[0.08] cursor-pointer">
              <span className="flex-1">{prompt.name}</span>
              <span className="text-[10px] text-on-surface-variant">{prompt.category}</span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Prompt Tab Content
const PromptTabContent = () => {
  const promptText = `You are a professional customer support agent for {{company_name}}.

Analyze the following customer message and provide a helpful response:
{{customer_message}}

Previous ticket count: {{ticket_count}}
Contact: {{support_email}}

Guidelines:
- Be empathetic and professional
- Provide actionable solutions
- Offer to escalate if needed`;

  return (
    <div className="space-y-4">
      {/* System Prompt */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-label-sm text-on-surface-variant">System Prompt</label>
          <LibraryPickerDropdown />
        </div>
        <div className="min-h-48 p-3 bg-surface-container rounded-m3-md border border-outline-variant text-body-sm text-on-surface leading-relaxed whitespace-pre-wrap">
          <HighlightedText text={promptText} />
        </div>
      </div>

      {/* User Prompt */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-label-sm text-on-surface-variant">User Prompt</label>
          <LibraryPickerDropdown />
        </div>
        <div className="min-h-24 p-3 bg-surface-container rounded-m3-md border border-outline-variant text-body-sm text-on-surface-variant">
          <span className="opacity-50">Enter user prompt...</span>
        </div>
      </div>

      {/* Output */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-label-sm text-on-surface-variant">Output</label>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-7 h-7 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                <Copy className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Copy Output</TooltipContent>
          </Tooltip>
        </div>
        <div className="min-h-32 p-3 bg-surface-container rounded-m3-md border border-outline-variant text-body-sm text-on-surface-variant italic">
          Run the prompt to see output...
        </div>
      </div>
    </div>
  );
};

// Settings Tab Content
const SettingsTabContent = () => {
  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState("4096");
  const [isAssistant, setIsAssistant] = useState(false);

  return (
    <div className="space-y-6">
      {/* Model Selection */}
      <div className="space-y-2">
        <label className="text-label-sm text-on-surface-variant">Model</label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full h-10 px-3 flex items-center justify-between bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface">
              <span>GPT-4o</span>
              <ChevronDown className="h-4 w-4 text-on-surface-variant" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-full bg-surface-container-high border-outline-variant">
            {MOCK_MODELS.map(model => (
              <DropdownMenuItem key={model.id} className="text-body-sm text-on-surface">
                <span className="flex-1">{model.name}</span>
                <span className="text-[10px] text-on-surface-variant">{model.provider}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Temperature */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-label-sm text-on-surface-variant">Temperature</label>
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

      {/* Max Tokens */}
      <div className="space-y-2">
        <label className="text-label-sm text-on-surface-variant">Max Tokens</label>
        <input
          type="number"
          value={maxTokens}
          onChange={(e) => setMaxTokens(e.target.value)}
          className="w-full h-10 px-3 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* JSON Schema */}
      <div className="space-y-2">
        <label className="text-label-sm text-on-surface-variant">JSON Schema (Optional)</label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full h-10 px-3 flex items-center justify-between bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface-variant">
              <span>Select a schema...</span>
              <ChevronDown className="h-4 w-4" />
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

      {/* Assistant Mode Toggle */}
      <div className="p-4 bg-surface-container-low rounded-m3-lg border border-outline-variant">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-primary" />
            <div>
              <span className="text-body-md text-on-surface font-medium">Assistant Mode</span>
              <p className="text-body-sm text-on-surface-variant">Enable conversational memory</p>
            </div>
          </div>
          <Switch checked={isAssistant} onCheckedChange={setIsAssistant} />
        </div>
      </div>

      {/* Tools Section */}
      <div className="space-y-3">
        <label className="text-label-sm text-on-surface-variant">Tools</label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Code, label: "Code Interpreter", enabled: true },
            { icon: Search, label: "File Search", enabled: false },
            { icon: Globe, label: "Web Search", enabled: false },
            { icon: Zap, label: "Functions", enabled: false },
          ].map(tool => (
            <div key={tool.label} className="flex items-center justify-between p-3 bg-surface-container rounded-m3-sm border border-outline-variant">
              <div className="flex items-center gap-2">
                <tool.icon className="h-4 w-4 text-on-surface-variant" />
                <span className="text-body-sm text-on-surface">{tool.label}</span>
              </div>
              <Switch defaultChecked={tool.enabled} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Variables Tab Content
const VariablesTabContent = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <label className="text-label-sm text-on-surface-variant">Detected Variables</label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="w-7 h-7 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
            <Plus className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="text-[10px]">Add Variable</TooltipContent>
      </Tooltip>
    </div>

    <div className="space-y-2">
      {MOCK_VARIABLES.map((variable, i) => (
        <div 
          key={variable.name}
          className="flex items-center gap-3 p-3 bg-surface-container rounded-m3-sm border border-outline-variant"
        >
          <VariableTypeIcon type={variable.type} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-body-sm text-on-surface font-medium font-mono">{variable.name}</span>
              {variable.required && <span className="text-[10px] text-destructive">*</span>}
              {variable.isSecret && <span className="text-[10px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-600">secret</span>}
            </div>
          </div>
          <div className="w-48">
            <input
              type={variable.isSecret ? "password" : "text"}
              defaultValue={variable.value}
              placeholder="Enter value..."
              className="w-full h-8 px-2 bg-surface-container-high rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Conversation Tab Content
const ConversationTabContent = () => (
  <div className="flex flex-col items-center justify-center h-64 text-center">
    <MessageSquare className="h-12 w-12 text-on-surface-variant/30 mb-3" />
    <p className="text-body-md text-on-surface-variant">Enable Assistant Mode</p>
    <p className="text-body-sm text-on-surface-variant/70 mt-1">to use conversations</p>
  </div>
);

// Main Prompts Content Component
const MockupPromptsContent = ({ 
  hasSelection = true, 
  onExport, 
  onToggleConversation, 
  conversationPanelOpen = true,
  selectedPromptHasChildren = true 
}) => {
  const [activeTab, setActiveTab] = useState("prompt");

  const tabs = [
    { id: "prompt", icon: FileText, label: "Prompt" },
    { id: "settings", icon: Sliders, label: "Settings" },
    { id: "variables", icon: Variable, label: "Variables" },
    { id: "conversation", icon: MessageSquare, label: "Conversation" },
  ];

  if (!hasSelection) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface">
        <div className="text-center text-on-surface-variant">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-body-md">Select a prompt to view</p>
          <p className="text-body-sm opacity-70 mt-1">or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-outline-variant" style={{ height: "56px" }}>
        <div className="flex items-center gap-3">
          <h2 className="text-title-md text-on-surface font-semibold">Customer Support Agent</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">Business</span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-9 h-9 flex items-center justify-center rounded-m3-full bg-primary text-primary-foreground">
                <Play className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Run Prompt</TooltipContent>
          </Tooltip>
          {selectedPromptHasChildren && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-9 h-9 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                  <Workflow className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Run Cascade</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onExport} className="w-9 h-9 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                <Download className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Export</TooltipContent>
          </Tooltip>
          {!conversationPanelOpen && onToggleConversation && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onToggleConversation} className="w-9 h-9 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                  <PanelRightOpen className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Show Conversation</TooltipContent>
            </Tooltip>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-9 h-9 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-surface-container-high border-outline-variant">
              <DropdownMenuItem className="text-body-sm"><Star className="h-4 w-4 mr-2" /> Star</DropdownMenuItem>
              <DropdownMenuItem className="text-body-sm"><Copy className="h-4 w-4 mr-2" /> Duplicate</DropdownMenuItem>
              <DropdownMenuItem className="text-body-sm"><Share2 className="h-4 w-4 mr-2" /> Share</DropdownMenuItem>
              <DropdownMenuSeparator className="bg-outline-variant" />
              <DropdownMenuItem className="text-body-sm text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-outline-variant">
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

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl">
          {activeTab === "prompt" && <PromptTabContent />}
          {activeTab === "settings" && <SettingsTabContent />}
          {activeTab === "variables" && <VariablesTabContent />}
          {activeTab === "conversation" && <ConversationTabContent />}
        </div>
      </div>
    </div>
  );
};

export default MockupPromptsContent;
