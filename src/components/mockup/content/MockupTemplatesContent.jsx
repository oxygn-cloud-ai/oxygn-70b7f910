import React, { useState } from "react";
import { 
  FileText, Braces, Link2, Copy, Download, Trash2,
  LayoutTemplate, Variable, Code, Eye, Plus, GripVertical,
  ChevronRight, ChevronDown, Settings, ArrowRight, Layers,
  Edit3, Check, X, AlertCircle
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LabelPicker } from "@/components/ui/label-picker";
import { Switch } from "@/components/ui/switch";
import { SettingCard } from "@/components/ui/setting-card";
import { SettingRow } from "@/components/ui/setting-row";
import { SettingDivider } from "@/components/ui/setting-divider";

// Mock structure data
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

const MOCK_VARIABLES = [
  { name: "customer_name", type: "string", required: true, default: "", description: "Customer's full name" },
  { name: "ticket_id", type: "string", required: true, default: "", description: "Support ticket identifier" },
  { name: "priority", type: "enum", required: false, default: "medium", description: "Ticket priority level", options: ["low", "medium", "high"] },
  { name: "context", type: "text", required: false, default: "", description: "Additional context from knowledge base" },
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
        
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${typeColors[node.type]}`}>
          {node.type}
        </span>
        
        <span className="text-body-sm text-on-surface flex-1">{node.name}</span>
        
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
          {node.children.map(child => (
            <StructureNode key={child.id} node={child} level={level + 1} />
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

  return (
    <div className="flex items-center gap-3 p-2.5 bg-surface-container rounded-m3-sm border border-outline-variant group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <code className="text-body-sm text-on-surface font-mono font-medium">{variable.name}</code>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${typeColors[variable.type]}`}>
            {variable.type}
          </span>
          {variable.required && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-600">required</span>
          )}
        </div>
        <p className="text-[10px] text-on-surface-variant mt-0.5">{variable.description}</p>
      </div>
      
      {variable.default && (
        <div className="text-[10px] text-on-surface-variant">
          default: <code className="text-on-surface">{variable.default}</code>
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

// Preview Panel Component
const PreviewPanel = ({ template }) => (
  <div className="space-y-4">
    <div className="p-3 bg-surface-container-low rounded-m3-lg border border-outline-variant">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="h-4 w-4 text-on-surface-variant" />
        <span className="text-label-sm text-on-surface-variant uppercase">Live Preview</span>
      </div>
      
      <div className="space-y-3">
        <div className="p-3 bg-surface-container rounded-m3-md">
          <span className="text-[10px] text-on-surface-variant uppercase">System Prompt</span>
          <p className="text-body-sm text-on-surface mt-1">
            You are a helpful customer support agent for <span className="px-1 py-0.5 bg-primary/10 text-primary rounded font-mono text-[11px]">{"{{company_name}}"}</span>. 
            Always be polite and professional.
          </p>
        </div>
        
        <div className="p-3 bg-surface-container rounded-m3-md">
          <span className="text-[10px] text-on-surface-variant uppercase">User Prompt</span>
          <p className="text-body-sm text-on-surface mt-1">
            Handle the following support ticket from <span className="px-1 py-0.5 bg-primary/10 text-primary rounded font-mono text-[11px]">{"{{customer_name}}"}</span>:
            <br /><br />
            Ticket ID: <span className="px-1 py-0.5 bg-primary/10 text-primary rounded font-mono text-[11px]">{"{{ticket_id}}"}</span>
            <br />
            Priority: <span className="px-1 py-0.5 bg-primary/10 text-primary rounded font-mono text-[11px]">{"{{priority}}"}</span>
          </p>
        </div>
      </div>
    </div>
    
    <div className="flex items-center gap-2 p-2 bg-amber-500/10 rounded-m3-md">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <span className="text-body-sm text-amber-700">2 required variables not mapped</span>
    </div>
  </div>
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
            <TabButton icon={Layers} label="Structure" isActive={activeEditorTab === "structure"} onClick={() => setActiveEditorTab("structure")} />
            <TabButton icon={Variable} label="Variables" isActive={activeEditorTab === "variables"} onClick={() => setActiveEditorTab("variables")} />
            <TabButton icon={Eye} label="Preview" isActive={activeEditorTab === "preview"} onClick={() => setActiveEditorTab("preview")} />
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

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-4">
        {/* Overview Tab */}
        {activeEditorTab === "overview" && activeTemplateTab === "prompts" && (
          <div className="space-y-4 max-w-2xl">
            <SettingCard label="Details">
              <div className="space-y-3">
                <SettingRow label="Name">
                  <div className="h-8 px-2.5 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant min-w-44">
                    <span className="text-body-sm text-on-surface">{selectedTemplate.name}</span>
                  </div>
                </SettingRow>
                <SettingDivider />
                <SettingRow label="Description">
                  <div className="h-8 px-2.5 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant min-w-44">
                    <span className="text-body-sm text-on-surface">{selectedTemplate.description}</span>
                  </div>
                </SettingRow>
                <SettingDivider />
                <SettingRow label="Category">
                  <div className="h-8 px-2.5 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant min-w-44">
                    <span className="text-body-sm text-on-surface">Customer Support</span>
                  </div>
                </SettingRow>
              </div>
            </SettingCard>

            <SettingCard label="Labels">
              <LabelPicker 
                labels={selectedTemplate.labels || []} 
                onLabelsChange={(newLabels) => console.log('Labels changed:', newLabels)}
              />
            </SettingCard>

            <SettingCard label="Statistics">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-2 bg-surface-container rounded-m3-sm text-center">
                  <span className="text-title-sm text-on-surface font-semibold">{selectedTemplate.nodes || 3}</span>
                  <p className="text-[10px] text-on-surface-variant">Nodes</p>
                </div>
                <div className="p-2 bg-surface-container rounded-m3-sm text-center">
                  <span className="text-title-sm text-on-surface font-semibold">{selectedTemplate.vars || 4}</span>
                  <p className="text-[10px] text-on-surface-variant">Variables</p>
                </div>
                <div className="p-2 bg-surface-container rounded-m3-sm text-center">
                  <span className="text-title-sm text-on-surface font-semibold">12</span>
                  <p className="text-[10px] text-on-surface-variant">Uses</p>
                </div>
              </div>
            </SettingCard>
          </div>
        )}

        {/* Structure Tab */}
        {activeEditorTab === "structure" && activeTemplateTab === "prompts" && (
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center justify-between">
              <span className="text-label-sm text-on-surface-variant uppercase">Template Structure</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                    <Plus className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Add Node</TooltipContent>
              </Tooltip>
            </div>
            
            <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant p-2">
              {MOCK_STRUCTURE.map(node => (
                <StructureNode key={node.id} node={node} />
              ))}
            </div>
            
            <p className="text-[10px] text-on-surface-variant">
              Drag and drop to reorder. Click on a node to edit its content.
            </p>
          </div>
        )}

        {/* Variables Tab */}
        {activeEditorTab === "variables" && activeTemplateTab === "prompts" && (
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center justify-between">
              <span className="text-label-sm text-on-surface-variant uppercase">Template Variables</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                    <Plus className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Add Variable</TooltipContent>
              </Tooltip>
            </div>
            
            <div className="space-y-2">
              {MOCK_VARIABLES.map(variable => (
                <VariableRow key={variable.name} variable={variable} />
              ))}
            </div>
          </div>
        )}

        {/* Preview Tab */}
        {activeEditorTab === "preview" && activeTemplateTab === "prompts" && (
          <div className="max-w-2xl">
            <PreviewPanel template={selectedTemplate} />
          </div>
        )}

        {/* Schema Tab */}
        {activeTemplateTab === "schemas" && activeEditorTab === "schema" && (
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
  "action": "escalate_to_support",
  "priority": "high",
  "details": {
    "reason": "Customer reported billing discrepancy",
    "confidence": 0.92
  }
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
