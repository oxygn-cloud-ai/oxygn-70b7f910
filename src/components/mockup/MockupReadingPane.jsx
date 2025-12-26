import React, { useState } from "react";
import { 
  FileText, 
  Sliders, 
  Variable, 
  LayoutTemplate,
  Play,
  Copy,
  Download,
  MoreVertical,
  Star,
  Trash2,
  Share2,
  Link2,
  Hash,
  List,
  Braces,
  ToggleLeft,
  Library,
  ChevronDown,
  Search,
  Plus,
  PanelRightOpen,
  Workflow
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LIBRARY_PROMPTS = [
  { id: "1", name: "Professional Tone", category: "Style" },
  { id: "2", name: "Friendly Greeting", category: "Intro" },
  { id: "3", name: "Error Handler", category: "System" },
  { id: "4", name: "JSON Output Format", category: "Format" },
  { id: "5", name: "Step by Step", category: "Structure" },
  { id: "6", name: "Chain of Thought", category: "Structure" },
  { id: "7", name: "Few-shot Examples", category: "Format" },
  { id: "8", name: "Formal Language", category: "Style" },
];

const LibraryPickerDropdown = () => {
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredPrompts = LIBRARY_PROMPTS.filter(prompt => 
    prompt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    prompt.category.toLowerCase().includes(searchQuery.toLowerCase())
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
      <DropdownMenuContent className="w-56 bg-surface-container-high border-outline-variant z-50" onCloseAutoFocus={(e) => e.preventDefault()}>
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
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        <DropdownMenuSeparator className="bg-outline-variant" />
        <div className="max-h-48 overflow-auto">
          {filteredPrompts.length > 0 ? (
            filteredPrompts.map(prompt => (
              <DropdownMenuItem 
                key={prompt.id}
                className="text-body-sm text-on-surface hover:bg-on-surface/[0.08] focus:bg-on-surface/[0.12] cursor-pointer"
              >
                <span className="flex-1">{prompt.name}</span>
                <span className="text-[10px] text-on-surface-variant">{prompt.category}</span>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="px-2 py-3 text-body-sm text-on-surface-variant text-center">
              No prompts found
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Mock data for templates
const MOCK_PROMPT_TEMPLATES = [
  { id: "1", name: "Customer Support Agent", description: "Professional support responses", category: "Business", nodes: 5, vars: 3 },
  { id: "2", name: "Code Review Assistant", description: "Thorough code analysis", category: "Technical", nodes: 4, vars: 2 },
  { id: "3", name: "Content Writer", description: "SEO-optimized blog content", category: "Marketing", nodes: 6, vars: 4 },
];

const MOCK_SCHEMA_TEMPLATES = [
  { id: "1", name: "Action Response", description: "Structured action items", category: "Action" },
  { id: "2", name: "Data Extraction", description: "Extract structured data", category: "Extraction" },
  { id: "3", name: "Sentiment Analysis", description: "Analyze text sentiment", category: "Analysis" },
];

const MOCK_MAPPING_TEMPLATES = [
  { id: "1", name: "Standard Export", fields: 4, vars: 6 },
  { id: "2", name: "Documentation Only", fields: 2, vars: 3 },
  { id: "3", name: "Full Backup", fields: 6, vars: 8 },
];

const MockupTemplatesTab = () => {
  const [activeTemplateTab, setActiveTemplateTab] = useState("prompts");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const getCategoryColor = (category) => {
    const colors = {
      Business: "bg-amber-500/10 text-amber-600",
      Technical: "bg-green-500/10 text-green-600",
      Marketing: "bg-blue-500/10 text-blue-600",
      Creative: "bg-purple-500/10 text-purple-600",
      Action: "bg-orange-500/10 text-orange-600",
      Extraction: "bg-cyan-500/10 text-cyan-600",
      Analysis: "bg-indigo-500/10 text-indigo-600",
    };
    return colors[category] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="h-full flex gap-4">
      {/* Left Panel - Template List */}
      <div className="w-72 flex flex-col border border-outline-variant rounded-m3-md bg-surface-container-low overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b border-outline-variant space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-label-lg text-on-surface font-medium">Templates</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-7 h-7 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                  <Plus className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Create New</TooltipContent>
            </Tooltip>
          </div>

          {/* Type Tabs */}
          <div className="flex gap-1 p-1 bg-surface-container rounded-m3-sm">
            {[
              { id: "prompts", icon: FileText, label: "Prompts" },
              { id: "schemas", icon: Braces, label: "Schemas" },
              { id: "mappings", icon: Link2, label: "Mappings" },
            ].map(tab => (
              <Tooltip key={tab.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { setActiveTemplateTab(tab.id); setSelectedTemplate(null); }}
                    className={`flex-1 h-7 flex items-center justify-center gap-1.5 rounded-sm text-[11px] transition-colors ${
                      activeTemplateTab === tab.id 
                        ? "bg-secondary-container text-secondary-container-foreground" 
                        : "text-on-surface-variant hover:bg-on-surface/[0.08]"
                    }`}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">{tab.label}</TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 h-8 px-2 bg-surface-container rounded-m3-sm border border-outline-variant">
            <Search className="h-3.5 w-3.5 text-on-surface-variant" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="flex-1 bg-transparent text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
            />
          </div>
        </div>

        {/* Template List */}
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {activeTemplateTab === "prompts" && MOCK_PROMPT_TEMPLATES.map(template => (
            <button
              key={template.id}
              onClick={() => setSelectedTemplate(template)}
              className={`w-full p-2.5 rounded-m3-sm text-left transition-colors ${
                selectedTemplate?.id === template.id 
                  ? "bg-secondary-container" 
                  : "hover:bg-on-surface/[0.08]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm text-on-surface font-medium truncate">{template.name}</p>
                  <p className="text-[10px] text-on-surface-variant truncate mt-0.5">{template.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-on-surface-variant">{template.nodes} nodes</span>
                    <span className="text-[10px] text-on-surface-variant">• {template.vars} vars</span>
                  </div>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${getCategoryColor(template.category)}`}>
                  {template.category}
                </span>
              </div>
            </button>
          ))}

          {activeTemplateTab === "schemas" && MOCK_SCHEMA_TEMPLATES.map(template => (
            <button
              key={template.id}
              onClick={() => setSelectedTemplate(template)}
              className={`w-full p-2.5 rounded-m3-sm text-left transition-colors ${
                selectedTemplate?.id === template.id 
                  ? "bg-secondary-container" 
                  : "hover:bg-on-surface/[0.08]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm text-on-surface font-medium truncate">{template.name}</p>
                  <p className="text-[10px] text-on-surface-variant truncate mt-0.5">{template.description}</p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${getCategoryColor(template.category)}`}>
                  {template.category}
                </span>
              </div>
            </button>
          ))}

          {activeTemplateTab === "mappings" && MOCK_MAPPING_TEMPLATES.map(template => (
            <button
              key={template.id}
              onClick={() => setSelectedTemplate(template)}
              className={`w-full p-2.5 rounded-m3-sm text-left transition-colors ${
                selectedTemplate?.id === template.id 
                  ? "bg-secondary-container" 
                  : "hover:bg-on-surface/[0.08]"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-body-sm text-on-surface font-medium truncate">{template.name}</p>
                <p className="text-[10px] text-on-surface-variant mt-0.5">
                  {template.fields} fields • {template.vars} vars
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right Panel - Template Editor */}
      <div className="flex-1 flex flex-col border border-outline-variant rounded-m3-md bg-surface-container-low overflow-hidden">
        {selectedTemplate ? (
          <>
            {/* Editor Header */}
            <div className="p-3 border-b border-outline-variant">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-label-lg text-on-surface font-medium">{selectedTemplate.name}</h3>
                  {selectedTemplate.description && (
                    <p className="text-[11px] text-on-surface-variant mt-0.5">{selectedTemplate.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-7 h-7 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                        <Copy className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Duplicate</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-7 h-7 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                        <Download className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Export</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-7 h-7 flex items-center justify-center rounded-sm text-destructive hover:bg-on-surface/[0.08]">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Delete</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>

            {/* Editor Tabs */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-outline-variant">
              {activeTemplateTab === "prompts" && (
                <>
                  <TabButton icon={FileText} label="Overview" isActive />
                  <TabButton icon={Variable} label="Structure" />
                  <TabButton icon={Variable} label="Variables" />
                </>
              )}
              {activeTemplateTab === "schemas" && (
                <>
                  <TabButton icon={FileText} label="Schema" isActive />
                  <TabButton icon={Variable} label="Preview" />
                </>
              )}
              {activeTemplateTab === "mappings" && (
                <>
                  <TabButton icon={FileText} label="Fields" isActive />
                  <TabButton icon={Variable} label="Variables" />
                </>
              )}
            </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-auto p-4">
              {activeTemplateTab === "prompts" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-label-sm text-on-surface-variant">Name</label>
                    <div className="h-10 px-3 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant">
                      <span className="text-body-sm text-on-surface">{selectedTemplate.name}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-label-sm text-on-surface-variant">Description</label>
                    <div className="h-10 px-3 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant">
                      <span className="text-body-sm text-on-surface">{selectedTemplate.description}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-label-sm text-on-surface-variant">Category</label>
                    <div className="h-10 px-3 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant">
                      <span className={`text-body-sm px-2 py-0.5 rounded ${getCategoryColor(selectedTemplate.category)}`}>
                        {selectedTemplate.category}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeTemplateTab === "schemas" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-label-sm text-on-surface-variant">JSON Schema</label>
                    <div className="min-h-48 p-3 bg-surface-container rounded-m3-sm border border-outline-variant font-mono text-[11px] text-on-surface whitespace-pre">
{`{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "description": "Action to take"
    },
    "priority": {
      "type": "string",
      "enum": ["low", "medium", "high"]
    }
  },
  "required": ["action"]
}`}
                    </div>
                  </div>
                </div>
              )}

              {activeTemplateTab === "mappings" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-label-sm text-on-surface-variant">Selected Fields</label>
                    <div className="flex flex-wrap gap-2">
                      {["System Prompt", "User Prompt", "Output", "Variables"].map(field => (
                        <span key={field} className="text-[11px] px-2 py-1 bg-secondary-container text-secondary-container-foreground rounded">
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-label-sm text-on-surface-variant">Variable Mappings</label>
                    <div className="space-y-1">
                      {[
                        { name: "customer_name", source: "Manual Input" },
                        { name: "ticket_id", source: "Parent Output" },
                        { name: "context", source: "Confluence Page" },
                      ].map(mapping => (
                        <div key={mapping.name} className="h-9 flex items-center gap-3 px-3 bg-surface-container rounded-m3-sm border border-outline-variant">
                          <span className="text-body-sm text-on-surface font-medium w-28 truncate">{mapping.name}</span>
                          <span className="text-[10px] text-on-surface-variant">→</span>
                          <span className="text-body-sm text-on-surface-variant">{mapping.source}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <LayoutTemplate className="h-12 w-12 mx-auto text-on-surface-variant/30 mb-3" />
              <p className="text-body-md text-on-surface-variant">Select a template to view</p>
              <p className="text-label-sm text-on-surface-variant/70 mt-1">or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TabButton = ({ icon: Icon, label, isActive, onClick }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={onClick}
        className={`
          h-8 w-10 flex items-center justify-center rounded-m3-sm
          transition-colors duration-150 ease-emphasized
          ${isActive 
            ? "bg-secondary-container text-secondary-container-foreground" 
            : "text-on-surface-variant hover:bg-on-surface/[0.08]"
          }
        `}
        style={{ height: "32px", width: "40px" }}
      >
        <Icon className="h-5 w-5" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="text-label-sm">
      {label}
    </TooltipContent>
  </Tooltip>
);

const IconButton = ({ icon: Icon, label, variant = "default", onClick }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={onClick}
        className={`
          h-10 w-10 flex items-center justify-center rounded-m3-full
          transition-colors duration-150 ease-emphasized
          ${variant === "primary" 
            ? "bg-primary text-primary-foreground hover:bg-primary/90" 
            : "text-on-surface-variant hover:bg-on-surface/[0.08]"
          }
        `}
        style={{ height: "40px", width: "40px" }}
      >
        <Icon className="h-5 w-5" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="text-label-sm">
      {label}
    </TooltipContent>
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

const mockVariables = [
  { name: "customer_message", value: "", required: true, type: "text" },
  { name: "ticket_count", value: "3", required: false, type: "number" },
  { name: "api_key", value: "••••••••", required: true, type: "text", isSecret: true },
  { name: "base_url", value: "https://api.example.com", required: true, type: "text" },
  { name: "context_ref", value: "{{parent.output}}", required: false, type: "reference" },
  { name: "max_retries", value: "3", required: false, type: "number" },
];

// Import MessageSquare for workbench
import { MessageSquare as MessageSquareIcon } from "lucide-react";

// Workbench Content Component
const WorkbenchContent = ({ activeSubItem, onToggleConversation, conversationPanelOpen }) => {
  const getTitle = () => {
    switch (activeSubItem) {
      case "new-conversation": return "New Conversation";
      case "recent": return "Recent Conversations";
      case "starred": return "Starred Conversations";
      case "continue-last": return "Continue Last Session";
      default: return "Workbench";
    }
  };

  const getDescription = () => {
    switch (activeSubItem) {
      case "new-conversation": return "Start a fresh conversation with the AI assistant";
      case "recent": return "View and continue your recent conversations";
      case "starred": return "Access your favorite saved conversations";
      case "continue-last": return "Resume where you left off";
      default: return "Select an option from the menu to get started";
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden">
      <div className="h-14 flex items-center justify-between px-4 bg-surface border-b border-outline-variant" style={{ height: "56px" }}>
        <h2 className="text-title-md text-on-surface font-semibold">{getTitle()}</h2>
        {!conversationPanelOpen && onToggleConversation && (
          <button onClick={onToggleConversation} className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
            <PanelRightOpen className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <MessageSquareIcon className="h-16 w-16 mx-auto mb-4 text-primary opacity-50" />
          <h3 className="text-headline-sm text-on-surface font-semibold mb-2">{getTitle()}</h3>
          <p className="text-body-md text-on-surface-variant">{getDescription()}</p>
          {activeSubItem === "new-conversation" && (
            <button className="mt-6 px-6 py-3 bg-primary text-primary-foreground rounded-m3-lg text-label-lg font-medium hover:bg-primary/90 transition-colors">
              Start New Conversation
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Settings Content Component
const SettingsContent = ({ activeSubItem, onToggleConversation, conversationPanelOpen }) => {
  const settingsData = {
    general: { title: "General Settings", description: "Configure application preferences and defaults" },
    "ai-models": { title: "AI Models", description: "Manage model defaults, pricing, and configurations" },
    "api-keys": { title: "API Keys", description: "Securely manage your API credentials" },
    theme: { title: "Theme Settings", description: "Customize light and dark mode preferences" },
    notifications: { title: "Notifications", description: "Configure alert and notification preferences" },
    profile: { title: "Profile Settings", description: "Manage your account and user preferences" },
  };

  const current = settingsData[activeSubItem] || { title: "Settings", description: "Select a settings category from the menu" };

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden">
      <div className="h-14 flex items-center justify-between px-4 bg-surface border-b border-outline-variant" style={{ height: "56px" }}>
        <h2 className="text-title-md text-on-surface font-semibold">{current.title}</h2>
        {!conversationPanelOpen && onToggleConversation && (
          <button onClick={onToggleConversation} className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
            <PanelRightOpen className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-6">
          <div>
            <h3 className="text-headline-sm text-on-surface font-semibold mb-2">{current.title}</h3>
            <p className="text-body-md text-on-surface-variant">{current.description}</p>
          </div>
          
          {activeSubItem && (
            <div className="space-y-4">
              <div className="p-4 bg-surface-container-low rounded-m3-lg border border-outline-variant">
                <label className="text-label-lg text-on-surface font-medium block mb-2">Example Setting</label>
                <input 
                  type="text" 
                  placeholder="Enter value..." 
                  className="w-full h-10 px-3 bg-surface-container rounded-m3-md border border-outline-variant text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="p-4 bg-surface-container-low rounded-m3-lg border border-outline-variant">
                <label className="text-label-lg text-on-surface font-medium block mb-2">Toggle Option</label>
                <div className="flex items-center justify-between">
                  <span className="text-body-md text-on-surface-variant">Enable this feature</span>
                  <div className="w-12 h-6 bg-primary rounded-full relative cursor-pointer">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-primary-foreground rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Health Content Component
const HealthContent = ({ activeSubItem, onToggleConversation, conversationPanelOpen }) => {
  const healthData = {
    overview: { title: "System Overview", status: "operational", items: ["Database", "AI Services", "Authentication", "API"] },
    database: { title: "Database Status", status: "connected", details: "PostgreSQL connected • 45ms latency • 156 active connections" },
    "ai-services": { title: "AI Services", status: "online", details: "OpenAI API operational • GPT-4 available • 23ms avg response" },
    "auth-status": { title: "Authentication", status: "authenticated", details: "Session valid • Token expires in 23h • MFA enabled" },
    "api-health": { title: "API Health", status: "healthy", details: "All endpoints responding • 99.9% uptime • Rate limit: 847/1000" },
  };

  const current = healthData[activeSubItem] || { title: "Health Check", status: "unknown" };

  const getStatusColor = (status) => {
    switch (status) {
      case "operational":
      case "connected":
      case "online":
      case "authenticated":
      case "healthy":
        return "bg-green-500";
      case "degraded":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden">
      <div className="h-14 flex items-center justify-between px-4 bg-surface border-b border-outline-variant" style={{ height: "56px" }}>
        <div className="flex items-center gap-3">
          <h2 className="text-title-md text-on-surface font-semibold">{current.title}</h2>
          <span className={`w-2 h-2 rounded-full ${getStatusColor(current.status)}`} />
        </div>
        {!conversationPanelOpen && onToggleConversation && (
          <button onClick={onToggleConversation} className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
            <PanelRightOpen className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-6">
          {activeSubItem === "overview" ? (
            <div className="grid grid-cols-2 gap-4">
              {current.items?.map((item, i) => (
                <div key={i} className="p-4 bg-surface-container-low rounded-m3-lg border border-outline-variant">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-label-lg text-on-surface font-medium">{item}</span>
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  </div>
                  <span className="text-body-sm text-on-surface-variant">Operational</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 bg-surface-container-low rounded-m3-lg border border-outline-variant">
              <div className="flex items-center gap-3 mb-4">
                <span className={`w-3 h-3 rounded-full ${getStatusColor(current.status)}`} />
                <span className="text-label-lg text-on-surface font-medium capitalize">{current.status}</span>
              </div>
              {current.details && (
                <p className="text-body-md text-on-surface-variant">{current.details}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MockupReadingPane = ({ hasSelection = true, onExport, activeNav = "prompts", activeSubItem = null, selectedTemplate = null, onToggleConversation, conversationPanelOpen = true, selectedPromptHasChildren = true }) => {
  const [activeTab, setActiveTab] = useState("prompt");
  const [templateTab, setTemplateTab] = useState("overview");

  // When activeNav is templates, show template-specific tabs
  const isTemplateMode = activeNav === "templates";
  const isWorkbenchMode = activeNav === "workbench";
  const isSettingsMode = activeNav === "settings";
  const isHealthMode = activeNav === "health";
  const effectiveTab = isTemplateMode ? "templates" : activeTab;

  const promptTabs = [
    { id: "prompt", icon: FileText, label: "Prompt" },
    { id: "settings", icon: Sliders, label: "Prompt Settings" },
    { id: "variables", icon: Variable, label: "Variables" },
  ];

  const templateTabs = [
    { id: "overview", icon: FileText, label: "Overview" },
    { id: "structure", icon: LayoutTemplate, label: "Structure" },
    { id: "variables", icon: Variable, label: "Variables" },
  ];

  const tabs = isTemplateMode ? templateTabs : promptTabs;
  const currentTab = isTemplateMode ? templateTab : activeTab;
  const setCurrentTab = isTemplateMode ? setTemplateTab : setActiveTab;

  // Workbench mode view
  if (isWorkbenchMode) {
    return (
      <WorkbenchContent activeSubItem={activeSubItem} onToggleConversation={onToggleConversation} conversationPanelOpen={conversationPanelOpen} />
    );
  }

  // Settings mode view
  if (isSettingsMode) {
    return (
      <SettingsContent activeSubItem={activeSubItem} onToggleConversation={onToggleConversation} conversationPanelOpen={conversationPanelOpen} />
    );
  }

  // Health mode view
  if (isHealthMode) {
    return (
      <HealthContent activeSubItem={activeSubItem} onToggleConversation={onToggleConversation} conversationPanelOpen={conversationPanelOpen} />
    );
  }

  if (!hasSelection && !isTemplateMode) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface">
        <div className="text-center text-on-surface-variant">
          <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-body-md">Select a prompt to view</p>
          <p className="text-label-md mt-1">or create a new one</p>
        </div>
      </div>
    );
  }

  if (isTemplateMode && !selectedTemplate) {
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
    <div className="flex-1 flex flex-col bg-surface overflow-hidden">
      {/* Toolbar */}
      <div 
        className="h-14 flex items-center gap-2 px-4 bg-surface border-b border-outline-variant"
        style={{ height: "56px" }}
      >
        {/* Tabs */}
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              icon={tab.icon}
              label={tab.label}
              isActive={currentTab === tab.id}
              onClick={() => setCurrentTab(tab.id)}
            />
          ))}
        </div>

        <div className="flex-1" />

        {/* Action buttons */}
        <IconButton icon={Star} label="Star" />
        <IconButton icon={Copy} label="Duplicate" />
        <IconButton icon={Download} label="Export" onClick={onExport} />
        <IconButton icon={Share2} label="Share" />
        <IconButton icon={Trash2} label="Delete" />
        
        {/* Run buttons - only for prompts */}
        {!isTemplateMode && (
          <>
            <IconButton icon={Play} label="Run prompt" variant="primary" />
            {selectedPromptHasChildren && (
              <IconButton icon={Workflow} label="Run cascade" variant="primary" />
            )}
          </>
        )}
        
        <IconButton icon={MoreVertical} label="More options" />
        
        {/* Conversation panel toggle */}
        {!conversationPanelOpen && onToggleConversation && (
          <IconButton icon={PanelRightOpen} label="Show conversation" onClick={onToggleConversation} />
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6 scrollbar-thin">
        {/* Template Editor Content */}
        {isTemplateMode && selectedTemplate && (
          <>
            {templateTab === "overview" && (
              <div className="max-w-3xl space-y-6">
                {/* Title */}
                <div>
                  <h1 className="text-headline-sm text-on-surface font-semibold" style={{ fontSize: "24px" }}>
                    {selectedTemplate.name}
                  </h1>
                  <p className="text-body-sm text-on-surface-variant mt-1">
                    Last edited Dec 23, 2024
                  </p>
                </div>

                {/* Name Field */}
                <div className="space-y-2">
                  <label className="text-label-lg text-on-surface font-medium">Template Name</label>
                  <div 
                    className="min-h-12 p-4 bg-surface-container rounded-m3-md border border-outline-variant"
                    style={{ borderRadius: "12px" }}
                  >
                    <p className="text-body-md text-on-surface">{selectedTemplate.name}</p>
                  </div>
                </div>

                {/* Description Field */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-label-lg text-on-surface font-medium">Description</label>
                    <div className="flex items-center gap-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="w-7 h-7 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                            <Copy className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px]">Copy</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <div 
                    className="min-h-20 p-4 bg-surface-container rounded-m3-md border border-outline-variant"
                    style={{ borderRadius: "12px" }}
                  >
                    <p className="text-body-md text-on-surface">
                      A reusable template for creating professional customer support agent prompts with consistent tone and behavior guidelines.
                    </p>
                  </div>
                </div>

                {/* Category Field */}
                <div className="space-y-2">
                  <label className="text-label-lg text-on-surface font-medium">Category</label>
                  <div 
                    className="min-h-12 p-4 bg-surface-container rounded-m3-md border border-outline-variant flex items-center"
                    style={{ borderRadius: "12px" }}
                  >
                    <span className="text-body-md px-2 py-1 rounded bg-amber-500/10 text-amber-600">
                      {selectedTemplate.category || "Business"}
                    </span>
                  </div>
                </div>

                {/* Notes Field - template specific */}
                <div className="space-y-2">
                  <label className="text-label-lg text-on-surface font-medium">Usage Notes</label>
                  <div 
                    className="min-h-24 p-4 bg-surface-container rounded-m3-md border border-outline-variant"
                    style={{ borderRadius: "12px" }}
                  >
                    <p className="text-body-md text-on-surface-variant italic">
                      Add notes about when and how to use this template...
                    </p>
                  </div>
                </div>
              </div>
            )}

            {templateTab === "structure" && (
              <div className="max-w-3xl space-y-6">
                <div>
                  <h2 className="text-title-md text-on-surface font-semibold">Template Structure</h2>
                  <p className="text-body-sm text-on-surface-variant mt-1">Define the hierarchy of prompts in this template</p>
                </div>

                {/* Structure Tree */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-label-lg text-on-surface font-medium">Prompt Nodes</label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="w-7 h-7 flex items-center justify-center rounded-sm text-primary hover:bg-on-surface/[0.08]">
                          <Plus className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-[10px]">Add Node</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="p-4 bg-surface-container rounded-m3-md border border-outline-variant space-y-2">
                    {[
                      { name: "1. Initialize Context", level: 0 },
                      { name: "2. Process Input", level: 1 },
                      { name: "3. Generate Response", level: 1 },
                      { name: "4. Format Output", level: 2 },
                      { name: "5. Quality Check", level: 1 },
                    ].map((node, idx) => (
                      <div 
                        key={idx}
                        className="h-10 flex items-center gap-2 px-3 bg-surface-container-high rounded-m3-sm border border-outline-variant"
                        style={{ marginLeft: `${node.level * 20}px` }}
                      >
                        <FileText className="h-4 w-4 text-on-surface-variant" />
                        <span className="text-body-sm text-on-surface">{node.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {templateTab === "variables" && (
              <div className="max-w-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-title-md text-on-surface font-semibold">Template Variables</h2>
                  <span className="text-label-sm text-on-surface-variant">4 variables</span>
                </div>
                
                <div className="space-y-1">
                  {[
                    { name: "company_name", type: "text", required: true, default: "Your Company" },
                    { name: "support_email", type: "text", required: true, default: "support@example.com" },
                    { name: "tone", type: "enum", required: false, default: "Professional" },
                    { name: "escalation_threshold", type: "number", required: false, default: "3" },
                  ].map((variable) => (
                    <div 
                      key={variable.name}
                      className="h-10 flex items-center gap-3 px-3 bg-surface-container rounded-m3-sm border border-outline-variant"
                      style={{ height: "40px" }}
                    >
                      <VariableTypeIcon type={variable.type} />
                      <span className="text-label-md text-on-surface font-medium w-40 truncate">
                        {variable.name}
                      </span>
                      {variable.required && (
                        <span className="text-[10px] text-primary">*</span>
                      )}
                      <div className="flex-1 h-7 px-2 flex items-center bg-surface-container-high rounded-m3-sm border border-outline-variant">
                        <span className="text-body-sm text-on-surface-variant truncate">
                          Default: {variable.default}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Prompt Editor Content */}
        {!isTemplateMode && currentTab === "prompt" && (
          <div className="max-w-3xl space-y-6">
            {/* Title */}
            <div>
              <h1 className="text-headline-sm text-on-surface font-semibold" style={{ fontSize: "24px" }}>
                Customer Support Bot
              </h1>
              <p className="text-body-sm text-on-surface-variant mt-1">
                Last edited Dec 23, 2024
              </p>
            </div>

            {/* System Prompt */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-label-lg text-on-surface font-medium">
                  System Prompt
                </label>
                <div className="flex items-center gap-0.5">
                  <LibraryPickerDropdown />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-7 h-7 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                        <Variable className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Insert Variable</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-7 h-7 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                        <Link2 className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Insert Reference</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-7 h-7 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                        <Copy className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Copy</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-7 h-7 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">More Options</TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div 
                className="min-h-32 p-4 bg-surface-container rounded-m3-md border border-outline-variant"
                style={{ borderRadius: "12px" }}
              >
                <p className="text-body-md text-on-surface whitespace-pre-wrap">
                  You are a helpful customer support assistant for a software company. Your role is to:

                  1. Answer customer questions accurately and professionally
                  2. Help troubleshoot common issues
                  3. Escalate complex problems to human agents when needed
                  4. Maintain a friendly and empathetic tone

                  Always ask clarifying questions if the customer's issue is unclear.
                </p>
              </div>
            </div>

            {/* User Prompt */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-label-lg text-on-surface font-medium">
                  User Prompt
                </label>
                <div className="flex items-center gap-0.5">
                  <LibraryPickerDropdown />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-7 h-7 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                        <Variable className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Insert Variable</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-7 h-7 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                        <Link2 className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Insert Reference</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-7 h-7 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                        <Copy className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Copy</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-7 h-7 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">More Options</TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div 
                className="min-h-24 p-4 bg-surface-container rounded-m3-md border border-outline-variant"
                style={{ borderRadius: "12px" }}
              >
                <p className="text-body-md text-on-surface whitespace-pre-wrap">
                  Customer inquiry: {"{{customer_message}}"}

                  Customer context:
                  - Account type: {"{{account_type}}"}
                  - Previous tickets: {"{{ticket_count}}"}
                </p>
              </div>
            </div>

            {/* Output */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-label-lg text-on-surface font-medium">
                  Last Output
                </label>
                <div className="flex items-center gap-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-7 h-7 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                        <Copy className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Copy</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-7 h-7 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">More Options</TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div 
                className="min-h-24 p-4 bg-surface-container-high rounded-m3-md border border-outline-variant"
                style={{ borderRadius: "12px" }}
              >
                <p className="text-body-md text-on-surface-variant italic">
                  Run the prompt to see output here...
                </p>
              </div>
            </div>
          </div>
        )}

        {!isTemplateMode && currentTab === "settings" && (
          <div className="max-w-xl space-y-6">
            <h2 className="text-title-md text-on-surface font-semibold">Prompt Settings</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-outline-variant">
                <span className="text-body-md text-on-surface">Model</span>
                <span className="text-body-md text-on-surface-variant">gpt-4o</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-outline-variant">
                <span className="text-body-md text-on-surface">Temperature</span>
                <span className="text-body-md text-on-surface-variant">0.7</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-outline-variant">
                <span className="text-body-md text-on-surface">Max Tokens</span>
                <span className="text-body-md text-on-surface-variant">4096</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-outline-variant">
                <span className="text-body-md text-on-surface">Top P</span>
                <span className="text-body-md text-on-surface-variant">1.0</span>
              </div>
            </div>
          </div>
        )}

        {!isTemplateMode && currentTab === "variables" && (
          <div className="max-w-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-title-md text-on-surface font-semibold">Variables</h2>
              <span className="text-label-sm text-on-surface-variant">{mockVariables.length} variables</span>
            </div>
            
            {/* Compact variable rows */}
            <div className="space-y-1">
              {mockVariables.map((variable) => (
                <div 
                  key={variable.name}
                  className="h-10 flex items-center gap-3 px-3 bg-surface-container rounded-m3-sm border border-outline-variant"
                  style={{ height: "40px" }}
                >
                  <VariableTypeIcon type={variable.type} />
                  <span className="text-label-md text-on-surface font-medium w-32 truncate">
                    {variable.name}
                  </span>
                  {variable.required && (
                    <span className="text-[10px] text-primary">*</span>
                  )}
                  {variable.isSecret && (
                    <span className="text-[10px] text-warning">secret</span>
                  )}
                  <div className="flex-1 h-7 px-2 flex items-center bg-surface-container-high rounded-m3-sm border border-outline-variant">
                    <span className={`text-body-sm truncate ${variable.value ? "text-on-surface" : "text-on-surface-variant"}`}>
                      {variable.value || "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MockupReadingPane;
