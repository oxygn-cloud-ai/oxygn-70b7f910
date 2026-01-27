import React, { useEffect, useRef, useCallback, useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import History from '@tiptap/extension-history';
import Placeholder from '@tiptap/extension-placeholder';
import { VariableHighlight } from '@/components/shared/tiptap-variable-highlight';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  SYSTEM_VARIABLES, 
  SYSTEM_VARIABLE_TYPES,
  getSystemVariableNames 
} from '@/config/systemVariables';
import { usePromptNameLookup } from '@/hooks/usePromptNameLookup';

const AUTOSAVE_DELAY = 500;

// Field labels for friendly display
const FIELD_LABELS: Record<string, string> = {
  output_response: 'AI Response',
  user_prompt_result: 'User Result',
  input_admin_prompt: 'System Prompt',
  input_user_prompt: 'User Prompt',
  prompt_name: 'Name',
};

// Variable type labels
const VARIABLE_TYPE_LABELS: Record<string, string> = {
  [SYSTEM_VARIABLE_TYPES.STATIC]: 'Auto-filled',
  [SYSTEM_VARIABLE_TYPES.USER_EDITABLE]: 'Editable',
  [SYSTEM_VARIABLE_TYPES.INPUT]: 'User Input',
  [SYSTEM_VARIABLE_TYPES.SELECT]: 'Selection',
  [SYSTEM_VARIABLE_TYPES.RUNTIME]: 'Runtime',
};

/**
 * Represents a variable available in the autocomplete dropdown
 */
interface AutocompleteVariable {
  name: string;
  label: string;
  description: string;
  type: string;
  isSystem: boolean;
  isStatic: boolean;
  isRuntime: boolean;
  value?: string;
}

/**
 * User variable input format
 */
interface UserVariableInput {
  name: string;
  description?: string;
  value?: string;
}

/**
 * Props for TiptapPromptEditor component
 */
export interface TiptapPromptEditorProps {
  value: string;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void | Promise<void>;
  placeholder?: string;
  readOnly?: boolean;
  userVariables?: Array<string | UserVariableInput>;
  familyRootPromptRowId?: string | null;
  className?: string;
  minHeight?: number;
  style?: React.CSSProperties;
}

/**
 * Imperative handle for parent component access
 */
export interface TiptapPromptEditorHandle {
  insertVariable: (varName: string) => void;
  focus: () => void;
  getEditor: () => Editor | null;
}

/**
 * TiptapPromptEditor - Plain text editor with variable highlighting
 * 
 * Features:
 * - Single-layer editing (no overlay pattern)
 * - Variable highlighting for {{...}} patterns
 * - Autocomplete when typing {{
 * - Auto-save after 500ms of inactivity
 * - Cursor protection against resizable panel interference
 */
