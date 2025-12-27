import React, { useState } from "react";
import { 
  FileText, Braces, Link2, Plus, Copy, Download, Trash2,
  Search, LayoutTemplate, Variable, Upload, Code, Eye
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Mock data
const MOCK_PROMPT_TEMPLATES = [
  { id: "1", name: "Customer Support Agent", description: "Professional support responses", category: "Business", nodes: 5, vars: 3 },
  { id: "2", name: "Code Review Assistant", description: "Thorough code analysis", category: "Technical", nodes: 4, vars: 2 },
  { id: "3", name: "Content Writer", description: "SEO-optimized blog content", category: "Marketing", nodes: 6, vars: 4 },
  { id: "4", name: "Data Analyst", description: "Extract insights from data", category: "Technical", nodes: 3, vars: 5 },
];

const MOCK_SCHEMA_TEMPLATES = [
  { id: "1", name: "Action Response", description: "Structured action items", category: "Action" },
  { id: "2", name: "Data Extraction", description: "Extract structured data", category: "Extraction" },
  { id: "3", name: "Sentiment Analysis", description: "Analyze text sentiment", category: "Analysis" },
  { id: "4", name: "Entity Recognition", description: "Identify named entities", category: "NLP" },
];

const MOCK_MAPPING_TEMPLATES = [
  { id: "1", name: "Standard Export", fields: 4, vars: 6 },
  { id: "2", name: "Documentation Only", fields: 2, vars: 3 },
  { id: "3", name: "Full Backup", fields: 6, vars: 8 },
];

const getCategoryColor = (category) => {
  const colors = {
    Business: "bg-amber-500/10 text-amber-600",
    Technical: "bg-green-500/10 text-green-600",
    Marketing: "bg-blue-500/10 text-blue-600",
    Creative: "bg-purple-500/10 text-purple-600",
    Action: "bg-orange-500/10 text-orange-600",
    Extraction: "bg-cyan-500/10 text-cyan-600",
    Analysis: "bg-indigo-500/10 text-indigo-600",
    NLP: "bg-pink-500/10 text-pink-600",
  };
  return colors[category] || "bg-muted text-muted-foreground";
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

// Template List Panel
const TemplateListPanel = ({ 
  activeTemplateTab, 
  setActiveTemplateTab, 
  searchQuery, 
  setSearchQuery, 
  selectedTemplate, 
  setSelectedTemplate 
}) => (
  <div className="w-72 flex flex-col border-r border-outline-variant bg-surface-container-low overflow-hidden">
    {/* Header */}
    <div className="p-3 border-b border-outline-variant space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-label-lg text-on-surface font-medium">Templates</span>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-7 h-7 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                <Upload className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Import</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-7 h-7 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
                <Plus className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Create New</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Type Tabs */}
      <div className="flex gap-1 p-1 bg-surface-container rounded-m3-sm">
        {[
          { id: "prompts", icon: FileText, label: "Prompt Templates" },
          { id: "schemas", icon: Braces, label: "JSON Schemas" },
          { id: "mappings", icon: Link2, label: "Export Mappings" },
        ].map(tab => (
          <Tooltip key={tab.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => { setActiveTemplateTab(tab.id); setSelectedTemplate(null); }}
                className={`flex-1 h-7 flex items-center justify-center rounded-sm transition-colors ${
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
);

// Template Editor Panel
const TemplateEditorPanel = ({ selectedTemplate, activeTemplateTab }) => {
  const [activeEditorTab, setActiveEditorTab] = useState("overview");

  if (!selectedTemplate) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface">
        <div className="text-center">
          <LayoutTemplate className="h-12 w-12 mx-auto text-on-surface-variant/30 mb-3" />
          <p className="text-body-md text-on-surface-variant">Select a template to view</p>
          <p className="text-label-sm text-on-surface-variant/70 mt-1">or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden">
      {/* Editor Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-outline-variant" style={{ height: "56px" }}>
        <div>
          <h3 className="text-title-sm text-on-surface font-semibold">{selectedTemplate.name}</h3>
          {selectedTemplate.description && (
            <p className="text-[11px] text-on-surface-variant">{selectedTemplate.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                <Eye className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Preview</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                <Copy className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Duplicate</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                <Download className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Export</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-8 h-8 flex items-center justify-center rounded-m3-full text-destructive hover:bg-on-surface/[0.08]">
                <Trash2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Delete</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Editor Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-outline-variant">
        {activeTemplateTab === "prompts" && (
          <>
            <TabButton icon={FileText} label="Overview" isActive={activeEditorTab === "overview"} onClick={() => setActiveEditorTab("overview")} />
            <TabButton icon={LayoutTemplate} label="Structure" isActive={activeEditorTab === "structure"} onClick={() => setActiveEditorTab("structure")} />
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
            <TabButton icon={Variable} label="Variables" isActive={activeEditorTab === "variables"} onClick={() => setActiveEditorTab("variables")} />
          </>
        )}
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTemplateTab === "prompts" && (
          <div className="space-y-6 max-w-2xl">
            <div className="space-y-2">
              <label className="text-label-sm text-on-surface-variant">Name</label>
              <div className="h-10 px-3 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant">
                <span className="text-body-md text-on-surface">{selectedTemplate.name}</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-label-sm text-on-surface-variant">Description</label>
              <div className="h-10 px-3 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant">
                <span className="text-body-md text-on-surface">{selectedTemplate.description}</span>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-label-sm text-on-surface-variant">Nodes</label>
                <div className="h-10 px-3 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant">
                  <span className="text-body-md text-on-surface">{selectedTemplate.nodes}</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-label-sm text-on-surface-variant">Variables</label>
                <div className="h-10 px-3 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant">
                  <span className="text-body-md text-on-surface">{selectedTemplate.vars}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTemplateTab === "schemas" && (
          <div className="space-y-4 max-w-2xl">
            <div className="space-y-2">
              <label className="text-label-sm text-on-surface-variant">JSON Schema</label>
              <div className="min-h-64 p-4 bg-surface-container rounded-m3-md border border-outline-variant font-mono text-[11px] text-on-surface whitespace-pre overflow-auto">
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
    },
    "details": {
      "type": "object",
      "properties": {
        "reason": { "type": "string" },
        "confidence": { "type": "number" }
      }
    }
  },
  "required": ["action", "priority"]
}`}
              </div>
            </div>
          </div>
        )}

        {activeTemplateTab === "mappings" && (
          <div className="space-y-6 max-w-2xl">
            <div className="space-y-2">
              <label className="text-label-sm text-on-surface-variant">Selected Fields</label>
              <div className="flex flex-wrap gap-2">
                {["System Prompt", "User Prompt", "Output", "Variables"].map(field => (
                  <span key={field} className="text-body-sm px-3 py-1.5 bg-secondary-container text-secondary-container-foreground rounded-m3-sm">
                    {field}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-label-sm text-on-surface-variant">Variable Mappings</label>
              <div className="space-y-2">
                {[
                  { name: "customer_name", source: "Manual Input" },
                  { name: "ticket_id", source: "Parent Output" },
                  { name: "context", source: "Confluence Page" },
                ].map(mapping => (
                  <div key={mapping.name} className="h-10 flex items-center gap-4 px-4 bg-surface-container rounded-m3-sm border border-outline-variant">
                    <span className="text-body-sm text-on-surface font-medium font-mono w-32">{mapping.name}</span>
                    <span className="text-on-surface-variant">→</span>
                    <span className="text-body-sm text-on-surface-variant">{mapping.source}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Main Templates Content Component
const MockupTemplatesContent = () => {
  const [activeTemplateTab, setActiveTemplateTab] = useState("prompts");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  return (
    <div className="flex-1 flex bg-surface overflow-hidden">
      <TemplateListPanel
        activeTemplateTab={activeTemplateTab}
        setActiveTemplateTab={setActiveTemplateTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedTemplate={selectedTemplate}
        setSelectedTemplate={setSelectedTemplate}
      />
      <TemplateEditorPanel
        selectedTemplate={selectedTemplate}
        activeTemplateTab={activeTemplateTab}
      />
    </div>
  );
};

export default MockupTemplatesContent;
