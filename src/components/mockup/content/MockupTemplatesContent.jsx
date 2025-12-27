import React, { useState } from "react";
import { 
  FileText, Braces, Link2, Copy, Download, Trash2,
  LayoutTemplate, Variable, Code, Eye
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
        className={`h-8 w-9 flex items-center justify-center rounded-m3-sm transition-colors ${
          isActive 
            ? "bg-secondary-container text-secondary-container-foreground" 
            : "text-on-surface-variant hover:bg-on-surface/[0.08]"
        }`}
      >
        <Icon className="h-4 w-4" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="text-[10px]">{label}</TooltipContent>
  </Tooltip>
);

const MockupTemplatesContent = ({ selectedTemplate, activeTemplateTab = "prompts" }) => {
  const [activeEditorTab, setActiveEditorTab] = useState("overview");

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
    <div className="flex-1 flex flex-col bg-surface overflow-hidden">
      {/* Header - 56px */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-outline-variant" style={{ height: "56px" }}>
        <div>
          <h3 className="text-title-sm text-on-surface font-medium">{selectedTemplate.name}</h3>
          {selectedTemplate.description && (
            <p className="text-[10px] text-on-surface-variant">{selectedTemplate.description}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                <Eye className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Preview</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                <Copy className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Duplicate</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                <Download className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Export</TooltipContent>
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

      {/* Tab Bar */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-outline-variant">
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

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-4">
        {activeTemplateTab === "prompts" && (
          <div className="space-y-4 max-w-2xl">
            <div className="space-y-1.5">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Name</label>
              <div className="h-8 px-2.5 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant">
                <span className="text-body-sm text-on-surface">{selectedTemplate.name}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Description</label>
              <div className="h-8 px-2.5 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant">
                <span className="text-body-sm text-on-surface">{selectedTemplate.description}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Category</label>
              <div className="h-8 px-2.5 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant">
                <span className={`text-body-sm px-1.5 py-0.5 rounded ${getCategoryColor(selectedTemplate.category)}`}>
                  {selectedTemplate.category}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Nodes</label>
                <div className="h-8 px-2.5 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant">
                  <span className="text-body-sm text-on-surface">{selectedTemplate.nodes}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Variables</label>
                <div className="h-8 px-2.5 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant">
                  <span className="text-body-sm text-on-surface">{selectedTemplate.vars}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTemplateTab === "schemas" && (
          <div className="space-y-3 max-w-2xl">
            <div className="space-y-1.5">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">JSON Schema</label>
              <div className="min-h-56 p-3 bg-surface-container rounded-m3-md border border-outline-variant font-mono text-[10px] text-on-surface whitespace-pre overflow-auto">
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
          <div className="space-y-4 max-w-2xl">
            <div className="space-y-1.5">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Selected Fields</label>
              <div className="flex flex-wrap gap-1.5">
                {["System Prompt", "User Prompt", "Output", "Variables"].map(field => (
                  <span key={field} className="text-body-sm px-2 py-1 bg-secondary-container text-secondary-container-foreground rounded-m3-sm">
                    {field}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">Variable Mappings</label>
              <div className="space-y-1.5">
                {[
                  { name: "customer_name", source: "Manual Input" },
                  { name: "ticket_id", source: "Parent Output" },
                  { name: "context", source: "Confluence Page" },
                ].map(mapping => (
                  <div key={mapping.name} className="h-8 flex items-center gap-3 px-3 bg-surface-container rounded-m3-sm border border-outline-variant">
                    <span className="text-body-sm text-on-surface font-medium font-mono w-28">{mapping.name}</span>
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

export default MockupTemplatesContent;
