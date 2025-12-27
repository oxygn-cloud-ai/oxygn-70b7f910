import React, { useState, useRef, useEffect } from "react";
import { 
  ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, 
  Edit3, Check, Library, Search, Variable 
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LabelBadge } from "@/components/ui/label-badge";

const MIN_HEIGHT = 100;
const COLLAPSED_HEIGHT = 0;

// Variable definitions for hover tooltips
const VARIABLE_DEFINITIONS = {
  customer_message: { name: "customer_message", type: "text", description: "The customer's original inquiry or message", source: "User Input", required: true },
  ticket_count: { name: "ticket_count", type: "number", description: "Number of previous support tickets", source: "Database", required: false, default: "0" },
  company_name: { name: "company_name", type: "text", description: "Name of the company", source: "Settings", required: true },
  support_email: { name: "support_email", type: "text", description: "Support contact email address", source: "Settings", required: true },
  parent_output: { name: "parent.output", type: "reference", description: "Output from parent prompt", source: "Cascade", required: false },
};

const LIBRARY_PROMPTS = [
  { id: "1", name: "Professional Tone", labels: ["Style"] },
  { id: "2", name: "Friendly Greeting", labels: ["Intro", "Style"] },
  { id: "3", name: "Error Handler", labels: ["System", "Technical"] },
  { id: "4", name: "JSON Output Format", labels: ["Format", "Technical"] },
];

const MOCK_VARIABLES = [
  { name: "customer_message" },
  { name: "ticket_count" },
  { name: "company_name" },
  { name: "support_email" },
  { name: "parent.output" },
];

// Highlighted text component
const HighlightedText = ({ text }) => {
  const variablePattern = /\{\{(\w+(?:\.\w+)?)\}\}/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = variablePattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
    }
    
    const varName = match[1];
    const varDef = VARIABLE_DEFINITIONS[varName] || VARIABLE_DEFINITIONS[varName.replace('.', '_')];
    
    parts.push(
      <Tooltip key={`var-${match.index}`}>
        <TooltipTrigger asChild>
          <span className="text-primary font-medium cursor-help bg-primary/10 px-0.5 rounded">
            {`{{${varName}}}`}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs p-2 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-label-sm font-medium text-on-surface">{varName}</span>
            <span className="text-[10px] px-1 py-0.5 rounded bg-secondary-container text-secondary-container-foreground">{varDef?.type || "text"}</span>
            {varDef?.required && <span className="text-[10px] text-destructive">*required</span>}
          </div>
          {varDef?.description && (
            <p className="text-[10px] text-on-surface-variant">{varDef.description}</p>
          )}
          {varDef?.source && (
            <p className="text-[10px] text-on-surface-variant">Source: {varDef.source}</p>
          )}
        </TooltipContent>
      </Tooltip>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }
  
  return <>{parts}</>;
};

