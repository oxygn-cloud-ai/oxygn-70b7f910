import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Textarea } from "@/components/ui/textarea";
import HighlightedTextarea from "@/components/ui/highlighted-textarea";
import { Label } from "@/components/ui/label";
import { Undo2, XCircle, ClipboardCopy, Link2, Sparkles, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Info } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from '@/components/ui/sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import VariablePicker from './VariablePicker';
import { TOOLTIPS } from '@/config/labels';
import { useFieldUndo } from '@/hooks/useFieldUndo';

const AUTOSAVE_DELAY = 500;

const PromptField = ({ label, tooltip, value, onChange, onReset, onSave, onCascade, initialValue, onGenerate, isGenerating, formattedTime, isLinksPage, isReadOnly, hasUnsavedChanges: externalUnsavedChanges, promptId, variables = [], placeholder }) => {
  const textareaRef = useRef(null);
  const containerRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const isSavingRef = useRef(false);
  const selectionRef = useRef({ start: null, end: null });
  const [isLinking, setIsLinking] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(null);
  const [contentHeight, setContentHeight] = useState(100);
  const [editValue, setEditValue] = useState(value || '');
  const [lastSavedValue, setLastSavedValue] = useState(value || '');
  
  const storageKey = `promptField_expand_${promptId}_${label}`;
  
  // Field undo/discard management - pass promptId as entityId to preserve undo across saves
  const {
    pushPreviousValue,
    popPreviousValue,
    getOriginalValue,
    hasPreviousValue,
    hasChangedFromOriginal,
    clearUndoStack,
  } = useFieldUndo(value, promptId);
  
  // Check if there are unsaved changes
  const hasUnsavedChanges = editValue !== lastSavedValue;
  const canDiscard = hasChangedFromOriginal(editValue);
  
  // Default to collapsed for all fields
  const [expandState, setExpandState] = useState(() => {
    if (typeof window === 'undefined') return 'collapsed';
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && ['collapsed', 'min', 'full'].includes(stored)) {
        return stored;
      }
      return 'collapsed';
    } catch {
      return 'collapsed';
    }
  });
  
  const goToCollapsed = () => {
    setExpandState('collapsed');
    localStorage.setItem(storageKey, 'collapsed');
  };
  
  const goToMin = () => {
    setExpandState('min');
    localStorage.setItem(storageKey, 'min');
  };
  
  const goToFull = () => {
    setExpandState('full');
    localStorage.setItem(storageKey, 'full');
  };

  // Sync editValue when value prop changes externally
  // Only sync if we're not in the middle of saving (prevents race condition)
  useEffect(() => {
    if (!isSavingRef.current && value !== lastSavedValue) {
      setEditValue(value || '');
      setLastSavedValue(value || '');
    }
  }, [value, lastSavedValue]);

  // Calculate content height when in full mode
  useEffect(() => {
    if (expandState === 'full' && textareaRef.current) {
      const element = textareaRef.current;
      if (element.scrollHeight) {
        setContentHeight(Math.max(100, element.scrollHeight));
      }
    }
  }, [expandState, editValue]);

  useEffect(() => {
    if (textareaRef.current && (label === 'Admin Result' || label === 'User Result')) {
      adjustHeight();
    }

    const handleMessage = (event) => {
      console.log('Response received from parent window:', event.data);
    };
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [editValue, label]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editValue);
      toast.success('Copied to clipboard');
    } catch (err) {
      console.error('Failed to copy: ', err);
      toast.error('Failed to copy');
    }
  };

  // Cancel any pending save timeout
  const cancelPendingSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

  // Perform save
  const performSave = useCallback(async (valueToSave) => {
    if (valueToSave === lastSavedValue) return;
    
    // Push current saved value to undo stack before saving new one
    pushPreviousValue(lastSavedValue);
    
    const fieldKey = label.toLowerCase().replace(' ', '_');
    const sourceInfo = {
      [fieldKey]: {
        parts: [
          {
            type: "user_input",
            text: valueToSave,
            order: 1
          }
        ],
        metadata: {
          created_at: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          part_count: 1
        }
      }
    };

    // Set saving flag to prevent race condition with useEffect
    isSavingRef.current = true;
    
    try {
      await onSave(sourceInfo);
      setLastSavedValue(valueToSave);
      // Also update parent state
      onChange?.(valueToSave);
    } catch (err) {
      console.error('Failed to save: ', err);
      toast.error('Failed to save');
    } finally {
      // Reset flag after a tick to allow prop updates to complete
      setTimeout(() => {
        isSavingRef.current = false;
      }, 0);
    }
  }, [lastSavedValue, label, onSave, onChange, pushPreviousValue]);

  // Immediate save (for blur, Cmd+S)
  const handleImmediateSave = useCallback(() => {
    cancelPendingSave();
    if (hasUnsavedChanges) {
      performSave(editValue);
    }
  }, [cancelPendingSave, hasUnsavedChanges, editValue, performSave]);

  // Handle undo
  const handleUndo = useCallback(() => {
    const previousValue = popPreviousValue();
    if (previousValue !== null) {
      cancelPendingSave();
      setEditValue(previousValue);
      
      const fieldKey = label.toLowerCase().replace(' ', '_');
      const sourceInfo = {
        [fieldKey]: {
          parts: [{ type: "user_input", text: previousValue, order: 1 }],
          metadata: {
            created_at: new Date().toISOString(),
            last_updated: new Date().toISOString(),
            part_count: 1
          }
        }
      };
      
      onSave?.(sourceInfo);
      setLastSavedValue(previousValue);
      onChange?.(previousValue);
      toast.success('Undone');
    }
  }, [popPreviousValue, cancelPendingSave, label, onSave, onChange]);

  // Handle discard
  const handleDiscard = useCallback(() => {
    const originalValue = getOriginalValue() || '';
    cancelPendingSave();
    setEditValue(originalValue);
    
    const fieldKey = label.toLowerCase().replace(' ', '_');
    const sourceInfo = {
      [fieldKey]: {
        parts: [{ type: "user_input", text: originalValue, order: 1 }],
        metadata: {
          created_at: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          part_count: 1
        }
      }
    };
    
    onSave?.(sourceInfo);
    setLastSavedValue(originalValue);
    onChange?.(originalValue);
    clearUndoStack();
    toast.success('Discarded changes');
  }, [getOriginalValue, cancelPendingSave, label, onSave, onChange, clearUndoStack]);

  // Handle text change with auto-save debounce
  const handleTextChange = (newValue) => {
    setEditValue(newValue);
    
    // Cancel existing timer
    cancelPendingSave();
    
    // Start new auto-save timer
    saveTimeoutRef.current = setTimeout(() => {
      if (newValue !== lastSavedValue) {
        performSave(newValue);
      }
    }, AUTOSAVE_DELAY);
  };

  const handleInsertVariable = (varName) => {
    const varText = `{{${varName}}}`;
    const currentValue = editValue || '';
    
    // Priority: ref (synchronous) > textarea DOM > state > end of text
    let pos;
    if (typeof selectionRef.current.start === 'number') {
      pos = selectionRef.current.start;
    } else if (textareaRef.current && typeof textareaRef.current.selectionStart === 'number') {
      pos = textareaRef.current.selectionStart;
    } else if (typeof cursorPosition === 'number') {
      pos = cursorPosition;
    } else {
      pos = currentValue.length;
    }
    
    const newValue = currentValue.slice(0, pos) + varText + currentValue.slice(pos);
    handleTextChange(newValue);
    
    const newCursorPos = pos + varText.length;
    setCursorPosition(newCursorPos);
    selectionRef.current = { start: newCursorPos, end: newCursorPos };
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        if (typeof textareaRef.current.setSelectionRange === 'function') {
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }
    }, 0);
  };

  // Get cursor position from contenteditable or textarea
  const getCursorPositionFromElement = (element) => {
    if (element.selectionStart !== undefined) {
      return element.selectionStart;
    }
    
    const selection = window.getSelection();
    if (!selection.rangeCount) return 0;
    
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(preCaretRange.cloneContents());
    
    const brs = tempDiv.querySelectorAll('br');
    brs.forEach(br => br.replaceWith('\n'));
    
    return tempDiv.textContent?.length || 0;
  };

  const handleCursorChange = (e) => {
    const pos = getCursorPositionFromElement(e.target);
    setCursorPosition(pos);
    // Also store in ref synchronously for reliable access during variable insertion
    selectionRef.current = { 
      start: e.target.selectionStart ?? pos, 
      end: e.target.selectionEnd ?? pos 
    };
  };
  
  const handleBlur = () => {
    // Don't update cursor position on blur - browser clears selection
    // Cursor position was already captured by onClick/onSelect/onKeyUp handlers
    handleImmediateSave();
  };

  // Keyboard shortcuts (field-scoped)
  const handleKeyDown = useCallback((e) => {
    // Cmd+S - immediate save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      e.stopImmediatePropagation();
      handleImmediateSave();
    }
    // Cmd+Z - undo
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      handleUndo();
    }
  }, [handleImmediateSave, handleUndo]);

  const ActionButton = ({ icon, onClick, tooltip, disabled, active, needsAttention = false }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            disabled={disabled}
            className={`h-7 w-7 p-0 transition-colors ${
              needsAttention
                ? 'animate-attention-flash rounded-md'
                : active 
                  ? '!text-primary !bg-transparent hover:!bg-muted/50' 
                  : '!text-muted-foreground hover:!text-foreground hover:!bg-muted/50'
            } ${disabled ? 'opacity-40' : ''}`}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const ChevronButton = ({ icon: Icon, onClick, tooltipText }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            <Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const getTextareaStyle = () => {
    if (expandState === 'min') {
      return 'min-h-[100px] max-h-[100px] overflow-auto';
    }
    return 'min-h-[100px]';
  };

  const getFullHeightStyle = () => {
    if (expandState === 'full') {
      return { minHeight: `${Math.max(100, contentHeight)}px` };
    }
    return {};
  };

  return (
    <div 
      ref={containerRef}
      className={`
        rounded-lg border transition-all duration-200
        ${hasUnsavedChanges ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-1">
          {/* Dual chevron controls */}
          {expandState === 'collapsed' && (
            <>
              <ChevronButton 
                icon={ChevronDown} 
                onClick={goToMin} 
                tooltipText="Expand to minimum height" 
              />
              <ChevronButton 
                icon={ChevronsDown} 
                onClick={goToFull} 
                tooltipText="Expand to full height" 
              />
            </>
          )}
          {expandState === 'min' && (
            <>
              <ChevronButton 
                icon={ChevronUp} 
                onClick={goToCollapsed} 
                tooltipText="Collapse" 
              />
              <ChevronButton 
                icon={ChevronsDown} 
                onClick={goToFull} 
                tooltipText="Expand to full height" 
              />
            </>
          )}
          {expandState === 'full' && (
            <>
              <ChevronButton 
                icon={ChevronUp} 
                onClick={goToMin} 
                tooltipText="Reduce to minimum height" 
              />
              <ChevronButton 
                icon={ChevronsUp} 
                onClick={goToCollapsed} 
                tooltipText="Collapse" 
              />
            </>
          )}
          
          <Label htmlFor={label} className="text-sm font-medium text-foreground cursor-pointer ml-1">
            {label}
          </Label>
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {hasUnsavedChanges && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5">
          {(label === TOOLTIPS?.promptFields?.inputAdminPrompt?.label || label === TOOLTIPS?.promptFields?.inputUserPrompt?.label || label === 'Context Prompt' || label === 'User Message' || label === 'System Prompt') && !isLinksPage && (
            <div className="flex items-center mr-1">
              <ActionButton
                icon={<Sparkles className={`h-4 w-4 ${isGenerating ? 'animate-pulse' : ''}`} />}
                onClick={onGenerate}
                tooltip={isGenerating ? `Generating... ${formattedTime}` : 'Generate response'}
                disabled={isGenerating}
                active={isGenerating}
              />
              {isGenerating && (
                <span className="text-xs text-primary font-medium ml-1">{formattedTime}</span>
              )}
            </div>
          )}

          {/* Variable Picker for input prompts */}
          {(label === TOOLTIPS?.promptFields?.inputAdminPrompt?.label || label === TOOLTIPS?.promptFields?.inputUserPrompt?.label || label === 'Context Prompt' || label === 'User Message' || label === 'System Prompt') && !isReadOnly && (
            <VariablePicker 
              onInsert={handleInsertVariable}
              userVariables={variables}
            />
          )}

          <ActionButton
            icon={<Link2 className="h-4 w-4" />}
            onClick={() => onCascade(label)}
            tooltip="Cascade to children"
          />
          <ActionButton
            icon={<ClipboardCopy className="h-4 w-4" />}
            onClick={handleCopy}
            tooltip="Copy to clipboard"
          />
          
          {!isLinksPage && !isReadOnly && (
            <>
              {/* Undo button - only show when there's history */}
              {hasPreviousValue && (
                <ActionButton
                  icon={<Undo2 className="h-4 w-4" />}
                  onClick={handleUndo}
                  tooltip="Undo (⌘Z)"
                />
              )}
              {/* Discard button - only show when changed from original */}
              {canDiscard && (
                <ActionButton
                  icon={<XCircle className="h-4 w-4" />}
                  onClick={handleDiscard}
                  tooltip="Discard all changes"
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {expandState !== 'collapsed' && (
        <div className="p-3 pb-0">
          <div className="resizable-content">
            {(label === TOOLTIPS?.promptFields?.inputAdminPrompt?.label || label === TOOLTIPS?.promptFields?.inputUserPrompt?.label || label === 'Context Prompt' || label === 'User Message' || label === 'System Prompt') ? (
              <HighlightedTextarea
                id={label}
                value={editValue}
                onChange={(e) => {
                  if (!isReadOnly) {
                    handleTextChange(e.target.value);
                  }
                  handleCursorChange(e);
                }}
                onSelect={handleCursorChange}
                onClick={handleCursorChange}
                onKeyUp={handleCursorChange}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className={`w-full bg-background ${getTextareaStyle()}`}
                style={getFullHeightStyle()}
                rows={4}
                ref={textareaRef}
                readOnly={isReadOnly}
                placeholder={placeholder || undefined}
                userVariables={variables}
              />
            ) : (
              <Textarea
                id={label}
                value={editValue}
                onChange={(e) => {
                  if (!isReadOnly) {
                    handleTextChange(e.target.value);
                  }
                  if (label === TOOLTIPS?.promptFields?.adminResult?.label || label === TOOLTIPS?.promptFields?.userResult?.label || label === 'System Response' || label === 'AI Response') {
                    e.target.style.height = 'auto';
                  }
                  handleCursorChange(e);
                }}
                onSelect={handleCursorChange}
                onClick={handleCursorChange}
                onKeyUp={handleCursorChange}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className={`w-full border-border bg-background focus:ring-primary focus:border-primary ${getTextareaStyle()}`}
                style={getFullHeightStyle()}
                rows={4}
                ref={textareaRef}
                readOnly={isReadOnly}
                placeholder={placeholder || undefined}
              />
            )}
          </div>
          
          {/* Bottom controls - chevrons */}
          <div className="pt-2 pb-2 mt-2 border-t border-border/50">
            <div className="flex items-center">
              <div className="flex items-center gap-1">
                {expandState === 'full' && (
                  <>
                    <ChevronButton 
                      icon={ChevronUp} 
                      onClick={goToMin} 
                      tooltipText="Reduce to minimum height" 
                    />
                    <ChevronButton 
                      icon={ChevronsUp} 
                      onClick={goToCollapsed} 
                      tooltipText="Collapse" 
                    />
                  </>
                )}
                {expandState === 'min' && (
                  <>
                    <ChevronButton 
                      icon={ChevronsDown} 
                      onClick={goToFull} 
                      tooltipText="Expand to full height" 
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptField;
