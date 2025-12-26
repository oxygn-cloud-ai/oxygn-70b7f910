import React, { useState } from "react";
import { 
  X, 
  FileJson, 
  FileText, 
  Globe,
  Check
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";

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

const MockupExportPanel = ({ onClose }) => {
  const [selectedType, setSelectedType] = useState("confluence");
  const [fields, setFields] = useState(EXPORT_FIELDS);

  const toggleField = (id) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, checked: !f.checked } : f));
  };

  return (
    <div className="h-full flex flex-col bg-surface-container overflow-hidden">
      {/* Header */}
      <div 
        className="h-14 flex items-center justify-between px-4 border-b border-outline-variant"
        style={{ height: "56px" }}
      >
        <div>
          <span className="text-title-md text-on-surface font-semibold">Export</span>
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
          <TooltipContent className="text-label-sm">Close</TooltipContent>
        </Tooltip>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-5 scrollbar-thin">
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
            <label className="text-label-md text-on-surface font-medium">Confluence Settings</label>
            <div className="space-y-2">
              <div className="h-10 px-3 flex items-center bg-surface-container-high rounded-m3-sm border border-outline-variant">
                <span className="text-body-sm text-on-surface-variant">Select parent page...</span>
              </div>
              <div className="h-10 px-3 flex items-center bg-surface-container-high rounded-m3-sm border border-outline-variant">
                <span className="text-body-sm text-on-surface-variant">Select space...</span>
              </div>
            </div>
          </div>
        )}
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
