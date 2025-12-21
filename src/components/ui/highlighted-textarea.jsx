import React, { useRef, useCallback, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  SYSTEM_VARIABLES, 
  SYSTEM_VARIABLE_TYPES,
  getSystemVariableNames 
} from '@/config/systemVariables';

/**
 * A textarea with syntax highlighting for {{variables}} and autocomplete
 * Uses contenteditable for direct styling of variables
 */
const HighlightedTextarea = React.forwardRef(({
  value = '',
  onChange,
  onSelect,
  onClick,
  onKeyUp,
  placeholder,
  rows = 4,
  className,
  readOnly = false,
  id,
  userVariables = [],
  ...props
}, ref) => {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  
  // Autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [triggerStart, setTriggerStart] = useState(-1);

  // Forward ref to editor
  React.useImperativeHandle(ref, () => editorRef.current);

  // Build list of all available variables
  const allVariables = React.useMemo(() => {
    const systemVars = getSystemVariableNames().map(name => ({
      name,
      label: SYSTEM_VARIABLES[name]?.label || name,
      description: SYSTEM_VARIABLES[name]?.description || '',
      isSystem: true,
      isStatic: SYSTEM_VARIABLES[name]?.type === SYSTEM_VARIABLE_TYPES.STATIC,
    }));
    
    const userVars = (userVariables || []).map(v => ({
      name: typeof v === 'string' ? v : v.name,
      label: typeof v === 'string' ? v : v.name,
      description: typeof v === 'string' ? '' : (v.description || ''),
      isSystem: false,
      isStatic: false,
    }));
    
    return [...systemVars, ...userVars];
  }, [userVariables]);

  // Filter variables based on query
  const filteredVariables = React.useMemo(() => {
    if (!autocompleteQuery) return allVariables.slice(0, 10);
    const query = autocompleteQuery.toLowerCase();
    return allVariables
      .filter(v => v.name.toLowerCase().includes(query) || v.label.toLowerCase().includes(query))
      .slice(0, 10);
  }, [allVariables, autocompleteQuery]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredVariables.length]);

  // Get plain text from contenteditable
  const getPlainText = useCallback((element) => {
    if (!element) return '';
    
    // Clone the element to avoid modifying the original
    const clone = element.cloneNode(true);
    
    // Replace <br> with newlines
    const brs = clone.querySelectorAll('br');
    brs.forEach(br => br.replaceWith('\n'));
    
    // Replace <div> with newlines (Chrome adds divs for new lines)
    const divs = clone.querySelectorAll('div');
    divs.forEach(div => {
      if (div.previousSibling) {
        div.insertBefore(document.createTextNode('\n'), div.firstChild);
      }
    });
    
    return clone.textContent || '';
  }, []);

  // Get cursor position in plain text
  const getCursorPosition = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return 0;
    
    const selection = window.getSelection();
    if (!selection.rangeCount) return 0;
    
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editor);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    
    // Create a temporary div to get the text
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(preCaretRange.cloneContents());
    
    // Handle br tags
    const brs = tempDiv.querySelectorAll('br');
    brs.forEach(br => br.replaceWith('\n'));
    
    return tempDiv.textContent?.length || 0;
  }, []);

  // Set cursor position in contenteditable
  const setCursorPosition = useCallback((position) => {
    const editor = editorRef.current;
    if (!editor) return;
    
    const selection = window.getSelection();
    const range = document.createRange();
    
    let charCount = 0;
    let found = false;
    
    const traverseNodes = (node) => {
      if (found) return;
      
      if (node.nodeType === Node.TEXT_NODE) {
        const nodeLength = node.textContent?.length || 0;
        if (charCount + nodeLength >= position) {
          range.setStart(node, position - charCount);
          range.collapse(true);
          found = true;
          return;
        }
        charCount += nodeLength;
      } else if (node.nodeName === 'BR') {
        charCount += 1;
        if (charCount >= position) {
          range.setStartAfter(node);
          range.collapse(true);
          found = true;
          return;
        }
      } else {
        for (const child of node.childNodes) {
          traverseNodes(child);
          if (found) return;
        }
      }
    };
    
    traverseNodes(editor);
    
    if (!found) {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  // Parse text and create highlighted HTML
  const getHighlightedHtml = useCallback((text) => {
    if (!text) return '';
    
    // Escape HTML entities
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Highlight variables with pink color
    const highlighted = escaped.replace(
      /(\{\{[^}]+\}\})/g,
      (match) => {
        return `<span class="var-highlight">${match}</span>`;
      }
    );

    // Convert newlines to <br>
    return highlighted.replace(/\n/g, '<br>');
  }, []);

  // Update editor content when value changes externally
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    
    const currentText = getPlainText(editor);
    if (currentText !== value) {
      const cursorPos = getCursorPosition();
      editor.innerHTML = getHighlightedHtml(value) || '<br>';
      
      // Restore cursor position
      if (document.activeElement === editor) {
        setCursorPosition(Math.min(cursorPos, value.length));
      }
    }
  }, [value, getPlainText, getHighlightedHtml, getCursorPosition, setCursorPosition]);

  // Get caret coordinates for positioning autocomplete
  const getCaretCoordinates = useCallback(() => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return { top: 0, left: 0 };
    
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    
    if (!containerRect) return { top: 0, left: 0 };
    
    return {
      top: rect.bottom - containerRect.top + 4,
      left: rect.left - containerRect.left,
    };
  }, []);

  // Check for autocomplete trigger
  const checkForTrigger = useCallback((text, cursorPos) => {
    // Look backwards from cursor for {{
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
    const query = textBetween;
    setTriggerStart(lastOpenBrace);
    setAutocompleteQuery(query);
    setShowAutocomplete(true);
    setAutocompletePosition(getCaretCoordinates());
  }, [getCaretCoordinates]);

  // Handle input changes
  const handleInput = useCallback((e) => {
    const editor = editorRef.current;
    if (!editor) return;
    
    const plainText = getPlainText(editor);
    const cursorPos = getCursorPosition();
    
    // Update the HTML with highlights while preserving cursor
    const newHtml = getHighlightedHtml(plainText);
    if (editor.innerHTML !== newHtml && editor.innerHTML !== newHtml + '<br>') {
      editor.innerHTML = newHtml || '<br>';
      setCursorPosition(cursorPos);
    }
    
    // Create synthetic event for onChange
    const syntheticEvent = {
      target: {
        value: plainText,
        selectionStart: cursorPos,
        selectionEnd: cursorPos,
      },
    };
    
    onChange?.(syntheticEvent);
    
    // Check for autocomplete trigger
    setTimeout(() => {
      checkForTrigger(plainText, getCursorPosition());
    }, 0);
  }, [getPlainText, getCursorPosition, getHighlightedHtml, setCursorPosition, onChange, checkForTrigger]);

  // Handle paste - strip formatting
  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') || '';
    document.execCommand('insertText', false, text);
  }, []);

  // Handle key events for autocomplete navigation
  const handleKeyDown = useCallback((e) => {
    if (!showAutocomplete) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredVariables.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case 'Tab':
        if (filteredVariables.length > 0) {
          e.preventDefault();
          insertVariable(filteredVariables[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowAutocomplete(false);
        break;
    }
  }, [showAutocomplete, filteredVariables, selectedIndex]);

  // Insert selected variable
  const insertVariable = useCallback((variable) => {
    const editor = editorRef.current;
    if (!editor || triggerStart === -1) return;
    
    const plainText = getPlainText(editor);
    const cursorPos = getCursorPosition();
    
    const beforeTrigger = plainText.substring(0, triggerStart);
    const afterCursor = plainText.substring(cursorPos);
    const varText = `{{${variable.name}}}`;
    const newValue = beforeTrigger + varText + afterCursor;
    const newCursorPos = beforeTrigger.length + varText.length;
    
    // Update content
    editor.innerHTML = getHighlightedHtml(newValue) || '<br>';
    setCursorPosition(newCursorPos);
    
    // Create synthetic event
    const syntheticEvent = {
      target: {
        value: newValue,
        selectionStart: newCursorPos,
        selectionEnd: newCursorPos,
      },
    };
    
    onChange?.(syntheticEvent);
    setShowAutocomplete(false);
  }, [triggerStart, getPlainText, getCursorPosition, getHighlightedHtml, setCursorPosition, onChange]);

  const handleBlur = useCallback(() => {
    // Delay hiding to allow click on autocomplete item
    setTimeout(() => {
      setShowAutocomplete(false);
    }, 150);
  }, []);

  const handleScroll = useCallback(() => {
    setShowAutocomplete(false);
  }, []);

  // Calculate min-height based on rows
  const minHeight = `${rows * 1.625}rem`;

  return (
    <div 
      ref={containerRef}
      className="relative highlighted-textarea-container"
    >
      <style>{`
        .highlighted-textarea-container .var-highlight {
          color: hsl(var(--primary));
        }
        .highlighted-textarea-container .editor-content {
          min-height: ${minHeight};
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace;
          font-size: 0.875rem;
          line-height: 1.625;
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .highlighted-textarea-container .editor-content:empty::before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          pointer-events: none;
        }
        .highlighted-textarea-container .editor-content:focus {
          outline: none;
        }
      `}</style>

      {/* Contenteditable editor */}
      <div
        ref={editorRef}
        id={id}
        contentEditable={!readOnly}
        data-placeholder={placeholder}
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onKeyUp={onKeyUp}
        onClick={onClick}
        onBlur={handleBlur}
        onScroll={handleScroll}
        className={cn(
          "editor-content w-full resize-y overflow-auto",
          "border border-border rounded-md p-3",
          "focus:ring-2 focus:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "text-foreground bg-background",
          readOnly && "cursor-not-allowed opacity-50",
          className
        )}
        style={{ minHeight }}
        suppressContentEditableWarning
        {...props}
      />

      {/* Autocomplete dropdown */}
      {showAutocomplete && filteredVariables.length > 0 && (
        <div
          className="absolute z-50 bg-popover border border-border rounded-md shadow-lg overflow-hidden"
          style={{
            top: autocompletePosition.top,
            left: Math.min(autocompletePosition.left, 200),
            minWidth: '220px',
            maxWidth: '320px',
          }}
        >
          <ScrollArea className="max-h-[200px]">
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
                    insertVariable(variable);
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

HighlightedTextarea.displayName = 'HighlightedTextarea';

export default HighlightedTextarea;
