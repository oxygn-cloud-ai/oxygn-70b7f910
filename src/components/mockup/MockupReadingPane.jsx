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
  Plus
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

const MockupReadingPane = ({ hasSelection = true, onExport }) => {
  const [activeTab, setActiveTab] = useState("prompt");

  const tabs = [
    { id: "prompt", icon: FileText, label: "Prompt" },
    { id: "settings", icon: Sliders, label: "Prompt Settings" },
    { id: "variables", icon: Variable, label: "Variables" },
    { id: "templates", icon: LayoutTemplate, label: "Templates" },
  ];

  if (!hasSelection) {
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
              isActive={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
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
        
        {/* Run button */}
        <IconButton icon={Play} label="Run prompt" variant="primary" />
        
        <IconButton icon={MoreVertical} label="More options" />
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6 scrollbar-thin">
        {activeTab === "prompt" && (
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

        {activeTab === "settings" && (
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

        {activeTab === "variables" && (
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

        {activeTab === "templates" && (
          <MockupTemplatesTab />
        )}
      </div>
    </div>
  );
};

export default MockupReadingPane;
