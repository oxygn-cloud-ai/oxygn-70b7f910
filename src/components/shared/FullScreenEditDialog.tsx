// @ts-nocheck
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
import TiptapPromptEditor, { TiptapPromptEditorHandle } from '@/components/ui/tiptap-prompt-editor';
import VariablePicker from '@/components/VariablePicker';
import { useFieldUndo } from '@/hooks/useFieldUndo';
import { usePendingSaves } from '@/contexts/PendingSaveContext';

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
 * Uses TiptapPromptEditor for variable highlighting and autocomplete
 * Auto-save is handled by TiptapPromptEditor internally - no duplicate timers here
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
  
  const editorRef = useRef<TiptapPromptEditorHandle>(null);
  const isSavingRef = useRef(false);

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

  // Focus editor when dialog opens
  useEffect(() => {
    if (isOpen && editorRef.current) {
      setTimeout(() => {
        editorRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Transform user variables for the editor
  const transformedUserVars = React.useMemo(() => {
    return variables.map(v => ({
      name: v.variable_name || v.name || '',
      type: 'text',
      value: v.variable_value || v.value || v.default_value || '',
    }));
  }, [variables]);

  // Handle save from TiptapPromptEditor's internal auto-save
  const handleEditorSave = useCallback((valueToSave: string) => {
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

  // Immediate save (for Cmd+S)
  const handleImmediateSave = useCallback(() => {
    const currentValue = editorRef.current?.getEditor()?.getText({ blockSeparator: '\n' }) || editValue;
    if (currentValue !== lastSavedValue) {
      handleEditorSave(currentValue);
      toast.success('Saved');
    }
  }, [editValue, lastSavedValue, handleEditorSave]);

  // Handle undo (button only - Cmd+Z is native Tiptap undo)
  const handleUndo = useCallback(() => {
    const previousValue = popPreviousValue();
    if (previousValue !== null) {
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
  }, [popPreviousValue, onSave, onChange, registerSave]);

  // Handle discard
  const handleDiscard = useCallback(() => {
    const originalValue = getOriginalValue() || '';
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
  }, [getOriginalValue, onSave, onChange, clearUndoStack, registerSave]);

  // Handle editor change - just update local state, let editor handle auto-save
  const handleEditorChange = useCallback((newValue: string) => {
    setEditValue(newValue);
  }, []);

  // Insert variable via VariablePicker
  const handleInsertVariable = useCallback((variableText: string) => {
    editorRef.current?.insertVariable(variableText);
  }, []);

  // Keyboard shortcuts - Only Cmd+S and Escape, NOT Cmd+Z (let Tiptap handle it)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleImmediateSave();
    }
    // Note: Cmd+Z is NOT intercepted here - let Tiptap's History extension handle native undo
    if (e.key === 'Escape') {
      e.preventDefault();
      // Save on close
      const currentValue = editorRef.current?.getEditor()?.getText({ blockSeparator: '\n' }) || editValue;
      if (currentValue !== lastSavedValue) {
        handleEditorSave(currentValue);
      }
      onClose();
    }
  }, [handleImmediateSave, editValue, lastSavedValue, handleEditorSave, onClose]);

  // Save on close
  const handleClose = useCallback(() => {
    const currentValue = editorRef.current?.getEditor()?.getText({ blockSeparator: '\n' }) || editValue;
    if (currentValue !== lastSavedValue) {
      handleEditorSave(currentValue);
    }
    onClose();
  }, [editValue, lastSavedValue, handleEditorSave, onClose]);

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
                  <TooltipContent className="text-[10px]">Undo to previous save</TooltipContent>
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
          <div className="w-full h-full bg-surface-container-low border border-outline-variant rounded-m3-md p-4 overflow-auto">
            <TiptapPromptEditor
              ref={editorRef}
              value={editValue}
              onChange={handleEditorChange}
              onSave={handleEditorSave}
              placeholder={placeholder}
              readOnly={readOnly}
              userVariables={transformedUserVars}
              familyRootPromptRowId={familyRootPromptRowId}
              className="h-full min-h-full"
              minHeight={400}
            />
          </div>
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