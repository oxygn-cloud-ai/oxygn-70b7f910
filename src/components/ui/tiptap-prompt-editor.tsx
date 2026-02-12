// @ts-nocheck
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

const AUTOSAVE_DELAY = 500;

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
 * Converts plain text to Tiptap HTML format
 * Handles consecutive newlines properly using global regex
 */
const textToHtml = (text: string): string => {
  if (!text) return '';
  return `<p>${text.replace(/\n/g, '</p><p>')}</p>`.replace(/<p><\/p>/g, '<p><br></p>');
};

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
  
  // Refs to access current state in keyboard handlers (fixes stale closure bug)
  const showAutocompleteRef = useRef(showAutocomplete);
  const filteredVariablesRef = useRef<AutocompleteVariable[]>([]);
  const selectedIndexRef = useRef(selectedIndex);

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

  // Sync refs with state to avoid stale closures in keyboard handler
  useEffect(() => { showAutocompleteRef.current = showAutocomplete; }, [showAutocomplete]);
  useEffect(() => { filteredVariablesRef.current = filteredVariables; }, [filteredVariables]);
  useEffect(() => { selectedIndexRef.current = selectedIndex; }, [selectedIndex]);

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

  // Insert variable at trigger - using refs to get current state
  const insertVariableAtTriggerRef = useRef<(variable: AutocompleteVariable) => void>(() => {});
  
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
    content: textToHtml(value),
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
        // Handle autocomplete navigation using refs for current state
        if (showAutocompleteRef.current) {
          const currentFiltered = filteredVariablesRef.current;
          const currentIndex = selectedIndexRef.current;
          
          switch (event.key) {
            case 'ArrowDown':
              event.preventDefault();
              setSelectedIndex(Math.min(currentIndex + 1, currentFiltered.length - 1));
              return true;
            case 'ArrowUp':
              event.preventDefault();
              setSelectedIndex(Math.max(currentIndex - 1, 0));
              return true;
            case 'Enter':
            case 'Tab':
              if (currentFiltered.length > 0) {
                event.preventDefault();
                insertVariableAtTriggerRef.current(currentFiltered[currentIndex]);
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
    
    // Get current cursor position in plain text
    const { from: cursorDocPos } = editor.state.selection;
    
    // Calculate cursor position in plain text by traversing document
    let textPos = 0;
    let found = false;
    editor.state.doc.descendants((node, pos) => {
      if (found) return false;
      if (pos >= cursorDocPos) {
        found = true;
        return false;
      }
      if (node.isText) {
        const nodeEndPos = pos + node.nodeSize;
        if (cursorDocPos <= nodeEndPos) {
          textPos += cursorDocPos - pos;
          found = true;
          return false;
        }
        textPos += node.text?.length || 0;
      } else if (node.type.name === 'paragraph') {
        // Add newline for paragraph breaks (except first)
        if (pos > 0) textPos += 1;
      }
      return true;
    });
    
    // Calculate positions in the plain text
    const beforeTrigger = currentText.substring(0, triggerStart);
    const afterCursor = currentText.substring(textPos);
    const newValue = beforeTrigger + varText + afterCursor;
    
    // Set content
    isExternalUpdate.current = true;
    editor.commands.setContent(textToHtml(newValue));
    isExternalUpdate.current = false;
    
    // Calculate new cursor document position
    const newTextPos = triggerStart + varText.length;
    let newDocPos = 1; // Start after first <p>
    let accumulatedText = 0;
    
    editor.state.doc.descendants((node, pos) => {
      if (accumulatedText >= newTextPos) return false;
      if (node.isText && node.text) {
        const remaining = newTextPos - accumulatedText;
        if (remaining <= node.text.length) {
          newDocPos = pos + remaining;
          return false;
        }
        accumulatedText += node.text.length;
      } else if (node.type.name === 'paragraph' && pos > 0) {
        accumulatedText += 1; // newline
      }
      return true;
    });
    
    // Focus and set cursor
    setTimeout(() => {
      editor.commands.focus();
      try {
        editor.commands.setTextSelection(newDocPos);
      } catch {
        // Fallback: focus at end
        editor.commands.focus('end');
      }
    }, 0);
    
    setShowAutocomplete(false);
    onChange?.(newValue);
  }, [editor, triggerStart, onChange]);

  // Update ref whenever callback changes
  useEffect(() => {
    insertVariableAtTriggerRef.current = insertVariableAtTrigger;
  }, [insertVariableAtTrigger]);

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
      editor.commands.setContent(textToHtml(value));
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