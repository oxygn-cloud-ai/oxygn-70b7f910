import React, { useRef, useCallback, useState, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  SYSTEM_VARIABLES, 
  SYSTEM_VARIABLE_TYPES,
  getSystemVariableNames 
} from '@/config/systemVariables';
import { usePromptNameLookup } from '@/hooks/usePromptNameLookup';

// Field labels for friendly display
const FIELD_LABELS = {
  output_response: 'AI Response',
  user_prompt_result: 'User Result',
  input_admin_prompt: 'System Prompt',
  input_user_prompt: 'User Prompt',
  prompt_name: 'Name',
};

// Variable type labels
const VARIABLE_TYPE_LABELS = {
  [SYSTEM_VARIABLE_TYPES.STATIC]: 'Auto-filled',
  [SYSTEM_VARIABLE_TYPES.INPUT]: 'User Input',
  [SYSTEM_VARIABLE_TYPES.SELECT]: 'Selection',
};

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
  style: propStyle,
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

  // Variable hover/click popover state
  const [hoveredVar, setHoveredVar] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ top: 0, left: 0 });
  const [showVarPopover, setShowVarPopover] = useState(false);
  const [clickedVarInfo, setClickedVarInfo] = useState(null); // { name, start, end, element }
  const hoverTimeoutRef = useRef(null);

  // Forward ref to editor
  useImperativeHandle(ref, () => editorRef.current);

  // Build list of all available variables
  const allVariables = useMemo(() => {
    const systemVars = getSystemVariableNames().map(name => ({
      name,
      label: SYSTEM_VARIABLES[name]?.label || name,
      description: SYSTEM_VARIABLES[name]?.description || '',
      type: VARIABLE_TYPE_LABELS[SYSTEM_VARIABLES[name]?.type] || 'System',
      isSystem: true,
      isStatic: SYSTEM_VARIABLES[name]?.type === SYSTEM_VARIABLE_TYPES.STATIC,
    }));
    
    const userVars = (userVariables || []).map(v => ({
      name: typeof v === 'string' ? v : v.name,
      label: typeof v === 'string' ? v : v.name,
      description: typeof v === 'string' ? '' : (v.description || ''),
      type: 'User Variable',
      isSystem: false,
      isStatic: false,
      value: typeof v === 'string' ? '' : (v.value || ''),
    }));
    
    return [...systemVars, ...userVars];
  }, [userVariables]);

  // Build a lookup map for variable info
  const variableMap = useMemo(() => {
    const map = new Map();
    allVariables.forEach(v => map.set(v.name, v));
    return map;
  }, [allVariables]);

  // Filter variables based on query
  const filteredVariables = useMemo(() => {
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
        // Position cursor right after this <br> when we've reached the target position
        if (charCount === position) {
          // Find the next text node or position after the <br>
          if (node.nextSibling) {
            if (node.nextSibling.nodeType === Node.TEXT_NODE) {
              range.setStart(node.nextSibling, 0);
            } else {
              range.setStartAfter(node);
            }
          } else {
            range.setStartAfter(node);
          }
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

  // Lookup prompt names for q.ref[UUID] patterns
  const { nameMap: promptNameMap } = usePromptNameLookup(value);

  // Parse text and create highlighted HTML
  const getHighlightedHtml = useCallback((text, nameMap) => {
    if (!text) return '';
    
    // Escape HTML entities
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // First, replace q.ref[UUID].field patterns with friendly names
    const refPattern = /\{\{q\.ref\[([a-f0-9-]{36})\]\.([a-z_]+)\}\}/gi;
    let highlighted = escaped.replace(refPattern, (match, uuid, field) => {
      const promptInfo = nameMap?.get(uuid.toLowerCase());
      const promptName = promptInfo?.name || 'Unknown';
      const fieldLabel = FIELD_LABELS[field] || field;
      return `<span class="var-highlight var-ref" data-uuid="${uuid}" data-field="${field}" title="${promptName} → ${fieldLabel}">{{📄 ${promptName} → ${fieldLabel}}}</span>`;
    });

    // Then highlight remaining variables with pink color and add data attributes
    highlighted = highlighted.replace(
      /\{\{([^}]+)\}\}/g,
      (match, varName) => {
        // Skip if already wrapped (check for var-highlight)
        if (match.includes('var-highlight')) return match;
        // Add data-varname for hover lookup
        return `<span class="var-highlight var-clickable" data-varname="${varName}">${match}</span>`;
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
      editor.innerHTML = getHighlightedHtml(value, promptNameMap) || '<br>';
      
      // Restore cursor position
      if (document.activeElement === editor) {
        setCursorPosition(Math.min(cursorPos, value.length));
      }
    }
  }, [value, getPlainText, getHighlightedHtml, getCursorPosition, setCursorPosition, promptNameMap]);

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
    const newHtml = getHighlightedHtml(plainText, promptNameMap);
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
  }, [getPlainText, getCursorPosition, getHighlightedHtml, setCursorPosition, onChange, checkForTrigger, promptNameMap]);

  // Handle paste - strip formatting
  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') || '';
    document.execCommand('insertText', false, text);
  }, []);

  // Handle key events for autocomplete navigation and Enter key
  const handleKeyDown = useCallback((e) => {
    // Handle Enter key for normal newline insertion (when autocomplete NOT shown)
    if (e.key === 'Enter' && !showAutocomplete) {
      e.preventDefault(); // Stop browser's default div-wrapping behavior
      
      const editor = editorRef.current;
      if (!editor) return;
      
      // Get current state
      const plainText = getPlainText(editor);
      const cursorPos = getCursorPosition();
      
      // Insert single newline at cursor position
      const beforeCursor = plainText.substring(0, cursorPos);
      const afterCursor = plainText.substring(cursorPos);
      const newValue = beforeCursor + '\n' + afterCursor;
      const newCursorPos = cursorPos + 1;
      
      // Update content with highlighting (getHighlightedHtml converts \n to <br>)
      editor.innerHTML = getHighlightedHtml(newValue, promptNameMap) || '<br>';
      setCursorPosition(newCursorPos);
      
      // Notify parent of change
      const syntheticEvent = {
        target: {
          value: newValue,
          selectionStart: newCursorPos,
          selectionEnd: newCursorPos,
        },
      };
      onChange?.(syntheticEvent);
      return;
    }
    
    // Existing autocomplete navigation logic
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
  }, [showAutocomplete, filteredVariables, selectedIndex, insertVariable, getPlainText, getCursorPosition, getHighlightedHtml, setCursorPosition, onChange, promptNameMap]);

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
    editor.innerHTML = getHighlightedHtml(newValue, promptNameMap) || '<br>';
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
  }, [triggerStart, getPlainText, getCursorPosition, getHighlightedHtml, setCursorPosition, onChange, promptNameMap]);

  const handleBlur = useCallback(() => {
    // Delay hiding to allow click on autocomplete/popover items
    setTimeout(() => {
      setShowAutocomplete(false);
    }, 150);
  }, []);

  const handleScroll = useCallback(() => {
    setShowAutocomplete(false);
    setShowVarPopover(false);
    setHoveredVar(null);
  }, []);

  // Handle mouseover on variables
  const handleMouseOver = useCallback((e) => {
    const target = e.target;
    if (target.classList?.contains('var-clickable') && target.dataset.varname) {
      const varName = target.dataset.varname;
      const varInfo = variableMap.get(varName);
      
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      
      hoverTimeoutRef.current = setTimeout(() => {
        const rect = target.getBoundingClientRect();
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (containerRect) {
          setHoverPosition({
            top: rect.bottom - containerRect.top + 4,
            left: rect.left - containerRect.left,
          });
          setHoveredVar(varInfo || { name: varName, label: varName, description: '', type: 'Unknown' });
        }
      }, 300);
    }
  }, [variableMap]);

  const handleMouseOut = useCallback((e) => {
    const target = e.target;
    if (target.classList?.contains('var-clickable')) {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      // Delay hiding to allow moving to popover
      setTimeout(() => {
        setHoveredVar(null);
      }, 100);
    }
  }, []);

  // Handle click on variables to show change picker
  const handleEditorClick = useCallback((e) => {
    const target = e.target;
    if (target.classList?.contains('var-clickable') && target.dataset.varname) {
      e.stopPropagation();
      const varName = target.dataset.varname;
      const varInfo = variableMap.get(varName);
      
      // Find the position of this variable in the text
      const editor = editorRef.current;
      const plainText = getPlainText(editor);
      const fullVar = `{{${varName}}}`;
      
      // Find the occurrence by walking through the text
      let start = -1;
      let searchPos = 0;
      const spans = editor.querySelectorAll('.var-clickable');
      for (let i = 0; i < spans.length; i++) {
        const span = spans[i];
        const spanVarName = span.dataset.varname;
        const idx = plainText.indexOf(`{{${spanVarName}}}`, searchPos);
        if (idx !== -1) {
          if (span === target) {
            start = idx;
            break;
          }
          searchPos = idx + `{{${spanVarName}}}`.length;
        }
      }
      
      if (start === -1) {
        start = plainText.indexOf(fullVar);
      }
      
      const rect = target.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect && start !== -1) {
        setHoverPosition({
          top: rect.bottom - containerRect.top + 4,
          left: rect.left - containerRect.left,
        });
        setClickedVarInfo({
          name: varName,
          info: varInfo || { name: varName, label: varName, description: '', type: 'Unknown' },
          start,
          end: start + fullVar.length,
        });
        setShowVarPopover(true);
        setHoveredVar(null);
      }
    } else {
      // Close popover if clicking elsewhere
      setShowVarPopover(false);
      setClickedVarInfo(null);
    }
    
    // Call original onClick
    onClick?.(e);
  }, [variableMap, getPlainText, onClick]);

  // Replace variable with another
  const handleReplaceVariable = useCallback((newVarName) => {
    if (!clickedVarInfo) return;
    
    const editor = editorRef.current;
    if (!editor) return;
    
    const plainText = getPlainText(editor);
    const newVar = `{{${newVarName}}}`;
    const newValue = plainText.slice(0, clickedVarInfo.start) + newVar + plainText.slice(clickedVarInfo.end);
    const newCursorPos = clickedVarInfo.start + newVar.length;
    
    // Update content
    editor.innerHTML = getHighlightedHtml(newValue, promptNameMap) || '<br>';
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
    setShowVarPopover(false);
    setClickedVarInfo(null);
  }, [clickedVarInfo, getPlainText, getHighlightedHtml, setCursorPosition, onChange, promptNameMap]);

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
        .highlighted-textarea-container .var-clickable {
          background: hsl(var(--primary) / 0.1);
          border-radius: 3px;
          padding: 0 2px;
          cursor: pointer;
        }
        .highlighted-textarea-container .var-clickable:hover {
          background: hsl(var(--primary) / 0.2);
        }
        .highlighted-textarea-container .var-ref {
          background: hsl(var(--primary) / 0.1);
          border-radius: 3px;
          padding: 0 2px;
          cursor: help;
        }
        .highlighted-textarea-container .var-ref:hover {
          background: hsl(var(--primary) / 0.2);
        }
        .highlighted-textarea-container .editor-content {
          min-height: ${minHeight};
          font-family: 'Poppins', sans-serif;
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
        onClick={handleEditorClick}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
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
        style={{ minHeight, ...propStyle }}
        suppressContentEditableWarning
        {...props}
      />

      {/* Variable hover tooltip */}
      {hoveredVar && !showVarPopover && (
        <div
          className="absolute z-50 bg-surface-container-high border border-outline-variant rounded-m3-sm shadow-lg p-2 pointer-events-none"
          style={{
            top: hoverPosition.top,
            left: Math.min(hoverPosition.left, 200),
            maxWidth: '280px',
          }}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-tree text-primary bg-primary/10 px-1 rounded">
                {`{{${hoveredVar.name}}}`}
              </span>
              <span className="text-compact text-on-surface-variant">{hoveredVar.type}</span>
            </div>
            {hoveredVar.description && (
              <p className="text-tree text-on-surface-variant">{hoveredVar.description}</p>
            )}
            {hoveredVar.value && (
              <p className="text-compact text-on-surface-variant/70">Value: {hoveredVar.value}</p>
            )}
            <p className="text-compact text-on-surface-variant/50 italic">Click to change</p>
          </div>
        </div>
      )}

      {/* Variable change popover */}
      {showVarPopover && clickedVarInfo && (
        <div
          className="absolute z-50 bg-surface-container-high border border-outline-variant rounded-m3-md shadow-lg overflow-hidden"
          style={{
            top: hoverPosition.top,
            left: Math.min(hoverPosition.left, 200),
            minWidth: '240px',
            maxWidth: '320px',
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {/* Current variable info */}
          <div className="p-2 border-b border-outline-variant bg-surface-container-low">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-tree text-primary bg-primary/10 px-1 rounded">
                {`{{${clickedVarInfo.name}}}`}
              </span>
              <span className="text-compact text-on-surface-variant">{clickedVarInfo.info?.type}</span>
            </div>
            {clickedVarInfo.info?.description && (
              <p className="text-compact text-on-surface-variant">{clickedVarInfo.info.description}</p>
            )}
          </div>
          
          {/* Replace with section */}
          <div className="p-1.5 border-b border-outline-variant">
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider px-1">Replace with</span>
          </div>
          
          <ScrollArea className="max-h-[200px]">
            <div className="py-1">
              {allVariables.filter(v => v.name !== clickedVarInfo.name).map((variable) => (
                <button
                  key={variable.name}
                  className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-on-surface/[0.08] transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleReplaceVariable(variable.name);
                  }}
                >
                  <span className={cn(
                    "font-mono text-tree px-1 rounded",
                    variable.isSystem ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground"
                  )}>
                    {variable.name}
                  </span>
                  <span className="text-compact text-on-surface-variant truncate flex-1">{variable.type}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
          
          <div className="px-2 py-1 border-t border-outline-variant">
            <button
              className="text-[10px] text-on-surface-variant hover:text-on-surface"
              onMouseDown={(e) => {
                e.preventDefault();
                setShowVarPopover(false);
                setClickedVarInfo(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
