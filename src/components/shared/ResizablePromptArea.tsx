import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";

import { 
  ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, 
  Library, Search, Play, Loader2, Copy, Undo2, XCircle, Maximize2
} from "lucide-react";
import FullScreenEditDialog from "./FullScreenEditDialog";
import TiptapPromptEditor, { TiptapPromptEditorHandle } from "@/components/ui/tiptap-prompt-editor";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LabelBadge } from "@/components/ui/label-badge";
import VariablePicker from "@/components/VariablePicker";
import { useFieldUndo } from "@/hooks/useFieldUndo";
import { usePendingSaves } from "@/contexts/PendingSaveContext";

const MIN_HEIGHT = 100;
const COLLAPSED_HEIGHT = 0;
const AUTOSAVE_DELAY = 500;

// Import system variables from config (single source of truth)
import { SYSTEM_VARIABLES } from '@/config/systemVariables';

// Library Picker Dropdown
const LibraryPickerDropdown = ({ libraryItems = [] }: { libraryItems: Array<{ row_id?: string; id?: string; name?: string; category?: string }> }) => {
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
const ChevronButton = ({ icon: Icon, onClick, tooltipText }: { icon: React.ElementType; onClick: () => void; tooltipText: string }) => (
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

interface ResizablePromptAreaProps {
  label: string;
  value: string;
  placeholder?: string;
  onLibraryPick?: () => void;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void | Promise<void>;
  onPlay?: () => void;
  isPlaying?: boolean;
  defaultHeight?: number;
  variables?: Array<{ variable_name?: string; name?: string; type?: string; variable_value?: string; value?: string; default_value?: string }>;
  promptReferences?: Array<unknown>;
  libraryItems?: Array<{ row_id?: string; id?: string; name?: string; category?: string }>;
  storageKey?: string;
  readOnly?: boolean;
  familyRootPromptRowId?: string | null;
}

/**
 * ResizablePromptArea - Text field with auto-save after 500ms of inactivity
 * 
 * Features:
 * - Click to edit immediately (no edit mode toggle)
 * - Auto-save 500ms after typing stops
 * - Undo to previous saved version
 * - Discard to return to original value
 * - Variable highlighting and autocomplete via Tiptap
 */
const ResizablePromptArea: React.FC<ResizablePromptAreaProps> = ({ 
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
  readOnly = false,
  familyRootPromptRowId = null,
}) => {
  const persistKey = storageKey || (label ? `qonsol-prompt-height-${label.toLowerCase().replace(/\s+/g, '-')}` : null);
  
  const [editValue, setEditValue] = useState(value || '');
  const [lastSavedValue, setLastSavedValue] = useState(value || '');
  const [expandState, setExpandState] = useState<'collapsed' | 'min' | 'full'>(() => {
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
  const [manualHeight, setManualHeight] = useState<number | null>(() => {
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
  
  const editorRef = useRef<TiptapPromptEditorHandle>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const [contentHeight, setContentHeight] = useState(defaultHeight);
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
  
  // Field undo/discard management - pass storageKey as entityId to preserve undo across saves
  const {
    pushPreviousValue,
    popPreviousValue,
    getOriginalValue,
    hasPreviousValue,
    hasChangedFromOriginal,
    clearUndoStack,
  } = useFieldUndo(value, storageKey);
  
  // Check if there are unsaved changes
  const hasUnsavedChanges = editValue !== lastSavedValue;
  const canDiscard = hasChangedFromOriginal(editValue);
  
  // Persist sizing to localStorage
  useEffect(() => {
    if (persistKey) {
      localStorage.setItem(persistKey, JSON.stringify({ expandState, manualHeight }));
    }
  }, [persistKey, expandState, manualHeight]);

  // Transform user variables for the editor
  const transformedUserVars = useMemo(() => {
    return variables.map(v => ({
      name: v.variable_name || v.name || '',
      type: v.type || "text",
      value: v.variable_value || v.value || v.default_value || ''
    }));
  }, [variables]);

  // Sync editValue when value prop changes externally
  useEffect(() => {
    if (!isSavingRef.current && value !== lastSavedValue) {
      setEditValue(value || '');
      setLastSavedValue(value || '');
    }
  }, [value, lastSavedValue]);

  // Access pending save registry
  const { registerSave } = usePendingSaves();

  // Perform the actual save
  const performSave = useCallback((valueToSave: string) => {
    if (valueToSave === lastSavedValue) return;
    
    isSavingRef.current = true;
    pushPreviousValue(lastSavedValue);
    
    if (onSave) {
      const savePromise = Promise.resolve(onSave(valueToSave));
      registerSave(savePromise);
    } else if (onChange) {
      onChange(valueToSave);
    }
    setLastSavedValue(valueToSave);
    
    setTimeout(() => {
      isSavingRef.current = false;
    }, 0);
  }, [lastSavedValue, onSave, onChange, pushPreviousValue, registerSave]);

  // Cancel any pending save timeout
  const cancelPendingSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

  // Immediate save
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
        const savePromise = Promise.resolve(onSave(previousValue));
        registerSave(savePromise);
      } else if (onChange) {
        onChange(previousValue);
      }
      setLastSavedValue(previousValue);
      toast.success('Undone');
    }
  }, [popPreviousValue, cancelPendingSave, onSave, onChange, registerSave]);

  // Handle discard - restore to original value
  const handleDiscard = useCallback(() => {
    const originalValue = getOriginalValue() || '';
    cancelPendingSave();
    setEditValue(originalValue);
    if (onSave) {
      const savePromise = Promise.resolve(onSave(originalValue));
      registerSave(savePromise);
    } else if (onChange) {
      onChange(originalValue);
    }
    setLastSavedValue(originalValue);
    clearUndoStack();
    toast.success('Discarded changes');
  }, [getOriginalValue, cancelPendingSave, onSave, onChange, clearUndoStack, registerSave]);

  // Keyboard shortcuts (field-scoped)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      e.stopPropagation();
      handleImmediateSave();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
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

  // Handle editor change
  const handleEditorChange = useCallback((newValue: string) => {
    setEditValue(newValue);
    
    cancelPendingSave();
    saveTimeoutRef.current = setTimeout(() => {
      if (newValue !== lastSavedValue) {
        performSave(newValue);
      }
    }, AUTOSAVE_DELAY);
  }, [cancelPendingSave, lastSavedValue, performSave]);

  // Handle variable insertion from VariablePicker
  const handleInsertVariable = useCallback((variableText: string) => {
    editorRef.current?.insertVariable(variableText);
  }, []);

  // Handle blur - save immediately if changes exist
  const handleBlur = useCallback((e: React.FocusEvent) => {
    const relatedTarget = e.relatedTarget as Node | null;
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

  const isCollapsed = expandState === 'collapsed' && manualHeight === null;
  const currentHeight = getHeight();

  return (
    <div className="space-y-1.5" onBlur={handleBlur} onKeyDown={handleKeyDown}>
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
          {hasUnsavedChanges && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </div>
        
        {/* Actions - right side */}
        <div className="flex items-center gap-1">
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
          <VariablePicker onInsert={handleInsertVariable} userVariables={transformedUserVars} promptReferences={promptReferences} familyRootPromptRowId={familyRootPromptRowId} />
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
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => setIsFullScreenOpen(true)}
                className="w-6 h-6 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Full screen</TooltipContent>
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
          <div
            className={`w-full p-2.5 bg-surface-container rounded-m3-md leading-relaxed overflow-auto transition-colors border ${
              hasUnsavedChanges ? 'border-primary' : 'border-outline-variant'
            }`}
            style={{ height: `${currentHeight}px`, resize: 'vertical' }}
          >
            <TiptapPromptEditor
              ref={editorRef}
              value={editValue}
              onChange={handleEditorChange}
              onSave={performSave}
              placeholder={placeholder}
              userVariables={transformedUserVars}
              familyRootPromptRowId={familyRootPromptRowId}
              readOnly={readOnly}
              minHeight={currentHeight - 20}
              className="h-full"
            />
          </div>

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
      
      {/* Full Screen Edit Dialog */}
      <FullScreenEditDialog
        isOpen={isFullScreenOpen}
        onClose={() => setIsFullScreenOpen(false)}
        label={label}
        value={editValue}
        onSave={onSave}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        variables={transformedUserVars}
        familyRootPromptRowId={familyRootPromptRowId}
        storageKey={storageKey}
      />
    </div>
  );
};

export default ResizablePromptArea;
