import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Copy, Undo2, XCircle, Save, Maximize2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/components/ui/sonner';
import HighlightedTextarea from '@/components/ui/highlighted-textarea';
import VariablePicker from '@/components/VariablePicker';
import { useFieldUndo } from '@/hooks/useFieldUndo';
import { usePendingSaves } from '@/contexts/PendingSaveContext';

const AUTOSAVE_DELAY = 500;

interface FullScreenEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  label: string;
  value: string;
  onSave?: (value: string) => void | Promise<void>;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  variables?: Array<{ name?: string; variable_name?: string; value?: string; variable_value?: string; default_value?: string }>;
  familyRootPromptRowId?: string | null;
  storageKey?: string;
}

/**
 * Full-screen modal for distraction-free editing
 * Preserves variable highlighting and autocomplete from HighlightedTextarea
 */
const FullScreenEditDialog: React.FC<FullScreenEditDialogProps> = ({
  isOpen,
  onClose,
  label,
  value,
  onSave,
  onChange,
  placeholder = 'Enter text...',
  readOnly = false,
  variables = [],
  familyRootPromptRowId = null,
  storageKey,
}) => {
  const [editValue, setEditValue] = useState(value || '');
  const [lastSavedValue, setLastSavedValue] = useState(value || '');
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const selectionRef = useRef<{ start: number | null; end: number | null }>({ start: null, end: null });

  // Field undo/discard management
  const {
    pushPreviousValue,
    popPreviousValue,
    getOriginalValue,
    hasPreviousValue,
    hasChangedFromOriginal,
    clearUndoStack,
  } = useFieldUndo(value, storageKey);

  const { registerSave } = usePendingSaves();

  const hasUnsavedChanges = editValue !== lastSavedValue;
  const canDiscard = hasChangedFromOriginal(editValue);

  // Sync value when dialog opens or value changes externally
  useEffect(() => {
    if (isOpen && !isSavingRef.current && value !== lastSavedValue) {
      setEditValue(value || '');
      setLastSavedValue(value || '');
    }
  }, [isOpen, value, lastSavedValue]);

  // Focus textarea when dialog opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Transform user variables for the picker
  const transformedUserVars = React.useMemo(() => {
    return variables.map(v => ({
      name: v.variable_name || v.name || '',
      type: 'text',
      value: v.variable_value || v.value || v.default_value || '',
    }));
  }, [variables]);

  // Cancel any pending save timeout
  const cancelPendingSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

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

  // Immediate save
  const handleImmediateSave = useCallback(() => {
    cancelPendingSave();
    if (hasUnsavedChanges) {
      performSave(editValue);
      toast.success('Saved');
    }
  }, [cancelPendingSave, hasUnsavedChanges, editValue, performSave]);

  // Handle undo
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

  // Handle discard
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

  // Handle textarea change with auto-save
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setEditValue(newValue);
    
    if (e.target.selectionStart !== undefined) {
      setCursorPosition(e.target.selectionStart);
    }
    
    cancelPendingSave();
    
    saveTimeoutRef.current = setTimeout(() => {
      if (newValue !== lastSavedValue) {
        performSave(newValue);
      }
    }, AUTOSAVE_DELAY);
  }, [cancelPendingSave, lastSavedValue, performSave]);

  // Capture cursor position
  const handleTextareaSelect = useCallback(() => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      setCursorPosition(start);
      setSelectionEnd(end);
      selectionRef.current = { start, end };
    }
  }, []);

  // Insert variable at cursor
  const handleInsertVariable = useCallback((variableText: string) => {
    const insertion = variableText.startsWith('{{') ? variableText : `{{${variableText}}}`;
    
    let insertStart: number, insertEnd: number;
    
    if (typeof selectionRef.current.start === 'number') {
      insertStart = selectionRef.current.start;
      insertEnd = selectionRef.current.end ?? insertStart;
    } else if (textareaRef.current && typeof textareaRef.current.selectionStart === 'number') {
      insertStart = textareaRef.current.selectionStart;
      insertEnd = textareaRef.current.selectionEnd ?? insertStart;
    } else if (cursorPosition !== null) {
      insertStart = cursorPosition;
      insertEnd = selectionEnd ?? insertStart;
    } else {
      insertStart = editValue.length;
      insertEnd = insertStart;
    }
    
    const before = editValue.substring(0, insertStart);
    const after = editValue.substring(insertEnd);
    const newValue = before + insertion + after;
    const newCursorPos = insertStart + insertion.length;
    
    setEditValue(newValue);
    setCursorPosition(newCursorPos);
    selectionRef.current = { start: newCursorPos, end: newCursorPos };
    
    cancelPendingSave();
    saveTimeoutRef.current = setTimeout(() => {
      if (newValue !== lastSavedValue) {
        performSave(newValue);
      }
    }, AUTOSAVE_DELAY);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = newCursorPos;
        textareaRef.current.selectionEnd = newCursorPos;
      }
    }, 0);
  }, [editValue, cursorPosition, selectionEnd, cancelPendingSave, lastSavedValue, performSave]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleImmediateSave();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleImmediateSave();
      onClose();
    }
  }, [handleImmediateSave, handleUndo, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Save on close
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      performSave(editValue);
    }
    onClose();
  }, [hasUnsavedChanges, performSave, editValue, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent 
        className="max-w-[90vw] w-[90vw] h-[90vh] max-h-[90vh] p-0 bg-surface border-outline-variant flex flex-col"
        hideCloseButton
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <DialogHeader className="h-14 shrink-0 flex flex-row items-center justify-between px-4 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <Maximize2 className="h-5 w-5 text-on-surface-variant" />
            <DialogTitle className="text-title-sm text-on-surface font-medium">
              {label}
            </DialogTitle>
            {hasUnsavedChanges && (
              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                Unsaved
              </span>
            )}
          </div>
          
          {/* Toolbar */}
          <div className="flex items-center gap-1">
            {!readOnly && (
              <>
                <VariablePicker 
                  onInsert={handleInsertVariable} 
                  userVariables={transformedUserVars}
                  familyRootPromptRowId={familyRootPromptRowId}
                  side="bottom"
                  align="end"
                />
                
                <div className="w-px h-4 bg-outline-variant mx-1" />
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleUndo}
                      disabled={!hasPreviousValue}
                      className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Undo2 className="h-4 w-4 text-on-surface-variant" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Undo (⌘Z)</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleDiscard}
                      disabled={!canDiscard}
                      className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <XCircle className="h-4 w-4 text-on-surface-variant" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Discard all changes</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleImmediateSave}
                      disabled={!hasUnsavedChanges}
                      className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Save className="h-4 w-4 text-on-surface-variant" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Save (⌘S)</TooltipContent>
                </Tooltip>
              </>
            )}
            
            <div className="w-px h-4 bg-outline-variant mx-1" />
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={async () => {
                    if (editValue) {
                      await navigator.clipboard.writeText(editValue);
                      toast.success('Copied to clipboard');
                    }
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
                >
                  <Copy className="h-4 w-4 text-on-surface-variant" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Copy</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
                >
                  <X className="h-4 w-4 text-on-surface-variant" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Close (Esc)</TooltipContent>
            </Tooltip>
          </div>
        </DialogHeader>
        
        {/* Editor */}
        <div className="flex-1 p-4 overflow-hidden">
          <HighlightedTextarea
            ref={textareaRef}
            value={editValue}
            onChange={handleTextareaChange}
            onSelect={handleTextareaSelect}
            onClick={handleTextareaSelect}
            onKeyUp={handleTextareaSelect}
            placeholder={placeholder}
            readOnly={readOnly}
            userVariables={transformedUserVars}
            rows={20}
            className="w-full h-full min-h-full resize-none bg-surface-container-low border-outline-variant"
            style={{ height: '100%' }}
          />
        </div>
        
        {/* Footer status */}
        <div className="h-8 shrink-0 flex items-center justify-between px-4 border-t border-outline-variant text-[10px] text-on-surface-variant">
          <span>{editValue.length} characters</span>
          <span>
            {hasUnsavedChanges ? 'Auto-saves after 500ms' : 'All changes saved'}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FullScreenEditDialog;
