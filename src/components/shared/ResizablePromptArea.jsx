import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { 
  ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, 
  Edit3, Check, Library, Search, Play, Loader2, ChevronRight
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LabelBadge } from "@/components/ui/label-badge";
import { VariablePicker } from "./VariablePicker";

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

// System variable groups for the variable picker
const SYSTEM_VARIABLE_GROUPS = [
  {
    id: "datetime",
    label: "Date & Time",
    variables: [
      { name: "current_date", label: "Current Date" },
      { name: "current_time", label: "Current Time" },
      { name: "current_datetime", label: "Current DateTime" },
      { name: "timestamp", label: "Unix Timestamp" },
    ]
  },
  {
    id: "user",
    label: "User",
    variables: [
      { name: "user_email", label: "User Email" },
      { name: "user_name", label: "User Name" },
      { name: "user_id", label: "User ID" },
    ]
  },
  {
    id: "prompt",
    label: "Prompt Context",
    variables: [
      { name: "prompt_name", label: "Prompt Name" },
      { name: "prompt_id", label: "Prompt ID" },
      { name: "parent_output", label: "Parent Output" },
      { name: "parent_name", label: "Parent Name" },
    ]
  },
];

// Clickable variable span with popover to change variable
const ClickableVariable = ({ varName, matchStart, matchEnd, allVariables = [], onReplace }) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (newVarName) => {
    onReplace(matchStart, matchEnd, `{{${newVarName}}}`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span 
          className="text-primary font-medium cursor-pointer bg-primary/10 px-0.5 rounded hover:bg-primary/20 transition-colors"
        >
          {`{{${varName}}}`}
        </span>
      </PopoverTrigger>
      <PopoverContent 
        className="w-56 p-0 bg-surface-container-high border-outline-variant" 
        align="start"
        side="bottom"
      >
        <div className="p-2 border-b border-outline-variant">
          <span className="text-label-sm text-on-surface-variant">Replace with:</span>
        </div>
        <div className="max-h-48 overflow-auto">
          {/* System Variables */}
          {SYSTEM_VARIABLE_GROUPS.map(group => (
            <div key={group.id}>
              <div className="px-3 py-1.5 text-[10px] text-on-surface-variant uppercase tracking-wider bg-surface-container-low">
                {group.label}
              </div>
              {group.variables.map(v => (
                <button
                  key={v.name}
                  onClick={() => handleSelect(v.name)}
                  className={`w-full flex items-center px-3 py-1.5 text-body-sm hover:bg-on-surface/[0.08] ${v.name === varName ? 'text-primary' : 'text-on-surface'}`}
                >
                  <code className="font-mono text-[11px]">{v.name}</code>
                </button>
              ))}
            </div>
          ))}
          {/* User Variables */}
          {allVariables.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] text-on-surface-variant uppercase tracking-wider bg-surface-container-low">
                User Variables
              </div>
              {allVariables.map(v => (
                <button
                  key={v.name}
                  onClick={() => handleSelect(v.name)}
                  className={`w-full flex items-center px-3 py-1.5 text-body-sm hover:bg-on-surface/[0.08] ${v.name === varName ? 'text-primary' : 'text-on-surface'}`}
                >
                  <code className="font-mono text-[11px]">{v.name}</code>
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Highlighted text component with clickable variables
const HighlightedText = ({ text, variableDefinitions = {}, allVariables = [], onReplaceVariable }) => {
  const allDefs = { ...VARIABLE_DEFINITIONS, ...variableDefinitions };
  const variablePattern = /\{\{(\w+(?:\.\w+)?)\}\}/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = variablePattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
    }
    
    const varName = match[1];
    const matchStart = match.index;
    const matchEnd = match.index + match[0].length;
    
    parts.push(
      <ClickableVariable
        key={`var-${match.index}`}
        varName={varName}
        matchStart={matchStart}
        matchEnd={matchEnd}
        allVariables={allVariables}
        onReplace={onReplaceVariable}
      />
    );
    
    lastIndex = matchEnd;
  }
  
  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }
  
  return <>{parts}</>;
};


// Library Picker Dropdown
const LibraryPickerDropdown = ({ libraryItems = [] }) => {
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredPrompts = useMemo(() => {
    if (libraryItems.length === 0) return [];
    return libraryItems.filter(prompt => 
      (prompt.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [libraryItems, searchQuery]);

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
          {filteredPrompts.length === 0 ? (
            <p className="text-[11px] text-on-surface-variant py-2 px-2 text-center">
              {libraryItems.length === 0 ? "No library items" : "No matches"}
            </p>
          ) : (
            filteredPrompts.map(prompt => (
              <DropdownMenuItem key={prompt.row_id || prompt.id} className="text-body-sm text-on-surface hover:bg-on-surface/[0.08] cursor-pointer">
                <span className="flex-1">{prompt.name}</span>
                {prompt.category && (
                  <LabelBadge label={prompt.category} size="xs" />
                )}
              </DropdownMenuItem>
            ))
          )}
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
  onPlay,
  isPlaying = false,
  defaultHeight = MIN_HEIGHT,
  variables = [],
  promptReferences = [],
  libraryItems = []
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [expandState, setExpandState] = useState('min'); // 'collapsed' | 'min' | 'full'
  const [manualHeight, setManualHeight] = useState(null);
  const textareaRef = useRef(null);
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(defaultHeight);
  const [cursorPosition, setCursorPosition] = useState(null);

  // Transform user variables for the picker
  const transformedUserVars = useMemo(() => {
    return variables.map(v => ({
      name: v.variable_name || v.name,
      type: v.type || "text",
      value: v.variable_value || v.value || v.default_value
    }));
  }, [variables]);

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

  // Track cursor position when textarea changes or user clicks/selects
  const handleTextareaChange = (e) => {
    setEditValue(e.target.value);
    setCursorPosition(e.target.selectionStart);
  };

  const handleTextareaSelect = (e) => {
    setCursorPosition(e.target.selectionStart);
  };

  const handleTextareaClick = (e) => {
    setCursorPosition(e.target.selectionStart);
  };

  const handleTextareaKeyUp = (e) => {
    setCursorPosition(e.target.selectionStart);
  };

  const handleInsertVariable = useCallback((variableText) => {
    // variableText may already include {{ }} from VariablePicker
    const insertion = variableText.startsWith('{{') ? variableText : `{{${variableText}}}`;
    
    // Insert at cursor position if available, otherwise at end
    const insertPos = cursorPosition !== null ? cursorPosition : editValue.length;
    const newValue = editValue.slice(0, insertPos) + insertion + editValue.slice(insertPos);
    setEditValue(newValue);
    
    // Update cursor position to after the inserted variable
    const newCursorPos = insertPos + insertion.length;
    setCursorPosition(newCursorPos);
    
    // If editing, focus textarea and set cursor
    if (textareaRef.current && isEditing) {
      setTimeout(() => {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  }, [cursorPosition, editValue, isEditing]);

  // Handle replacing a variable in the text (used by ClickableVariable)
  const handleReplaceVariable = useCallback((start, end, newText) => {
    const newValue = editValue.slice(0, start) + newText + editValue.slice(end);
    setEditValue(newValue);
    if (onChange) {
      onChange(newValue);
    }
  }, [editValue, onChange]);

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
          <VariablePicker onInsert={handleInsertVariable} userVariables={variables} promptReferences={promptReferences} />
          {onLibraryPick && <LibraryPickerDropdown libraryItems={libraryItems} />}
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
          {onPlay && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={onPlay}
                  disabled={isPlaying}
                  className={`w-6 h-6 flex items-center justify-center rounded-sm hover:bg-on-surface/[0.08] ${isPlaying ? 'text-primary' : 'text-on-surface-variant'}`}
                >
                  {isPlaying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">{isPlaying ? 'Running...' : 'Play'}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Content area */}
      {!isCollapsed && (
        <>
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={editValue}
              onChange={handleTextareaChange}
              onSelect={handleTextareaSelect}
              onClick={handleTextareaClick}
              onKeyUp={handleTextareaKeyUp}
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
              {editValue ? (
                <HighlightedText 
                  text={editValue} 
                  allVariables={transformedUserVars}
                  onReplaceVariable={handleReplaceVariable}
                />
              ) : (
                <span className="text-on-surface-variant opacity-50">{placeholder}</span>
              )}
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