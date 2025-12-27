import React, { useState, useMemo, useEffect } from "react";
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

const EXPORT_TYPE_OPTIONS = [
  { id: "confluence", icon: Globe, label: "Confluence", description: "Export to Confluence pages" },
  { id: "json", icon: FileJson, label: "JSON", description: "Download as JSON file" },
  { id: "markdown", icon: FileText, label: "Markdown", description: "Download as Markdown" },
];

// Mock data for configuration step (will be replaced with real Confluence data later)
const CONFLUENCE_SPACES = [
  { id: "eng", name: "Engineering", key: "ENG" },
  { id: "prod", name: "Product", key: "PROD" },
  { id: "docs", name: "Documentation", key: "DOCS" },
];

const CONFLUENCE_PAGES = [
  { id: "p1", name: "AI Prompts", space: "eng", children: ["p1a"] },
  { id: "p1a", name: "Production Prompts", space: "eng", parentId: "p1", children: [] },
  { id: "p2", name: "Product Specs", space: "prod", children: [] },
  { id: "p3", name: "User Guides", space: "docs", children: [] },
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

// Prompt Tree Item Component - Updated for real data structure
const PromptTreeItem = ({ item, selectedIds, onToggle, level = 0 }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children && item.children.length > 0;
  const isSelected = selectedIds.includes(item.row_id);

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
          checked={isSelected}
          onCheckedChange={() => onToggle(item.row_id)}
          className="h-4 w-4"
        />
        <span className="text-body-sm text-on-surface">{item.prompt_name || 'Unnamed'}</span>
      </div>
      {expanded && hasChildren && item.children.map(child => (
        <PromptTreeItem 
          key={child.row_id} 
          item={child} 
          selectedIds={selectedIds}
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

const MockupExportPanel = ({ 
  onClose, 
  exportState,
  treeData = [],
  selectedPromptId 
}) => {
  // Destructure from exportState hook if provided, else use defaults
  const {
    currentStep = 1,
    selectedPromptIds = [],
    selectedFields = [],
    selectedVariables = {},
    exportType = 'confluence',
    promptsData = [],
    variablesData = {},
    isLoadingPrompts = false,
    isLoadingVariables = false,
    canProceed = false,
    goToStep,
    goNext,
    goBack,
    togglePromptSelection,
    toggleFieldSelection,
    toggleVariableSelection,
    selectAllPrompts,
    clearPromptSelection,
    setExportType,
    fetchPromptsData,
    fetchVariablesData,
    STANDARD_FIELDS = [],
  } = exportState || {};
  
  // Local state for configuration step
  const [selectedSpace, setSelectedSpace] = useState("");
  const [selectedPage, setSelectedPage] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  
  // Get all prompt IDs from tree for select all
  const allPromptIds = useMemo(() => {
    const collectIds = (items) => {
      const ids = [];
      items.forEach(item => {
        ids.push(item.row_id);
        if (item.children?.length) {
          ids.push(...collectIds(item.children));
        }
      });
      return ids;
    };
    return collectIds(treeData);
  }, [treeData]);
  
  // When moving to step 2 (fields), fetch prompts and variables data
  useEffect(() => {
    if (currentStep === 2 && selectedPromptIds.length > 0 && promptsData.length === 0) {
      fetchPromptsData?.(selectedPromptIds);
      fetchVariablesData?.(selectedPromptIds);
    }
  }, [currentStep, selectedPromptIds, promptsData.length, fetchPromptsData, fetchVariablesData]);
  
  const filteredPages = selectedSpace 
    ? CONFLUENCE_PAGES.filter(p => p.space === selectedSpace && !p.parentId)
    : CONFLUENCE_PAGES.filter(p => !p.parentId);

  const selectedPromptsCount = selectedPromptIds.length;
  const selectedFieldsCount = selectedFields.length;
  
  // Gather selected variables count
  const selectedVariablesCount = Object.values(selectedVariables).reduce(
    (acc, vars) => acc + (vars?.length || 0), 0
  );

  const canProceedLocal = () => {
    if (!exportState) return false;
    switch (currentStep) {
      case 1: return selectedPromptsCount > 0;
      case 2: return selectedFieldsCount > 0 || selectedVariablesCount > 0;
      case 3: return exportType !== null;
      case 4: return exportType !== 'confluence' || (selectedSpace && selectedPage);
      default: return true;
    }
  };
  
  const handleSelectAll = () => {
    selectAllPrompts?.(allPromptIds);
  };
  
  const handleClearAll = () => {
    clearPromptSelection?.();
  };
  
  const handleExport = async () => {
    setIsExporting(true);
    // Simulate export
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsExporting(false);
    onClose?.();
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
      <StepNavigation currentStep={currentStep} onStepClick={goToStep} />

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
                  onClick={handleSelectAll}
                  className="text-[10px] text-primary hover:underline"
                >
                  Select All
                </button>
                <span className="text-on-surface-variant">•</span>
                <button 
                  onClick={handleClearAll}
                  className="text-[10px] text-on-surface-variant hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant p-2">
              {treeData.length === 0 ? (
                <p className="text-body-sm text-on-surface-variant py-4 text-center">No prompts available</p>
              ) : (
                treeData.map(item => (
                  <PromptTreeItem 
                    key={item.row_id} 
                    item={item} 
                    selectedIds={selectedPromptIds}
                    onToggle={togglePromptSelection}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* Step 2: Select Fields */}
        {currentStep === 2 && (
          <div className="space-y-4">
            {/* Standard Fields */}
            <div className="space-y-2">
              <label className="text-label-sm text-on-surface-variant uppercase">Standard Fields</label>
              {isLoadingPrompts ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant" />
                  <span className="text-body-sm text-on-surface-variant">Loading prompts...</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {STANDARD_FIELDS.map(field => (
                    <label key={field.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox 
                        checked={selectedFields.includes(field.id)}
                        onCheckedChange={() => toggleFieldSelection?.(field.id)}
                        className="h-4 w-4"
                      />
                      <span className="text-body-sm text-on-surface">{field.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Variables by Prompt */}
            <div className="space-y-2">
              <label className="text-label-sm text-on-surface-variant uppercase">Variables</label>
              {isLoadingVariables ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant" />
                  <span className="text-body-sm text-on-surface-variant">Loading variables...</span>
                </div>
              ) : (
                promptsData.filter(p => selectedPromptIds.includes(p.row_id)).map(prompt => {
                  const promptVars = variablesData[prompt.row_id] || [];
                  if (promptVars.length === 0) return null;
                  
                  return (
                    <div key={prompt.row_id} className="bg-surface-container-low rounded-m3-md p-2">
                      <span className="text-[10px] text-on-surface-variant">{prompt.prompt_name}</span>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {promptVars.map(v => (
                          <label key={v.variable_name} className="flex items-center gap-1.5 px-2 py-1 bg-surface-container rounded-m3-sm cursor-pointer">
                            <Checkbox 
                              checked={(selectedVariables[prompt.row_id] || []).includes(v.variable_name)}
                              onCheckedChange={() => toggleVariableSelection?.(prompt.row_id, v.variable_name)}
                              className="h-3.5 w-3.5"
                            />
                            <code className="text-[11px] text-on-surface font-mono">{v.variable_name}</code>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
              {!isLoadingVariables && Object.keys(variablesData).length === 0 && (
                <p className="text-body-sm text-on-surface-variant/70 italic py-2">No variables found for selected prompts.</p>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Destination */}
        {currentStep === 3 && (
          <div className="space-y-3">
            <label className="text-label-sm text-on-surface-variant uppercase">Export Destination</label>
            <div className="space-y-1">
              {EXPORT_TYPE_OPTIONS.map(type => {
                const Icon = type.icon;
                const isSelected = exportType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setExportType?.(type.id)}
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
            {exportType === "confluence" && (
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
              </>
            )}

            {exportType === "json" && (
              <div className="space-y-3">
                <div className="p-3 bg-surface-container-low rounded-m3-lg border border-outline-variant">
                  <p className="text-body-sm text-on-surface">JSON export will include:</p>
                  <ul className="mt-2 space-y-1 text-[11px] text-on-surface-variant">
                    <li>• {selectedPromptsCount} prompts with hierarchy</li>
                    <li>• {selectedFieldsCount} fields per prompt</li>
                    <li>• {selectedVariablesCount} variable values</li>
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

            {exportType === "markdown" && (
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
              onClick={() => goBack?.()}
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
                onClick={() => goNext?.()}
                disabled={!canProceedLocal()}
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
                onClick={handleExport}
                disabled={!canProceedLocal() || isExporting}
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