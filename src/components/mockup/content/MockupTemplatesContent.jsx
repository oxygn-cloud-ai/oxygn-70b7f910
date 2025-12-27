import React, { useState, useCallback, useMemo } from "react";
import { 
  FileText, Braces, Link2, Copy, Download, Trash2,
  LayoutTemplate, Variable, Code, Eye, Plus, GripVertical,
  ChevronRight, ChevronDown, Settings, ArrowRight, Layers,
  Edit3, Check, X, AlertCircle, Upload, Paperclip, CheckCircle2,
  Clock, XCircle, Loader2, Save
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LabelPicker } from "@/components/ui/label-picker";
import { Switch } from "@/components/ui/switch";
import { SettingCard } from "@/components/ui/setting-card";
import { SettingRow } from "@/components/ui/setting-row";
import { SettingDivider } from "@/components/ui/setting-divider";
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
  const [activeEditorTab, setActiveEditorTab] = useState("overview");
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
    <div className="flex-1 flex flex-col bg-surface overflow-hidden">
      {/* Header - 56px */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-outline-variant" style={{ height: "56px" }}>
        <div>
          <h3 className="text-title-sm text-on-surface font-medium">{templateName}</h3>
          {templateDescription && (
            <p className="text-[10px] text-on-surface-variant">{templateDescription}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Save</TooltipContent>
          </Tooltip>
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
              <button 
                onClick={handleDelete}
                className="w-7 h-7 flex items-center justify-center rounded-m3-full text-destructive hover:bg-on-surface/[0.08]"
              >
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
            <TabButton icon={Paperclip} label="Attachments" isActive={activeEditorTab === "attachments"} onClick={() => setActiveEditorTab("attachments")} />
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
                  <input
                    type="text"
                    value={editedName || templateName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="h-8 px-2.5 bg-surface-container rounded-m3-sm border border-outline-variant min-w-44 text-body-sm text-on-surface"
                  />
                </SettingRow>
                <SettingDivider />
                <SettingRow label="Description">
                  <input
                    type="text"
                    value={editedDescription || templateDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    className="h-8 px-2.5 bg-surface-container rounded-m3-sm border border-outline-variant min-w-44 text-body-sm text-on-surface"
                  />
                </SettingRow>
                <SettingDivider />
                <SettingRow label="Category">
                  <div className="h-8 px-2.5 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant min-w-44">
                    <span className="text-body-sm text-on-surface">{selectedTemplate.category || "General"}</span>
                  </div>
                </SettingRow>
              </div>
            </SettingCard>

            <SettingCard label="Statistics">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-2 bg-surface-container rounded-m3-sm text-center">
                  <span className="text-title-sm text-on-surface font-semibold">
                    {selectedTemplate.structure?.children?.length || 0}
                  </span>
                  <p className="text-[10px] text-on-surface-variant">Nodes</p>
                </div>
                <div className="p-2 bg-surface-container rounded-m3-sm text-center">
                  <span className="text-title-sm text-on-surface font-semibold">{displayVariables.length}</span>
                  <p className="text-[10px] text-on-surface-variant">Variables</p>
                </div>
                <div className="p-2 bg-surface-container rounded-m3-sm text-center">
                  <span className="text-title-sm text-on-surface font-semibold">{selectedTemplate.version || 1}</span>
                  <p className="text-[10px] text-on-surface-variant">Version</p>
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
              {selectedTemplate.structure ? (
                <StructureNode node={selectedTemplate.structure} />
              ) : (
                MOCK_STRUCTURE.map(node => (
                  <StructureNode key={node.id} node={node} />
                ))
              )}
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
              <span className="text-label-sm text-on-surface-variant uppercase">Template Variables ({displayVariables.length})</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                    <Plus className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Add Variable</TooltipContent>
              </Tooltip>
            </div>
            
            {displayVariables.length === 0 ? (
              <div className="text-center py-8 text-on-surface-variant">
                <Variable className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-[11px]">No variables defined</p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayVariables.map((variable, idx) => (
                  <VariableRow key={variable.name || variable.variable_name || idx} variable={variable} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Attachments Tab */}
        {activeEditorTab === "attachments" && activeTemplateTab === "prompts" && (
          <AttachmentsTab />
        )}

        {/* Preview Tab */}
        {activeEditorTab === "preview" && activeTemplateTab === "prompts" && (
          <div className="max-w-2xl">
            <EnhancedPreviewPanel template={selectedTemplate} variables={displayVariables} />
          </div>
        )}

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