import React, { useState } from "react";
import { 
  X, 
  FileJson, 
  FileText, 
  Globe,
  Check,
  ChevronDown,
  Save,
  FolderOpen
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

const EXPORT_TYPES = [
  { id: "confluence", icon: Globe, label: "Confluence", description: "Export to Confluence pages" },
  { id: "json", icon: FileJson, label: "JSON", description: "Download as JSON file" },
  { id: "markdown", icon: FileText, label: "Markdown", description: "Download as Markdown" },
];

const EXPORT_FIELDS = [
  { id: "system_prompt", label: "System Prompt", checked: true },
  { id: "user_prompt", label: "User Prompt", checked: true },
  { id: "output", label: "Output", checked: true },
  { id: "variables", label: "Variables", checked: true },
  { id: "settings", label: "Settings", checked: false },
  { id: "children", label: "Include Children", checked: true },
];

const CONFLUENCE_SPACES = [
  { id: "eng", name: "Engineering", key: "ENG" },
  { id: "prod", name: "Product", key: "PROD" },
  { id: "docs", name: "Documentation", key: "DOCS" },
  { id: "support", name: "Customer Support", key: "SUP" },
];

const CONFLUENCE_PAGES = [
  { id: "p1", name: "AI Prompts", space: "eng" },
  { id: "p2", name: "System Architecture", space: "eng" },
  { id: "p3", name: "Product Specs", space: "prod" },
  { id: "p4", name: "User Guides", space: "docs" },
  { id: "p5", name: "FAQ", space: "support" },
];

const SAVED_TEMPLATES = [
  { id: "t1", name: "Standard Export" },
  { id: "t2", name: "Documentation Only" },
  { id: "t3", name: "Full Backup" },
];

const MockupExportPanel = ({ onClose }) => {
  const [selectedType, setSelectedType] = useState("confluence");
  const [fields, setFields] = useState(EXPORT_FIELDS);
  const [selectedSpace, setSelectedSpace] = useState("");
  const [selectedPage, setSelectedPage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  const toggleField = (id) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, checked: !f.checked } : f));
  };

  const filteredPages = selectedSpace 
    ? CONFLUENCE_PAGES.filter(p => p.space === selectedSpace)
    : CONFLUENCE_PAGES;

  return (
    <div className="h-full flex flex-col bg-surface-container overflow-hidden">
      {/* Header */}
      <div 
        className="h-14 flex items-center justify-between px-4 border-b border-outline-variant"
        style={{ height: "56px" }}
      >
        <div>
          <span className="text-title-sm text-on-surface font-medium">Export</span>
          <p className="text-[10px] text-on-surface-variant">Customer Support Bot</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
            >
              <X className="h-5 w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">Close</TooltipContent>
        </Tooltip>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-5 scrollbar-thin">
        {/* Template Selection */}
        <div className="space-y-2">
          <label className="text-label-md text-on-surface font-medium">Template</label>
          <div className="flex gap-2">
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger className="flex-1 h-10 bg-surface-container-high border-outline-variant text-on-surface">
                <SelectValue placeholder="Select template..." />
              </SelectTrigger>
              <SelectContent className="bg-surface-container-high border-outline-variant z-50">
                {SAVED_TEMPLATES.map(template => (
                  <SelectItem 
                    key={template.id} 
                    value={template.id}
                    className="text-on-surface hover:bg-on-surface/[0.08] focus:bg-on-surface/[0.12]"
                  >
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                  className="w-10 h-10 flex items-center justify-center rounded-m3-sm border border-outline-variant text-on-surface-variant hover:bg-on-surface/[0.08]"
                >
                  <Save className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Save as Template</TooltipContent>
            </Tooltip>
          </div>
          
          {/* Save Template Input */}
          {showSaveTemplate && (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Template name..."
                className="flex-1 h-9 px-3 bg-surface-container-high border border-outline-variant rounded-m3-sm text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="w-9 h-9 flex items-center justify-center rounded-m3-sm bg-primary text-primary-foreground hover:bg-primary/90">
                    <Check className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Save Template</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Export Type Selection */}
        <div className="space-y-2">
          <label className="text-label-md text-on-surface font-medium">Destination</label>
          <div className="space-y-1">
            {EXPORT_TYPES.map(type => {
              const Icon = type.icon;
              const isSelected = selectedType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`w-full h-11 flex items-center gap-3 px-3 rounded-m3-md border transition-colors ${
                    isSelected 
                      ? "border-primary bg-secondary-container" 
                      : "border-outline-variant hover:bg-on-surface/[0.08]"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-on-surface-variant"}`} />
                  <div className="flex-1 text-left">
                    <p className={`text-body-sm ${isSelected ? "text-on-surface" : "text-on-surface"}`}>{type.label}</p>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Fields Selection - compact inline layout */}
        <div className="space-y-2">
          <label className="text-label-md text-on-surface font-medium">Include</label>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {fields.map(field => (
              <label 
                key={field.id} 
                className="flex items-center gap-2 cursor-pointer"
              >
                <Checkbox 
                  checked={field.checked}
                  onCheckedChange={() => toggleField(field.id)}
                  className="h-4 w-4 border-on-surface-variant data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <span className="text-body-sm text-on-surface">{field.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Confluence-specific options */}
        {selectedType === "confluence" && (
          <div className="space-y-3 pt-2 border-t border-outline-variant">
            <label className="text-label-md text-on-surface font-medium">Confluence Target</label>
            <div className="space-y-2">
              {/* Space Selector */}
              <Select value={selectedSpace} onValueChange={(val) => { setSelectedSpace(val); setSelectedPage(""); }}>
                <SelectTrigger className="w-full h-10 bg-surface-container-high border-outline-variant text-on-surface">
                  <SelectValue placeholder="Select space..." />
                </SelectTrigger>
                <SelectContent className="bg-surface-container-high border-outline-variant z-50">
                  {CONFLUENCE_SPACES.map(space => (
                    <SelectItem 
                      key={space.id} 
                      value={space.id}
                      className="text-on-surface hover:bg-on-surface/[0.08] focus:bg-on-surface/[0.12]"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">{space.key}</span>
                        {space.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Parent Page Selector */}
              <Select value={selectedPage} onValueChange={setSelectedPage} disabled={!selectedSpace}>
                <SelectTrigger className="w-full h-10 bg-surface-container-high border-outline-variant text-on-surface disabled:opacity-50">
                  <SelectValue placeholder="Select parent page..." />
                </SelectTrigger>
                <SelectContent className="bg-surface-container-high border-outline-variant z-50">
                  {filteredPages.map(page => (
                    <SelectItem 
                      key={page.id} 
                      value={page.id}
                      className="text-on-surface hover:bg-on-surface/[0.08] focus:bg-on-surface/[0.12]"
                    >
                      <span className="flex items-center gap-2">
                        <FolderOpen className="h-3.5 w-3.5 text-on-surface-variant" />
                        {page.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-outline-variant">
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="w-full h-10 flex items-center justify-center bg-primary text-primary-foreground rounded-m3-md hover:bg-primary/90 transition-colors">
              <Globe className="h-5 w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">Export</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export default MockupExportPanel;
