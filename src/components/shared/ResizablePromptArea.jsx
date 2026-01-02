import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";

// Ref to track when we're in the middle of a save operation
import { 
  ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, 
  Library, Search, Play, Loader2, Copy, Undo2, XCircle
} from "lucide-react";
import HighlightedTextarea from "@/components/ui/highlighted-textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/sonner";
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
import { useFieldUndo } from "@/hooks/useFieldUndo";

const MIN_HEIGHT = 100;
const COLLAPSED_HEIGHT = 0;
const AUTOSAVE_DELAY = 500;

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
                  <code className="font-mono text-tree">{v.name}</code>
                </button>
              ))}
            </div>
          ))}
          {/* User Variables */}
          {allVariables.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-compact text-on-surface-variant uppercase tracking-wider bg-surface-container-low">
                User Variables
              </div>
              {allVariables.map(v => (
                <button
                  key={v.name}
                  onClick={() => handleSelect(v.name)}
                  className={`w-full flex items-center px-3 py-1.5 text-body-sm hover:bg-on-surface/[0.08] ${v.name === varName ? 'text-primary' : 'text-on-surface'}`}
                >
                  <code className="font-mono text-tree">{v.name}</code>
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
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
            <p className="text-tree text-on-surface-variant py-2 px-2 text-center">
              {libraryItems.length === 0 ? "No library items" : "No matches"}
            </p>
          ) : (
            filteredPrompts.map(prompt => (
              <DropdownMenuItem key={prompt.row_id || prompt.id} className="text-tree text-on-surface hover:bg-on-surface/[0.08] cursor-pointer">
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
 * ResizablePromptArea - Text field with auto-save after 500ms of inactivity
 * 
 * Features:
 * - Click to edit immediately (no edit mode toggle)
 * - Auto-save 500ms after typing stops
 * - Undo to previous saved version (Cmd+Z)
 * - Discard to return to original value
 */
const ResizablePromptArea = ({ 
  label, 
  value, 
  placeholder, 
  onLibraryPick, 
  onChange,
  onSave,
  onPlay,
  isPlaying = false,
  defaultHeight = MIN_HEIGHT,
  variables = [],
  promptReferences = [],
  libraryItems = [],
  storageKey,
  readOnly = false
}) => {
  const persistKey = storageKey || (label ? `qonsol-prompt-height-${label.toLowerCase().replace(/\s+/g, '-')}` : null);
  
  const [editValue, setEditValue] = useState(value || '');
  const [lastSavedValue, setLastSavedValue] = useState(value || '');
  const [expandState, setExpandState] = useState(() => {
    if (persistKey) {
      try {
        const saved = localStorage.getItem(persistKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.expandState || 'min';
        }
      } catch {}
    }
    return 'min';
  });
  const [manualHeight, setManualHeight] = useState(() => {
    if (persistKey) {
      try {
        const saved = localStorage.getItem(persistKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.manualHeight || null;
        }
      } catch {}
    }
    return null;
  });
  
  const textareaRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const isSavingRef = useRef(false);
  const [contentHeight, setContentHeight] = useState(defaultHeight);
  const [cursorPosition, setCursorPosition] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  
  // Field undo/discard management
  const {
    pushPreviousValue,
    popPreviousValue,
    getOriginalValue,
    hasPreviousValue,
    hasChangedFromOriginal,
    clearUndoStack,
  } = useFieldUndo(value);
  
  // Check if there are unsaved changes
  const hasUnsavedChanges = editValue !== lastSavedValue;
  const canDiscard = hasChangedFromOriginal(editValue);
  
  // Persist sizing to localStorage
  useEffect(() => {
    if (persistKey) {
      localStorage.setItem(persistKey, JSON.stringify({ expandState, manualHeight }));
    }
  }, [persistKey, expandState, manualHeight]);

  // Transform user variables for the picker
  const transformedUserVars = useMemo(() => {
    return variables.map(v => ({
      name: v.variable_name || v.name,
      type: v.type || "text",
      value: v.variable_value || v.value || v.default_value
    }));
  }, [variables]);

  // Sync editValue when value prop changes externally
  // Only sync if we're not in the middle of saving (prevents race condition)
  // and if the incoming value differs from what we last saved
  useEffect(() => {
    if (!isSavingRef.current && value !== lastSavedValue) {
      setEditValue(value || '');
      setLastSavedValue(value || '');
    }
  }, [value, lastSavedValue]);

  // Measure content height for 'full' state
  useEffect(() => {
    if (textareaRef.current) {
      const scrollHeight = textareaRef.current.scrollHeight;
      setContentHeight(Math.max(defaultHeight, scrollHeight));
    }
  }, [editValue, defaultHeight]);

  // Perform the actual save
  const performSave = useCallback((valueToSave) => {
    if (valueToSave === lastSavedValue) return;
    
    // Set saving flag to prevent race condition with useEffect
    isSavingRef.current = true;
    
    // Push current saved value to undo stack before saving new one
    pushPreviousValue(lastSavedValue);
    
    if (onSave) {
      onSave(valueToSave);
    } else if (onChange) {
      onChange(valueToSave);
    }
    setLastSavedValue(valueToSave);
    
    // Reset flag after a tick to allow prop updates to complete
    setTimeout(() => {
      isSavingRef.current = false;
    }, 0);
  }, [lastSavedValue, onSave, onChange, pushPreviousValue]);

  // Cancel any pending save timeout
  const cancelPendingSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

  // Immediate save (for blur, Cmd+S)
  const handleImmediateSave = useCallback(() => {
    cancelPendingSave();
    if (hasUnsavedChanges) {
      performSave(editValue);
    }
  }, [cancelPendingSave, hasUnsavedChanges, editValue, performSave]);

  // Handle undo - restore previous saved value
  const handleUndo = useCallback(() => {
    const previousValue = popPreviousValue();
    if (previousValue !== null) {
      cancelPendingSave();
      setEditValue(previousValue);
      if (onSave) {
        onSave(previousValue);
      } else if (onChange) {
        onChange(previousValue);
      }
      setLastSavedValue(previousValue);
      toast.success('Undone');
    }
  }, [popPreviousValue, cancelPendingSave, onSave, onChange]);

  // Handle discard - restore to original value
  const handleDiscard = useCallback(() => {
    const originalValue = getOriginalValue() || '';
    cancelPendingSave();
    setEditValue(originalValue);
    if (onSave) {
      onSave(originalValue);
    } else if (onChange) {
      onChange(originalValue);
    }
    setLastSavedValue(originalValue);
    clearUndoStack();
    toast.success('Discarded changes');
  }, [getOriginalValue, cancelPendingSave, onSave, onChange, clearUndoStack]);

  // Keyboard shortcuts (field-scoped)
  const handleKeyDown = useCallback((e) => {
    // Cmd+S - immediate save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      e.stopImmediatePropagation();
      handleImmediateSave();
    }
    // Cmd+Z - undo (only when not Shift for redo)
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      handleUndo();
    }
  }, [handleImmediateSave, handleUndo]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Helper to get selection range from contenteditable
  const getSelectionFromEditor = useCallback(() => {
    const editor = textareaRef.current;
    if (!editor) return { start: editValue.length, end: editValue.length };
    
    const selection = window.getSelection();
    if (!selection.rangeCount) return { start: editValue.length, end: editValue.length };
    
    const range = selection.getRangeAt(0);
    
    const preCaretRangeStart = range.cloneRange();
    preCaretRangeStart.selectNodeContents(editor);
    preCaretRangeStart.setEnd(range.startContainer, range.startOffset);
    const tempDivStart = document.createElement('div');
    tempDivStart.appendChild(preCaretRangeStart.cloneContents());
    tempDivStart.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    const start = tempDivStart.textContent?.length || 0;
    
    const preCaretRangeEnd = range.cloneRange();
    preCaretRangeEnd.selectNodeContents(editor);
    preCaretRangeEnd.setEnd(range.endContainer, range.endOffset);
    const tempDivEnd = document.createElement('div');
    tempDivEnd.appendChild(preCaretRangeEnd.cloneContents());
    tempDivEnd.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    const end = tempDivEnd.textContent?.length || 0;
    
    return { start, end };
  }, [editValue.length]);

  // Handle textarea change with auto-save debounce
  const handleTextareaChange = (e) => {
    const newValue = e.target.value;
    setEditValue(newValue);
    
    if (e.target.selectionStart !== undefined) {
      setCursorPosition(e.target.selectionStart);
    }
    
    // Cancel existing timer
    cancelPendingSave();
    
    // Start new auto-save timer
    saveTimeoutRef.current = setTimeout(() => {
      if (newValue !== lastSavedValue) {
        performSave(newValue);
      }
    }, AUTOSAVE_DELAY);
  };

  const handleTextareaSelect = useCallback(() => {
    const { start, end } = getSelectionFromEditor();
    setCursorPosition(start);
    setSelectionEnd(end);
  }, [getSelectionFromEditor]);

  const handleTextareaClick = useCallback(() => {
    setTimeout(() => {
      const { start, end } = getSelectionFromEditor();
      setCursorPosition(start);
      setSelectionEnd(end);
    }, 0);
  }, [getSelectionFromEditor]);

  const handleTextareaKeyUp = useCallback(() => {
    const { start, end } = getSelectionFromEditor();
    setCursorPosition(start);
    setSelectionEnd(end);
  }, [getSelectionFromEditor]);

  const handleInsertVariable = useCallback((variableText) => {
    const insertion = variableText.startsWith('{{') ? variableText : `{{${variableText}}}`;
    
    let insertStart = cursorPosition;
    let insertEnd = selectionEnd;
    
    if (insertStart === null && textareaRef.current) {
      const selection = getSelectionFromEditor();
      insertStart = selection.start;
      insertEnd = selection.end;
    }
    
    if (insertStart === null) {
      insertStart = editValue.length;
      insertEnd = editValue.length;
    }
    
    if (insertEnd === null || insertEnd < insertStart) {
      insertEnd = insertStart;
    }
    
    const newValue = editValue.slice(0, insertStart) + insertion + editValue.slice(insertEnd);
    setEditValue(newValue);
    
    const newCursorPos = insertStart + insertion.length;
    setCursorPosition(newCursorPos);
    setSelectionEnd(newCursorPos);
    
    // Trigger auto-save
    cancelPendingSave();
    saveTimeoutRef.current = setTimeout(() => {
      if (newValue !== lastSavedValue) {
        performSave(newValue);
      }
    }, AUTOSAVE_DELAY);
  }, [cursorPosition, selectionEnd, editValue, getSelectionFromEditor, cancelPendingSave, lastSavedValue, performSave]);

  // Handle replacing a variable in the text
  const handleReplaceVariable = useCallback((start, end, newText) => {
    const newValue = editValue.slice(0, start) + newText + editValue.slice(end);
    setEditValue(newValue);
    
    // Trigger auto-save
    cancelPendingSave();
    saveTimeoutRef.current = setTimeout(() => {
      if (newValue !== lastSavedValue) {
        performSave(newValue);
      }
    }, AUTOSAVE_DELAY);
  }, [editValue, cancelPendingSave, lastSavedValue, performSave]);

  // Handle blur - save immediately if changes exist
  const handleBlur = useCallback((e) => {
    const relatedTarget = e.relatedTarget;
    if (relatedTarget && e.currentTarget.contains(relatedTarget)) {
      return;
    }
    
    handleImmediateSave();
  }, [handleImmediateSave]);

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

  // Get height based on state
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

  // Handle resize via drag
  const handleResize = () => {
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
    <div className="space-y-1.5" onBlur={handleBlur}>
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
          {manualHeight !== null && (
            <>
              <ChevronButton icon={ChevronsUp} onClick={goToCollapsed} tooltipText="Collapse" />
              <ChevronButton icon={ChevronUp} onClick={goToMin} tooltipText="Reset to minimum" />
              <ChevronButton icon={ChevronsDown} onClick={goToFull} tooltipText="Expand to full" />
            </>
          )}
          <label className="text-[10px] text-on-surface-variant uppercase tracking-wider ml-1">{label}</label>
          {/* Unsaved changes indicator */}
          {hasUnsavedChanges && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </div>
        
        {/* Actions - right side */}
        <div className="flex items-center gap-1">
          {/* Undo button - only show when there's history */}
          {hasPreviousValue && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={handleUndo}
                  className="w-6 h-6 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Undo (⌘Z)</TooltipContent>
            </Tooltip>
          )}
          {/* Discard button - only show when changed from original */}
          {canDiscard && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={handleDiscard}
                  className="w-6 h-6 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]"
                >
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Discard all changes</TooltipContent>
            </Tooltip>
          )}
          <VariablePicker onInsert={handleInsertVariable} userVariables={variables} promptReferences={promptReferences} />
          {onLibraryPick && <LibraryPickerDropdown libraryItems={libraryItems} />}
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={async () => {
                  if (editValue) {
                    await navigator.clipboard.writeText(editValue);
                    toast.success('Copied to clipboard');
                  }
                }}
                className="w-6 h-6 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Copy</TooltipContent>
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

      {/* Content area - always editable (no view/edit mode toggle) */}
      {!isCollapsed && (
        <>
          <HighlightedTextarea
            ref={textareaRef}
            value={editValue}
            onChange={handleTextareaChange}
            onSelect={handleTextareaSelect}
            onClick={handleTextareaClick}
            onKeyUp={handleTextareaKeyUp}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            userVariables={transformedUserVars}
            readOnly={readOnly}
            style={{ height: `${currentHeight}px` }}
            className={`w-full p-2.5 bg-surface-container rounded-m3-md text-body-sm text-on-surface leading-relaxed focus:outline-none resize-y overflow-auto transition-colors border ${
              hasUnsavedChanges ? 'border-primary' : 'border-outline-variant'
            }`}
          />

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