// Variable Picker Dropdown
const VariablePickerDropdown = ({ onInsert }) => {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button className="w-6 h-6 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
              <Variable className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent className="text-[10px]">Insert Variable</TooltipContent>
      </Tooltip>
      <DropdownMenuContent className="w-44 bg-surface-container-high border-outline-variant">
        <div className="px-2 py-1 text-[10px] text-on-surface-variant uppercase tracking-wider">Variables</div>
        <DropdownMenuSeparator className="bg-outline-variant" />
        {MOCK_VARIABLES.map(v => (
          <DropdownMenuItem 
            key={v.name} 
            onClick={() => onInsert(v.name)}
            className="text-body-sm text-on-surface hover:bg-on-surface/[0.08] cursor-pointer font-mono"
          >
            {`{{${v.name}}}`}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Library Picker Dropdown
const LibraryPickerDropdown = () => {
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredPrompts = LIBRARY_PROMPTS.filter(prompt => 
    prompt.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button className="w-6 h-6 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]">
              <Library className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent className="text-[10px]">Insert from Library</TooltipContent>
      </Tooltip>
      <DropdownMenuContent className="w-52 bg-surface-container-high border-outline-variant">
        <div className="px-2 py-1 text-[10px] text-on-surface-variant uppercase tracking-wider">Library Prompts</div>
        <div className="px-2 pb-2">
          <div className="flex items-center gap-2 h-7 px-2 bg-surface-container rounded-m3-sm border border-outline-variant">
            <Search className="h-3 w-3 text-on-surface-variant" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search prompts..."
              className="flex-1 bg-transparent text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
            />
          </div>
        </div>
        <DropdownMenuSeparator className="bg-outline-variant" />
        <div className="max-h-40 overflow-auto">
          {filteredPrompts.map(prompt => (
            <DropdownMenuItem key={prompt.id} className="text-body-sm text-on-surface hover:bg-on-surface/[0.08] cursor-pointer">
              <span className="flex-1">{prompt.name}</span>
              <div className="flex gap-1">
                {prompt.labels?.slice(0, 1).map(lbl => (
                  <LabelBadge key={lbl} label={lbl} size="xs" />
                ))}
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Chevron button for expand/collapse
const ChevronButton = ({ icon: Icon, onClick, tooltipText }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={onClick}
        className="w-5 h-5 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08] hover:text-on-surface transition-colors"
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="text-[10px]">{tooltipText}</TooltipContent>
  </Tooltip>
);

/**
 * ResizablePromptArea - Text field with dual resize methods:
 * 1. Drag handle (bottom-right corner via CSS resize)
 * 2. Chevron buttons to jump between collapsed/min/full states
 */
const ResizablePromptArea = ({ 
  label, 
  value, 
  placeholder, 
  onLibraryPick, 
  onChange,
  defaultHeight = MIN_HEIGHT 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [expandState, setExpandState] = useState('min'); // 'collapsed' | 'min' | 'full'
  const [manualHeight, setManualHeight] = useState(null);
  const textareaRef = useRef(null);
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(defaultHeight);

  // Sync editValue when value prop changes
  useEffect(() => {
    setEditValue(value || '');
  }, [value]);

  // Measure content height for 'full' state
  useEffect(() => {
    if (textareaRef.current && isEditing) {
      const scrollHeight = textareaRef.current.scrollHeight;
      setContentHeight(Math.max(defaultHeight, scrollHeight));
    } else if (contentRef.current && !isEditing) {
      const scrollHeight = contentRef.current.scrollHeight;
      setContentHeight(Math.max(defaultHeight, scrollHeight));
    }
  }, [editValue, value, isEditing, defaultHeight]);

  const handleInsertVariable = (variable) => {
    const insertion = `{{${variable}}}`;
    setEditValue(prev => prev + insertion);
  };

  const handleDoneEditing = () => {
    setIsEditing(false);
    if (onChange && editValue !== value) {
      onChange(editValue);
    }
  };

  // State transitions
  const goToCollapsed = () => {
    setExpandState('collapsed');
    setManualHeight(null);
  };

  const goToMin = () => {
    setExpandState('min');
    setManualHeight(null);
  };

  const goToFull = () => {
    setExpandState('full');
    setManualHeight(null);
  };

  // Get height based on state (manual drag overrides chevron state)
  const getHeight = () => {
    if (manualHeight !== null) {
      return manualHeight;
    }
    switch (expandState) {
      case 'collapsed':
        return COLLAPSED_HEIGHT;
      case 'min':
        return MIN_HEIGHT;
      case 'full':
        return contentHeight;
      default:
        return MIN_HEIGHT;
    }
  };

  // Handle resize via drag (detect when user manually resizes)
  const handleResize = (e) => {
    if (textareaRef.current) {
      const newHeight = textareaRef.current.offsetHeight;
      if (newHeight !== getHeight()) {
        setManualHeight(newHeight);
      }
    }
  };

  const isCollapsed = expandState === 'collapsed' && manualHeight === null;
  const currentHeight = getHeight();

  return (
    <div className="space-y-1.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* Chevron controls - left side */}
          {expandState === 'collapsed' && manualHeight === null && (
            <>
              <ChevronButton icon={ChevronDown} onClick={goToMin} tooltipText="Expand to minimum" />
              <ChevronButton icon={ChevronsDown} onClick={goToFull} tooltipText="Expand to full" />
            </>
          )}
          {expandState === 'min' && manualHeight === null && (
            <>
              <ChevronButton icon={ChevronUp} onClick={goToCollapsed} tooltipText="Collapse" />
              <ChevronButton icon={ChevronsDown} onClick={goToFull} tooltipText="Expand to full" />
            </>
          )}
          {expandState === 'full' && manualHeight === null && (
            <>
              <ChevronButton icon={ChevronUp} onClick={goToMin} tooltipText="Reduce to minimum" />
              <ChevronButton icon={ChevronsUp} onClick={goToCollapsed} tooltipText="Collapse" />
            </>
          )}
          {/* When manually resized, show reset controls */}
          {manualHeight !== null && (
            <>
              <ChevronButton icon={ChevronsUp} onClick={goToCollapsed} tooltipText="Collapse" />
              <ChevronButton icon={ChevronUp} onClick={goToMin} tooltipText="Reset to minimum" />
              <ChevronButton icon={ChevronsDown} onClick={goToFull} tooltipText="Expand to full" />
            </>
          )}
          <label className="text-[10px] text-on-surface-variant uppercase tracking-wider ml-1">{label}</label>
        </div>
        
        {/* Actions - right side */}
        <div className="flex items-center gap-1">
          <VariablePickerDropdown onInsert={handleInsertVariable} />
          {onLibraryPick && <LibraryPickerDropdown />}
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => isEditing ? handleDoneEditing() : setIsEditing(true)}
                className={`w-6 h-6 flex items-center justify-center rounded-sm transition-colors ${
                  isEditing ? "text-primary" : "text-on-surface-variant hover:bg-on-surface/[0.08]"
                }`}
              >
                {isEditing ? <Check className="h-3.5 w-3.5" /> : <Edit3 className="h-3.5 w-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">{isEditing ? "Done Editing" : "Edit"}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Content area */}
      {!isCollapsed && (
        <>
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onMouseUp={handleResize}
              placeholder={placeholder}
              style={{ height: `${currentHeight}px` }}
              className="w-full p-2.5 bg-surface-container rounded-m3-md border border-primary text-body-sm text-on-surface leading-relaxed focus:outline-none resize font-mono overflow-auto"
            />
          ) : (
            <div 
              ref={contentRef}
              style={{ height: `${currentHeight}px` }}
              className="p-2.5 bg-surface-container rounded-m3-md border border-outline-variant text-body-sm text-on-surface leading-relaxed whitespace-pre-wrap overflow-auto resize"
              onMouseUp={handleResize}
            >
              {value ? <HighlightedText text={value} /> : <span className="text-on-surface-variant opacity-50">{placeholder}</span>}
            </div>
          )}

          {/* Bottom chevron controls */}
          <div className="flex items-center gap-1 pt-1">
            {expandState === 'full' && manualHeight === null && (
              <>
                <ChevronButton icon={ChevronUp} onClick={goToMin} tooltipText="Reduce to minimum" />
                <ChevronButton icon={ChevronsUp} onClick={goToCollapsed} tooltipText="Collapse" />
              </>
            )}
            {expandState === 'min' && manualHeight === null && (
              <ChevronButton icon={ChevronsDown} onClick={goToFull} tooltipText="Expand to full" />
            )}
            {manualHeight !== null && (
              <>
                <ChevronButton icon={ChevronsUp} onClick={goToCollapsed} tooltipText="Collapse" />
                <ChevronButton icon={ChevronUp} onClick={goToMin} tooltipText="Reset to minimum" />
                <ChevronButton icon={ChevronsDown} onClick={goToFull} tooltipText="Expand to full" />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ResizablePromptArea;
