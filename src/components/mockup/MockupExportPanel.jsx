import React, { useState } from "react";
import { 
  X, 
  FileJson, 
  FileText, 
  Globe,
  Check,
  ChevronDown,
  ChevronRight,
  Save,
  FolderOpen,
  ArrowLeft,
  ArrowRight,
  Download,
  Loader2,
  Variable,
  Edit3,
  Layers,
  Settings
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Step definitions
const STEPS = [
  { id: 1, label: "Prompts", icon: Layers },
  { id: 2, label: "Fields", icon: FileText },
  { id: 3, label: "Destination", icon: Globe },
  { id: 4, label: "Configure", icon: Settings },
];

const EXPORT_TYPES = [
  { id: "confluence", icon: Globe, label: "Confluence", description: "Export to Confluence pages" },
  { id: "json", icon: FileJson, label: "JSON", description: "Download as JSON file" },
  { id: "markdown", icon: FileText, label: "Markdown", description: "Download as Markdown" },
];

const EXPORT_FIELDS = [
  { id: "system_prompt", label: "System Prompt", checked: true, category: "standard" },
  { id: "user_prompt", label: "User Prompt", checked: true, category: "standard" },
  { id: "output", label: "Output", checked: true, category: "standard" },
  { id: "model", label: "Model", checked: false, category: "standard" },
  { id: "temperature", label: "Temperature", checked: false, category: "standard" },
  { id: "note", label: "Note", checked: false, category: "standard" },
];

const MOCK_PROMPTS = [
  { id: "1", name: "Customer Support Bot", level: 0, children: ["2", "3"], checked: true },
  { id: "2", name: "Greeting Generator", level: 1, parentId: "1", children: [], checked: true },
  { id: "3", name: "FAQ Handler", level: 1, parentId: "1", children: ["4"], checked: true },
  { id: "4", name: "Escalation Classifier", level: 2, parentId: "3", children: [], checked: false },
  { id: "5", name: "Email Responder", level: 0, children: [], checked: false },
];

const MOCK_VARIABLES = [
  { id: "v1", name: "customer_name", promptId: "1", checked: true },
  { id: "v2", name: "ticket_id", promptId: "1", checked: true },
  { id: "v3", name: "greeting_style", promptId: "2", checked: false },
  { id: "v4", name: "faq_topic", promptId: "3", checked: true },
];

const CONFLUENCE_SPACES = [
  { id: "eng", name: "Engineering", key: "ENG" },
  { id: "prod", name: "Product", key: "PROD" },
  { id: "docs", name: "Documentation", key: "DOCS" },
  { id: "support", name: "Customer Support", key: "SUP" },
];

const CONFLUENCE_PAGES = [
  { id: "p1", name: "AI Prompts", space: "eng", children: ["p1a", "p1b"] },
  { id: "p1a", name: "Production Prompts", space: "eng", parentId: "p1", children: [] },
  { id: "p1b", name: "Development Prompts", space: "eng", parentId: "p1", children: [] },
  { id: "p2", name: "System Architecture", space: "eng", children: [] },
  { id: "p3", name: "Product Specs", space: "prod", children: [] },
  { id: "p4", name: "User Guides", space: "docs", children: [] },
  { id: "p5", name: "FAQ", space: "support", children: [] },
];

const CONFLUENCE_TEMPLATES = [
  { id: "t1", name: "Prompt Documentation", description: "Standard prompt doc template" },
  { id: "t2", name: "Technical Spec", description: "Detailed technical specifications" },
  { id: "t3", name: "Quick Reference", description: "Minimal, quick lookup format" },
];

const SAVED_TEMPLATES = [
  { id: "t1", name: "Standard Export" },
  { id: "t2", name: "Documentation Only" },
  { id: "t3", name: "Full Backup" },
];

const TEMPLATE_VARIABLES = [
  { name: "title", label: "Page Title", required: true },
  { name: "system_prompt", label: "System Prompt Section" },
  { name: "user_prompt", label: "User Prompt Section" },
  { name: "output", label: "Output Section" },
  { name: "metadata", label: "Metadata Footer" },
];

// Step Navigation Component
const StepNavigation = ({ currentStep, onStepClick }) => (
  <div className="flex items-center gap-1 px-4 py-2 border-b border-outline-variant">
    {STEPS.map((step, index) => {
      const isActive = step.id === currentStep;
      const isCompleted = step.id < currentStep;
      const Icon = step.icon;
      
      return (
        <React.Fragment key={step.id}>
          <button
            onClick={() => onStepClick(step.id)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-m3-sm transition-colors ${
              isActive 
                ? "bg-secondary-container text-secondary-container-foreground" 
                : isCompleted
                  ? "text-primary hover:bg-on-surface/[0.08]"
                  : "text-on-surface-variant hover:bg-on-surface/[0.08]"
            }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${
              isActive 
                ? "bg-primary text-primary-foreground" 
                : isCompleted
                  ? "bg-primary/20 text-primary"
                  : "bg-surface-container text-on-surface-variant"
            }`}>
              {isCompleted ? <Check className="h-3 w-3" /> : step.id}
            </div>
            <span className="text-[11px] font-medium">{step.label}</span>
          </button>
          {index < STEPS.length - 1 && (
            <ChevronRight className="h-3.5 w-3.5 text-on-surface-variant" />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// Prompt Tree Item Component
const PromptTreeItem = ({ prompt, prompts, onToggle, level = 0 }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = prompt.children && prompt.children.length > 0;
  const childPrompts = prompts.filter(p => prompt.children?.includes(p.id));

  return (
    <div>
      <div 
        className="flex items-center gap-2 py-1.5 hover:bg-on-surface/[0.08] rounded-m3-sm px-1"
        style={{ paddingLeft: `${level * 16 + 4}px` }}
      >
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
        <Checkbox 
          checked={prompt.checked}
          onCheckedChange={() => onToggle(prompt.id)}
          className="h-4 w-4"
        />
        <span className="text-body-sm text-on-surface">{prompt.name}</span>
      </div>
      {expanded && childPrompts.map(child => (
        <PromptTreeItem 
          key={child.id} 
          prompt={child} 
          prompts={prompts}
          onToggle={onToggle}
          level={level + 1} 
        />
      ))}
    </div>
  );
};

// Page Tree Item Component
const PageTreeItem = ({ page, pages, selectedId, onSelect, level = 0 }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = page.children && page.children.length > 0;
  const childPages = pages.filter(p => page.children?.includes(p.id));
  const isSelected = selectedId === page.id;

  return (
    <div>
      <button 
        className={`w-full flex items-center gap-2 py-1.5 rounded-m3-sm px-1 ${
          isSelected ? "bg-secondary-container" : "hover:bg-on-surface/[0.08]"
        }`}
        style={{ paddingLeft: `${level * 16 + 4}px` }}
        onClick={() => onSelect(page.id)}
      >
        {hasChildren ? (
          <span onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="p-0.5">
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-on-surface-variant" />
            )}
          </span>
        ) : (
          <div className="w-4" />
        )}
        <FolderOpen className="h-3.5 w-3.5 text-on-surface-variant" />
        <span className="text-body-sm text-on-surface">{page.name}</span>
        {isSelected && <Check className="h-3.5 w-3.5 text-primary ml-auto" />}
      </button>
      {expanded && childPages.map(child => (
        <PageTreeItem 
          key={child.id} 
          page={child} 
          pages={pages}
          selectedId={selectedId}
          onSelect={onSelect}
          level={level + 1} 
        />
      ))}
    </div>
  );
};

// Variable Source Picker Component
const VariableSourcePicker = ({ variable, prompts, onSourceChange }) => {
  const [source, setSource] = useState("static");

  const sources = [
    { id: "static", label: "Static Text" },
    { id: "field", label: "From Field" },
    { id: "variable", label: "From Variable" },
  ];

  return (
    <div className="flex items-center gap-2 p-2 bg-surface-container rounded-m3-sm border border-outline-variant">
      <div className="flex-1 min-w-0">
        <code className="text-body-sm text-on-surface font-mono">{`{{${variable.name}}}`}</code>
        {variable.required && <span className="text-[10px] text-destructive ml-1">*</span>}
      </div>
      <Select value={source} onValueChange={(v) => { setSource(v); onSourceChange?.(variable.name, v); }}>
        <SelectTrigger className="w-28 h-7 text-[11px] bg-surface-container-high border-outline-variant">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-surface-container-high border-outline-variant z-50">
          {sources.map(s => (
            <SelectItem key={s.id} value={s.id} className="text-[11px]">{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {source === "static" && (
        <input 
          type="text"
          placeholder="Enter value..."
          className="w-32 h-7 px-2 bg-surface-container-high border border-outline-variant rounded-m3-sm text-[11px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
        />
      )}
    </div>
  );
};

const MockupExportPanel = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedType, setSelectedType] = useState("confluence");
  const [fields, setFields] = useState(EXPORT_FIELDS);
  const [prompts, setPrompts] = useState(MOCK_PROMPTS);
  const [variables, setVariables] = useState(MOCK_VARIABLES);
  const [selectedSpace, setSelectedSpace] = useState("");
  const [selectedPage, setSelectedPage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedConfluenceTemplate, setSelectedConfluenceTemplate] = useState("");
  const [pageTitleSource, setPageTitleSource] = useState("static");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const toggleField = (id) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, checked: !f.checked } : f));
  };

  const togglePrompt = (id) => {
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, checked: !p.checked } : p));
  };

  const toggleVariable = (id) => {
    setVariables(prev => prev.map(v => v.id === id ? { ...v, checked: !v.checked } : v));
  };

  const selectAllPrompts = () => setPrompts(prev => prev.map(p => ({ ...p, checked: true })));
  const clearAllPrompts = () => setPrompts(prev => prev.map(p => ({ ...p, checked: false })));

  const filteredPages = selectedSpace 
    ? CONFLUENCE_PAGES.filter(p => p.space === selectedSpace && !p.parentId)
    : CONFLUENCE_PAGES.filter(p => !p.parentId);

  const selectedPromptsCount = prompts.filter(p => p.checked).length;
  const selectedFieldsCount = fields.filter(f => f.checked).length;

  const canProceed = () => {
    switch (currentStep) {
      case 1: return selectedPromptsCount > 0;
      case 2: return selectedFieldsCount > 0;
      case 3: return selectedType !== "";
      case 4: return selectedType !== "confluence" || (selectedSpace && selectedPage);
      default: return true;
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface-container overflow-hidden">
      {/* Header */}
      <div 
        className="h-14 flex items-center justify-between px-4 border-b border-outline-variant"
        style={{ height: "56px" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-title-sm text-on-surface font-medium">Export</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
            {selectedPromptsCount} prompts • {selectedFieldsCount} fields
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Template Selector */}
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="w-36 h-8 text-[11px] bg-surface-container-high border-outline-variant">
              <SelectValue placeholder="Load template..." />
            </SelectTrigger>
            <SelectContent className="bg-surface-container-high border-outline-variant z-50">
              {SAVED_TEMPLATES.map(template => (
                <SelectItem key={template.id} value={template.id} className="text-[11px]">
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
              >
                <Save className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Save Template</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
              >
                <X className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Close</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Step Navigation */}
      <StepNavigation currentStep={currentStep} onStepClick={setCurrentStep} />

      {/* Save Template Input */}
      {showSaveTemplate && (
        <div className="flex gap-2 px-4 py-2 border-b border-outline-variant bg-surface-container-low">
          <input
            type="text"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            placeholder="Template name..."
            className="flex-1 h-8 px-3 bg-surface-container-high border border-outline-variant rounded-m3-sm text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-8 h-8 flex items-center justify-center rounded-m3-sm bg-primary text-primary-foreground">
                <Check className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Save</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4 scrollbar-thin">
        {/* Step 1: Select Prompts */}
        {currentStep === 1 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-label-sm text-on-surface-variant uppercase">Select Prompts</label>
              <div className="flex items-center gap-2">
                <button 
                  onClick={selectAllPrompts}
                  className="text-[10px] text-primary hover:underline"
                >
                  Select All
                </button>
                <span className="text-on-surface-variant">•</span>
                <button 
                  onClick={clearAllPrompts}
                  className="text-[10px] text-on-surface-variant hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant p-2">
              {prompts.filter(p => p.level === 0).map(prompt => (
                <PromptTreeItem 
                  key={prompt.id} 
                  prompt={prompt} 
                  prompts={prompts}
                  onToggle={togglePrompt}
                />
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select Fields */}
        {currentStep === 2 && (
          <div className="space-y-4">
            {/* Standard Fields */}
            <div className="space-y-2">
              <label className="text-label-sm text-on-surface-variant uppercase">Standard Fields</label>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {fields.map(field => (
                  <label key={field.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox 
                      checked={field.checked}
                      onCheckedChange={() => toggleField(field.id)}
                      className="h-4 w-4"
                    />
                    <span className="text-body-sm text-on-surface">{field.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Variables by Prompt */}
            <div className="space-y-2">
              <label className="text-label-sm text-on-surface-variant uppercase">Variables</label>
              {prompts.filter(p => p.checked).map(prompt => {
                const promptVars = variables.filter(v => v.promptId === prompt.id);
                if (promptVars.length === 0) return null;
                
                return (
                  <div key={prompt.id} className="bg-surface-container-low rounded-m3-md p-2">
                    <span className="text-[10px] text-on-surface-variant">{prompt.name}</span>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {promptVars.map(v => (
                        <label key={v.id} className="flex items-center gap-1.5 px-2 py-1 bg-surface-container rounded-m3-sm cursor-pointer">
                          <Checkbox 
                            checked={v.checked}
                            onCheckedChange={() => toggleVariable(v.id)}
                            className="h-3.5 w-3.5"
                          />
                          <code className="text-[11px] text-on-surface font-mono">{v.name}</code>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Destination */}
        {currentStep === 3 && (
          <div className="space-y-3">
            <label className="text-label-sm text-on-surface-variant uppercase">Export Destination</label>
            <div className="space-y-1">
              {EXPORT_TYPES.map(type => {
                const Icon = type.icon;
                const isSelected = selectedType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`w-full h-12 flex items-center gap-3 px-3 rounded-m3-md border transition-colors ${
                      isSelected 
                        ? "border-primary bg-secondary-container" 
                        : "border-outline-variant hover:bg-on-surface/[0.08]"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-on-surface-variant"}`} />
                    <div className="flex-1 text-left">
                      <p className="text-body-sm text-on-surface font-medium">{type.label}</p>
                      <p className="text-[10px] text-on-surface-variant">{type.description}</p>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 4: Configure */}
        {currentStep === 4 && (
          <div className="space-y-4">
            {selectedType === "confluence" && (
              <>
                {/* Space Selector */}
                <div className="space-y-2">
                  <label className="text-label-sm text-on-surface-variant uppercase">Confluence Space</label>
                  <Select value={selectedSpace} onValueChange={(val) => { setSelectedSpace(val); setSelectedPage(""); }}>
                    <SelectTrigger className="w-full h-10 bg-surface-container-high border-outline-variant text-on-surface">
                      <SelectValue placeholder="Select space..." />
                    </SelectTrigger>
                    <SelectContent className="bg-surface-container-high border-outline-variant z-50">
                      {CONFLUENCE_SPACES.map(space => (
                        <SelectItem key={space.id} value={space.id}>
                          <span className="flex items-center gap-2">
                            <span className="text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">{space.key}</span>
                            {space.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Parent Page Tree */}
                {selectedSpace && (
                  <div className="space-y-2">
                    <label className="text-label-sm text-on-surface-variant uppercase">Parent Page</label>
                    <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant p-2 max-h-40 overflow-auto">
                      {filteredPages.map(page => (
                        <PageTreeItem 
                          key={page.id} 
                          page={page} 
                          pages={CONFLUENCE_PAGES}
                          selectedId={selectedPage}
                          onSelect={setSelectedPage}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Template Selector */}
                <div className="space-y-2">
                  <label className="text-label-sm text-on-surface-variant uppercase">Page Template</label>
                  <Select value={selectedConfluenceTemplate} onValueChange={setSelectedConfluenceTemplate}>
                    <SelectTrigger className="w-full h-10 bg-surface-container-high border-outline-variant text-on-surface">
                      <SelectValue placeholder="Select template (optional)..." />
                    </SelectTrigger>
                    <SelectContent className="bg-surface-container-high border-outline-variant z-50">
                      {CONFLUENCE_TEMPLATES.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          <div>
                            <span className="text-on-surface">{template.name}</span>
                            <span className="text-[10px] text-on-surface-variant ml-2">{template.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Page Title Source */}
                <div className="space-y-2">
                  <label className="text-label-sm text-on-surface-variant uppercase">Page Title</label>
                  <div className="flex items-center gap-2">
                    <Select value={pageTitleSource} onValueChange={setPageTitleSource}>
                      <SelectTrigger className="w-32 h-9 bg-surface-container-high border-outline-variant text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-surface-container-high border-outline-variant z-50">
                        <SelectItem value="static" className="text-[11px]">Static Text</SelectItem>
                        <SelectItem value="prompt_name" className="text-[11px]">Prompt Name</SelectItem>
                        <SelectItem value="field" className="text-[11px]">From Field</SelectItem>
                      </SelectContent>
                    </Select>
                    {pageTitleSource === "static" && (
                      <input 
                        type="text"
                        placeholder="Enter page title..."
                        className="flex-1 h-9 px-3 bg-surface-container-high border border-outline-variant rounded-m3-sm text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    )}
                  </div>
                </div>

                {/* Variable Mappings */}
                {selectedConfluenceTemplate && (
                  <div className="space-y-2">
                    <label className="text-label-sm text-on-surface-variant uppercase">Template Variable Mappings</label>
                    <div className="space-y-1.5">
                      {TEMPLATE_VARIABLES.map(v => (
                        <VariableSourcePicker key={v.name} variable={v} prompts={prompts} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {selectedType === "json" && (
              <div className="space-y-3">
                <div className="p-3 bg-surface-container-low rounded-m3-lg border border-outline-variant">
                  <p className="text-body-sm text-on-surface">JSON export will include:</p>
                  <ul className="mt-2 space-y-1 text-[11px] text-on-surface-variant">
                    <li>• {selectedPromptsCount} prompts with hierarchy</li>
                    <li>• {selectedFieldsCount} fields per prompt</li>
                    <li>• {variables.filter(v => v.checked).length} variable values</li>
                  </ul>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox defaultChecked className="h-4 w-4" />
                  <span className="text-body-sm text-on-surface">Include metadata (timestamps, IDs)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="h-4 w-4" />
                  <span className="text-body-sm text-on-surface">Pretty print JSON</span>
                </label>
              </div>
            )}

            {selectedType === "markdown" && (
              <div className="space-y-3">
                <div className="p-3 bg-surface-container-low rounded-m3-lg border border-outline-variant">
                  <p className="text-body-sm text-on-surface">Markdown export will create:</p>
                  <ul className="mt-2 space-y-1 text-[11px] text-on-surface-variant">
                    <li>• One file per prompt or single combined file</li>
                    <li>• Formatted with headers and code blocks</li>
                    <li>• Compatible with GitHub, Notion, etc.</li>
                  </ul>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox defaultChecked className="h-4 w-4" />
                  <span className="text-body-sm text-on-surface">Single combined file</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="h-4 w-4" />
                  <span className="text-body-sm text-on-surface">Include table of contents</span>
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-outline-variant flex items-center justify-between">
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
              className="w-9 h-9 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">Back</TooltipContent>
        </Tooltip>

        {currentStep < 4 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => setCurrentStep(Math.min(4, currentStep + 1))}
                disabled={!canProceed()}
                className="w-9 h-9 flex items-center justify-center rounded-m3-full bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Next</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => setIsExporting(true)}
                disabled={!canProceed() || isExporting}
                className="w-9 h-9 flex items-center justify-center rounded-m3-full bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Export</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

export default MockupExportPanel;