const TiptapPromptEditor = forwardRef<TiptapPromptEditorHandle, TiptapPromptEditorProps>(({
  value = '',
  onChange,
  onSave,
  placeholder = 'Enter text...',
  readOnly = false,
  userVariables = [],
  familyRootPromptRowId = null,
  className,
  minHeight = 80,
  style,
}, ref) => {
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [triggerStart, setTriggerStart] = useState(-1);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef(value);
  const isExternalUpdate = useRef(false);

  // Lookup prompt names for q.ref[UUID] patterns
  const { nameMap: promptNameMap } = usePromptNameLookup(value);

  // Build list of all available variables
  const allVariables = useMemo<AutocompleteVariable[]>(() => {
    const systemVars = getSystemVariableNames().map((name): AutocompleteVariable => ({
      name,
      label: SYSTEM_VARIABLES[name]?.label || name,
      description: SYSTEM_VARIABLES[name]?.description || '',
      type: VARIABLE_TYPE_LABELS[SYSTEM_VARIABLES[name]?.type] || 'System',
      isSystem: true,
      isStatic: SYSTEM_VARIABLES[name]?.type === SYSTEM_VARIABLE_TYPES.STATIC,
      isRuntime: SYSTEM_VARIABLES[name]?.type === SYSTEM_VARIABLE_TYPES.RUNTIME,
    }));
    
    const userVars = (userVariables || []).map((v): AutocompleteVariable => ({
      name: typeof v === 'string' ? v : v.name,
      label: typeof v === 'string' ? v : v.name,
      description: typeof v === 'string' ? '' : (v.description || ''),
      type: 'User Variable',
      isSystem: false,
      isStatic: false,
      isRuntime: false,
      value: typeof v === 'string' ? '' : (v.value || ''),
    }));
    
    return [...systemVars, ...userVars];
  }, [userVariables]);

  // Filter variables based on query
  const filteredVariables = useMemo<AutocompleteVariable[]>(() => {
    if (!autocompleteQuery) return allVariables;
    const query = autocompleteQuery.toLowerCase();
    return allVariables.filter(v => 
      v.name.toLowerCase().includes(query) || v.label.toLowerCase().includes(query)
    );
  }, [allVariables, autocompleteQuery]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredVariables.length]);

  // Cancel pending save
  const cancelPendingSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

  // Perform save
  const performSave = useCallback((valueToSave: string) => {
    if (valueToSave === lastSavedValueRef.current) return;
    
    lastSavedValueRef.current = valueToSave;
    onSave?.(valueToSave);
  }, [onSave]);

  // Check for autocomplete trigger
  const checkForTrigger = useCallback((text: string, cursorPos: number): void => {
    const textBefore = text.substring(0, cursorPos);
    const lastOpenBrace = textBefore.lastIndexOf('{{');
    
    if (lastOpenBrace === -1) {
      setShowAutocomplete(false);
      return;
    }
    
    // Check if there's a closing }} between the {{ and cursor
    const textBetween = textBefore.substring(lastOpenBrace + 2);
    if (textBetween.includes('}}')) {
      setShowAutocomplete(false);
      return;
    }
    
    // We're inside {{ ... 
    setTriggerStart(lastOpenBrace);
    setAutocompleteQuery(textBetween);
    setShowAutocomplete(true);
  }, []);

  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      History,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      VariableHighlight,
    ],
    content: value ? `<p>${value.replace(/\n/g, '</p><p>')}</p>`.replace('<p></p>', '') : '',
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      if (readOnly || isExternalUpdate.current) return;
      
      // Extract plain text with single newlines
      const plainText = editor.getText({ blockSeparator: '\n' });
      
      onChange?.(plainText);
      
      // Check for autocomplete trigger
      const { from } = editor.state.selection;
      checkForTrigger(plainText, from);
      
      // Cancel existing timer and start new auto-save timer
      cancelPendingSave();
      saveTimeoutRef.current = setTimeout(() => {
        if (plainText !== lastSavedValueRef.current) {
          performSave(plainText);
        }
      }, AUTOSAVE_DELAY);
    },
    onBlur: () => {
      // Auto-save on blur
      cancelPendingSave();
      const plainText = editor?.getText({ blockSeparator: '\n' }) || '';
      if (plainText !== lastSavedValueRef.current) {
        performSave(plainText);
      }
      // Delay hiding to allow click on autocomplete items
      setTimeout(() => {
        setShowAutocomplete(false);
      }, 150);
    },
    editorProps: {
      attributes: {
        class: 'font-poppins text-body-sm text-on-surface outline-none prose-none',
        'data-testid': 'tiptap-prompt-editor',
      },
      handleKeyDown: (view, event) => {
        // Handle autocomplete navigation
        if (showAutocomplete) {
          switch (event.key) {
            case 'ArrowDown':
              event.preventDefault();
              setSelectedIndex(prev => Math.min(prev + 1, filteredVariables.length - 1));
              return true;
            case 'ArrowUp':
              event.preventDefault();
              setSelectedIndex(prev => Math.max(prev - 1, 0));
              return true;
            case 'Enter':
            case 'Tab':
              if (filteredVariables.length > 0) {
                event.preventDefault();
                insertVariableAtTrigger(filteredVariables[selectedIndex]);
                return true;
              }
              break;
            case 'Escape':
              event.preventDefault();
              setShowAutocomplete(false);
              return true;
          }
        }
        return false;
      },
    },
  });

  // Insert variable at trigger position
  const insertVariableAtTrigger = useCallback((variable: AutocompleteVariable) => {
    if (!editor || triggerStart === -1) return;
    
    const varText = `{{${variable.name}}}`;
    const currentText = editor.getText({ blockSeparator: '\n' });
    const cursorPos = editor.state.selection.from;
    
    // Calculate positions in the plain text
    const beforeTrigger = currentText.substring(0, triggerStart);
    const afterCursor = currentText.substring(cursorPos);
    const newValue = beforeTrigger + varText + afterCursor;
    
    // Set content and move cursor
    isExternalUpdate.current = true;
    editor.commands.setContent(newValue ? `<p>${newValue.replace(/\n/g, '</p><p>')}</p>`.replace('<p></p>', '') : '');
    isExternalUpdate.current = false;
    
    // Move cursor to end of inserted variable
    const newCursorPos = triggerStart + varText.length;
    setTimeout(() => {
      editor.commands.focus();
      // Position cursor at end of inserted text
      try {
        editor.commands.setTextSelection(newCursorPos);
      } catch {
        // Fallback: just focus
      }
    }, 0);
    
    setShowAutocomplete(false);
    
    // Trigger save
    cancelPendingSave();
    saveTimeoutRef.current = setTimeout(() => {
      if (newValue !== lastSavedValueRef.current) {
        performSave(newValue);
      }
    }, AUTOSAVE_DELAY);
    
    onChange?.(newValue);
  }, [editor, triggerStart, cancelPendingSave, performSave, onChange]);

  // Insert variable at current cursor (for external VariablePicker)
  const insertVariable = useCallback((varName: string) => {
    if (!editor || readOnly) return;
    
    const insertion = varName.startsWith('{{') ? varName : `{{${varName}}}`;
    editor.chain().focus().insertContent(insertion).run();
  }, [editor, readOnly]);

  // Expose imperative handle
  useImperativeHandle(ref, () => ({
    insertVariable,
    focus: () => editor?.chain().focus().run(),
    getEditor: () => editor,
  }), [editor, insertVariable]);

  // Sync external value changes to editor
  useEffect(() => {
    if (!editor) return;
    
    const currentText = editor.getText({ blockSeparator: '\n' });
    if (value !== currentText) {
      isExternalUpdate.current = true;
      editor.commands.setContent(value ? `<p>${value.replace(/\n/g, '</p><p>')}</p>`.replace('<p></p>', '') : '');
      lastSavedValueRef.current = value;
      isExternalUpdate.current = false;
    }
  }, [value, editor]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div 
      className={cn(
        "tiptap-prompt-editor relative bg-transparent",
        className
      )}
      style={{ minHeight, ...style }}
    >
      <style>{`
        .tiptap-prompt-editor .ProseMirror {
          min-height: inherit;
          height: 100%;
          padding: 0;
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .tiptap-prompt-editor .ProseMirror p {
          margin: 0;
        }
        .tiptap-prompt-editor .ProseMirror:focus {
          outline: none;
        }
        .tiptap-prompt-editor .ProseMirror .is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          float: left;
          height: 0;
          pointer-events: none;
        }
        .tiptap-prompt-editor .variable-highlight {
          color: hsl(var(--primary));
          background: hsl(var(--primary) / 0.1);
          border-radius: 3px;
          padding: 0 2px;
        }
        /* Cursor protection against resizable panels */
        .tiptap-prompt-editor [contenteditable]:focus,
        .tiptap-prompt-editor [contenteditable]:focus * {
          cursor: text !important;
        }
      `}</style>
      
      <EditorContent 
        editor={editor}
        className="h-full"
      />

      {/* Autocomplete dropdown */}
      {showAutocomplete && filteredVariables.length > 0 && (
        <div
          className="absolute z-50 bg-popover border border-border rounded-md shadow-lg overflow-hidden"
          style={{
            top: '100%',
            left: 0,
            marginTop: '4px',
            minWidth: '220px',
            maxWidth: '320px',
          }}
        >
          <ScrollArea className="max-h-[300px]">
            <div className="py-1">
              {filteredVariables.map((variable, index) => (
                <button
                  key={variable.name}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-sm flex items-center gap-2",
                    "hover:bg-muted transition-colors",
                    index === selectedIndex && "bg-muted"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertVariableAtTrigger(variable);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className={cn(
                    "font-mono text-xs px-1 rounded",
                    variable.isSystem ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground"
                  )}>
                    {`{{${variable.name}}}`}
                  </span>
                  {variable.isStatic && (
                    <span className="text-[10px] text-muted-foreground">auto</span>
                  )}
                  {variable.isRuntime && (
                    <span className="text-[10px] text-amber-500">cascade</span>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
          <div className="px-2 py-1 border-t border-border text-[10px] text-muted-foreground flex items-center gap-2">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>esc close</span>
          </div>
        </div>
      )}
    </div>
  );
});

TiptapPromptEditor.displayName = 'TiptapPromptEditor';

export default TiptapPromptEditor;
