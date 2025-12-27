import React, { useState } from "react";
import { 
  Braces, 
  ChevronRight, 
  Clock, 
  User, 
  FileText, 
  Shield, 
  Hash,
  Link2,
  Variable as VariableIcon,
  Search
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// System variable categories
const SYSTEM_VARIABLE_GROUPS = [
  {
    id: "datetime",
    label: "Date & Time",
    icon: Clock,
    variables: [
      { name: "current_date", label: "Current Date", isStatic: true },
      { name: "current_time", label: "Current Time", isStatic: true },
      { name: "current_datetime", label: "Current DateTime", isStatic: true },
      { name: "timestamp", label: "Unix Timestamp", isStatic: true },
    ]
  },
  {
    id: "user",
    label: "User",
    icon: User,
    variables: [
      { name: "user_email", label: "User Email", isStatic: true },
      { name: "user_name", label: "User Name", isStatic: true },
      { name: "user_id", label: "User ID", isStatic: true },
    ]
  },
  {
    id: "prompt",
    label: "Prompt Context",
    icon: FileText,
    variables: [
      { name: "prompt_name", label: "Prompt Name", isStatic: false },
      { name: "prompt_id", label: "Prompt ID", isStatic: false },
      { name: "parent_output", label: "Parent Output", isStatic: false },
      { name: "parent_name", label: "Parent Name", isStatic: false },
    ]
  },
  {
    id: "policy",
    label: "Policy",
    icon: Shield,
    variables: [
      { name: "compliance_notice", label: "Compliance Notice", isStatic: true },
      { name: "data_handling_policy", label: "Data Handling Policy", isStatic: true },
    ]
  },
  {
    id: "other",
    label: "Other",
    icon: Hash,
    variables: [
      { name: "random_id", label: "Random ID", isStatic: false },
      { name: "iteration_index", label: "Iteration Index", isStatic: false },
    ]
  },
];

// Mock user-defined variables
const MOCK_USER_VARIABLES = [
  { name: "customer_name", type: "text" },
  { name: "ticket_id", type: "text" },
  { name: "priority", type: "enum" },
  { name: "company_name", type: "text" },
];

// Mock prompt references
const MOCK_PROMPT_REFERENCES = [
  { id: "1", name: "Customer Support Bot", field: "output" },
  { id: "2", name: "Greeting Generator", field: "output" },
  { id: "3", name: "FAQ Handler", field: "system_prompt" },
];

const MockupVariablePicker = ({ onInsert, userVariables = MOCK_USER_VARIABLES, className = "" }) => {
  const [open, setOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);
  const [showPromptPicker, setShowPromptPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleInsert = (varName) => {
    onInsert?.(`{{${varName}}}`);
    setOpen(false);
  };

  const handlePromptRefInsert = (promptId, promptName, field) => {
    onInsert?.(`{{q.ref("${promptName}", "${field}")}}`);
    setOpen(false);
    setShowPromptPicker(false);
  };

  const toggleSection = (sectionId) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  const filteredGroups = SYSTEM_VARIABLE_GROUPS.map(group => ({
    ...group,
    variables: group.variables.filter(v => 
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.label.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(group => group.variables.length > 0);

  const filteredUserVars = userVariables.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button className={`w-6 h-6 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08] ${className}`}>
              <Braces className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent className="text-[10px]">Insert Variable</TooltipContent>
      </Tooltip>

      <PopoverContent 
        className="w-64 p-0 bg-surface-container-high border-outline-variant" 
        align="start"
        side="bottom"
      >
        {showPromptPicker ? (
          // Prompt Reference Picker
          <div className="p-2">
            <div className="flex items-center gap-2 mb-2">
              <button 
                onClick={() => setShowPromptPicker(false)}
                className="text-[10px] text-primary hover:underline"
              >
                ← Back
              </button>
              <span className="text-label-sm text-on-surface-variant">Prompt References</span>
            </div>
            <div className="space-y-1">
              {MOCK_PROMPT_REFERENCES.map(ref => (
                <button
                  key={ref.id}
                  onClick={() => handlePromptRefInsert(ref.id, ref.name, ref.field)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-m3-sm hover:bg-on-surface/[0.08] text-left"
                >
                  <Link2 className="h-3.5 w-3.5 text-on-surface-variant" />
                  <div className="flex-1 min-w-0">
                    <span className="text-body-sm text-on-surface truncate block">{ref.name}</span>
                    <span className="text-[10px] text-on-surface-variant">.{ref.field}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Main Variable Picker
          <div className="max-h-80 overflow-auto">
            {/* Search */}
            <div className="p-2 border-b border-outline-variant">
              <div className="flex items-center gap-2 h-7 px-2 bg-surface-container rounded-m3-sm border border-outline-variant">
                <Search className="h-3 w-3 text-on-surface-variant" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search variables..."
                  className="flex-1 bg-transparent text-[11px] text-on-surface placeholder:text-on-surface-variant focus:outline-none"
                />
              </div>
            </div>

            {/* Prompt References Link */}
            <button
              onClick={() => setShowPromptPicker(true)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-on-surface/[0.08] border-b border-outline-variant"
            >
              <div className="flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 text-primary" />
                <span className="text-body-sm text-primary font-medium">Prompt References</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-on-surface-variant" />
            </button>

            {/* System Variable Groups */}
            {filteredGroups.map(group => {
              const Icon = group.icon;
              const isExpanded = expandedSection === group.id;

              return (
                <Collapsible key={group.id} open={isExpanded} onOpenChange={() => toggleSection(group.id)}>
                  <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 hover:bg-on-surface/[0.08]">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-on-surface-variant" />
                      <span className="text-body-sm text-on-surface">{group.label}</span>
                    </div>
                    <ChevronRight className={`h-3.5 w-3.5 text-on-surface-variant transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="pb-1">
                      {group.variables.map(variable => (
                        <button
                          key={variable.name}
                          onClick={() => handleInsert(variable.name)}
                          className="w-full flex items-center justify-between px-3 py-1.5 pl-9 hover:bg-on-surface/[0.08]"
                        >
                          <code className="text-[11px] text-on-surface font-mono">{`{{${variable.name}}}`}</code>
                          {variable.isStatic && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-surface-container text-on-surface-variant">auto</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}

            {/* User Variables */}
            {filteredUserVars.length > 0 && (
              <div className="border-t border-outline-variant">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    <VariableIcon className="h-3.5 w-3.5 text-on-surface-variant" />
                    <span className="text-body-sm text-on-surface">User Variables</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                    {filteredUserVars.length}
                  </span>
                </div>
                <div className="pb-1">
                  {filteredUserVars.map(variable => (
                    <button
                      key={variable.name}
                      onClick={() => handleInsert(variable.name)}
                      className="w-full flex items-center justify-between px-3 py-1.5 pl-9 hover:bg-on-surface/[0.08]"
                    >
                      <code className="text-[11px] text-on-surface font-mono">{`{{${variable.name}}}`}</code>
                      <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary">{variable.type}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default MockupVariablePicker;
