import React, { useState } from "react";
import { 
  X, 
  FileJson, 
  FileText, 
  Globe,
  ChevronRight,
  ChevronDown,
  Check,
  Square
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const EXPORT_TYPES = [
  { id: "confluence", icon: Globe, label: "Confluence", description: "Export to Confluence pages" },
  { id: "json", icon: FileJson, label: "JSON", description: "Download as JSON file" },
  { id: "markdown", icon: FileText, label: "Markdown", description: "Download as Markdown" },
];

const mockPromptTree = [
  { 
    id: "1", 
    name: "Document Processor", 
    selected: true,
    children: [
      { id: "1-1", name: "Parse Input", selected: true },
      { id: "1-2", name: "Extract Metadata", selected: true },
      { id: "1-3", name: "Validate Schema", selected: false },
    ]
  },
  { 
    id: "2", 
    name: "Customer Support Bot", 
    selected: true,
    children: [
      { id: "2-1", name: "Greeting Handler", selected: true },
      { id: "2-2", name: "Issue Classifier", selected: true },
    ]
  },
  { id: "3", name: "API Documentation", selected: false, children: [] },
  { id: "4", name: "Summary Generator", selected: true, children: [] },
];

const PromptTreeItem = ({ item, level = 0, expanded, onToggle }) => {
  const hasChildren = item.children?.length > 0;
  const paddingLeft = 12 + level * 16;

  return (
    <>
      <div 
        className="h-9 flex items-center gap-2 pr-3 rounded-m3-sm hover:bg-on-surface/[0.08] cursor-pointer"
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={onToggle}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="h-4 w-4 text-on-surface-variant" /> : <ChevronRight className="h-4 w-4 text-on-surface-variant" />
        ) : (
          <span className="w-4" />
        )}
        <div className={`w-4 h-4 rounded-sm border flex items-center justify-center ${
          item.selected 
            ? "bg-primary border-primary" 
            : "border-on-surface-variant"
        }`}>
          {item.selected && <Check className="h-3 w-3 text-primary-foreground" />}
        </div>
        <span className="text-body-sm text-on-surface truncate">{item.name}</span>
      </div>
      {hasChildren && expanded && item.children.map(child => (
        <PromptTreeItem key={child.id} item={child} level={level + 1} expanded={false} />
      ))}
    </>
  );
};

const MockupExportPanel = ({ onClose }) => {
  const [selectedType, setSelectedType] = useState("confluence");
  const [expandedIds, setExpandedIds] = useState(["1", "2"]);

  const toggleExpand = (id) => {
    setExpandedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="h-full flex flex-col bg-surface-container overflow-hidden">
      {/* Header */}
      <div 
        className="h-14 flex items-center justify-between px-4 border-b border-outline-variant"
        style={{ height: "56px" }}
      >
        <span className="text-title-md text-on-surface font-semibold">Export</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
            >
              <X className="h-5 w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-label-sm">Close</TooltipContent>
        </Tooltip>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6 scrollbar-thin">
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
                  className={`w-full h-12 flex items-center gap-3 px-3 rounded-m3-md border transition-colors ${
                    isSelected 
                      ? "border-primary bg-primary/10" 
                      : "border-outline-variant hover:bg-on-surface/[0.08]"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-on-surface-variant"}`} />
                  <div className="flex-1 text-left">
                    <p className={`text-body-sm ${isSelected ? "text-primary" : "text-on-surface"}`}>{type.label}</p>
                    <p className="text-[10px] text-on-surface-variant">{type.description}</p>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Prompt Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-label-md text-on-surface font-medium">Select Prompts</label>
            <span className="text-[10px] text-on-surface-variant">4 of 7 selected</span>
          </div>
          <div className="border border-outline-variant rounded-m3-md p-2 max-h-64 overflow-auto scrollbar-thin">
            {mockPromptTree.map(item => (
              <PromptTreeItem 
                key={item.id} 
                item={item} 
                expanded={expandedIds.includes(item.id)}
                onToggle={() => toggleExpand(item.id)}
              />
            ))}
          </div>
        </div>

        {/* Fields Selection (simplified) */}
        <div className="space-y-2">
          <label className="text-label-md text-on-surface font-medium">Include Fields</label>
          <div className="space-y-1">
            {["System Prompt", "User Prompt", "Output", "Variables", "Settings"].map(field => (
              <div key={field} className="h-8 flex items-center gap-2 px-2">
                <div className="w-4 h-4 rounded-sm border border-primary bg-primary flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
                <span className="text-body-sm text-on-surface">{field}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-outline-variant">
        <button className="w-full h-10 bg-primary text-primary-foreground rounded-m3-md text-label-lg font-medium hover:bg-primary/90 transition-colors">
          Export
        </button>
      </div>
    </div>
  );
};

export default MockupExportPanel;
