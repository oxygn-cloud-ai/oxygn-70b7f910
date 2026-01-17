import React, { useRef, useCallback, useState, useEffect, useMemo, forwardRef } from 'react';
import { cn, mergeRefs } from '@/lib/utils';
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
 * Uses overlay pattern: transparent textarea over highlighted backdrop
 */
const HighlightedTextarea = forwardRef(({
  value = '',
  onChange,
  onSelect,
  onClick,
  onKeyUp,
  onBlur,
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
  const textareaRef = useRef(null);
  const backdropRef = useRef(null);
  
  // Autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [triggerStart, setTriggerStart] = useState(-1);

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

  // Lookup prompt names for q.ref[UUID] patterns
  const { nameMap: promptNameMap } = usePromptNameLookup(value);

  // Generate highlighted HTML for backdrop
  const getHighlightedHtml = useCallback((text) => {
    if (!text) return '\u00A0'; // Non-breaking space for empty
    
    // Escape HTML entities
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // First, replace q.ref[UUID].field patterns with friendly names
    const refPattern = /\{\{q\.ref\[([a-f0-9-]{36})\]\.([a-z_]+)\}\}/gi;
    html = html.replace(refPattern, (match, uuid, field) => {
      const promptInfo = promptNameMap?.get(uuid.toLowerCase());
      const promptName = promptInfo?.name || 'Unknown';
      const fieldLabel = FIELD_LABELS[field] || field;
      return `<span class="var-ref">{{📄 ${promptName} → ${fieldLabel}}}</span>`;
    });

    // Then highlight remaining variables
    html = html.replace(
      /\{\{([^}]+)\}\}/g,
      (match, varName) => {
        // Skip if already wrapped
        if (match.includes('var-ref')) return match;
        return `<span class="var-highlight">{{${varName}}}</span>`;
      }
    );

    // Trailing newline fix (textarea quirk - needs trailing space to show final line)
    if (html.endsWith('\n') || text.endsWith('\n')) {
      html += '\u00A0';
    }

    return html;
  }, [promptNameMap]);

  // Sync scroll between textarea and backdrop
  const handleScroll = useCallback(() => {
    if (backdropRef.current && textareaRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
    setShowAutocomplete(false);
  }, []);

  // Check for autocomplete trigger
  const checkForTrigger = useCallback((text, cursorPos) => {
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

  // Handle input changes
  const handleInput = useCallback((e) => {
    onChange?.(e);
    
    // Check for autocomplete trigger
    const text = e.target.value;
    const cursorPos = e.target.selectionStart;
    setTimeout(() => {
      checkForTrigger(text, cursorPos);
    }, 0);
  }, [onChange, checkForTrigger]);

  // Insert selected variable
  const insertVariable = useCallback((variable) => {
    const textarea = textareaRef.current;
    if (!textarea || triggerStart === -1) return;
    
    const text = value;
    const cursorPos = textarea.selectionStart;
    
    const beforeTrigger = text.substring(0, triggerStart);
    const afterCursor = text.substring(cursorPos);
    const varText = `{{${variable.name}}}`;
    const newValue = beforeTrigger + varText + afterCursor;
    const newCursorPos = beforeTrigger.length + varText.length;
    
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
    
    // Set cursor position after React updates
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = newCursorPos;
        textareaRef.current.selectionEnd = newCursorPos;
        textareaRef.current.focus();
      }
    }, 0);
  }, [value, triggerStart, onChange]);

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
  }, [showAutocomplete, filteredVariables, selectedIndex, insertVariable]);

  const handleBlurInternal = useCallback((e) => {
    // Delay hiding to allow click on autocomplete items
    setTimeout(() => {
      setShowAutocomplete(false);
    }, 150);
    onBlur?.(e);
  }, [onBlur]);

  // Calculate dimensions - account for padding (0.75rem * 2 = 1.5rem) in height
  const minHeight = `calc(${rows} * 1.625rem + 1.5rem)`;

  // Shared text styles - CRITICAL: must match exactly between textarea and backdrop
  // Note: border is NOT included here - it's applied only via className to textarea
  // The backdrop has no border, which is correct since it sits behind the textarea
  const textStyles = {
    fontFamily: "'Poppins', sans-serif",
    fontSize: '0.875rem',
    lineHeight: '1.625',
    padding: '0.75rem',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
    boxSizing: 'border-box',
    letterSpacing: 'normal',
    textRendering: 'geometricPrecision',
  };

  return (
    <div 
      ref={containerRef}
      className="relative highlighted-textarea-container"
    >
      <style>{`
        .highlighted-textarea-container .var-highlight {
          color: hsl(var(--primary));
          background: hsl(var(--primary) / 0.1);
          border-radius: 3px;
          padding: 0 2px;
        }
        .highlighted-textarea-container .var-ref {
          color: hsl(var(--primary));
          background: hsl(var(--primary) / 0.15);
          border-radius: 3px;
          padding: 0 2px;
        }
        .highlighted-textarea-container .backdrop-content {
          margin: 0;
          color: hsl(var(--foreground));
        }
        .highlighted-textarea-container textarea {
          color: transparent;
          caret-color: hsl(var(--foreground));
        }
        .highlighted-textarea-container textarea::selection {
          background: hsl(var(--primary) / 0.2);
        }
        .highlighted-textarea-container textarea::placeholder {
          color: hsl(var(--muted-foreground));
        }
      `}</style>

      {/* Backdrop with highlights - sits behind textarea */}
      {/* Note: overflow-y-auto allows vertical scroll sync, overflow-x-hidden prevents horizontal scrollbar */}
      {/* Border offset: textarea has 1px border, so backdrop needs matching padding offset */}
      <pre
        ref={backdropRef}
        className="backdrop-content absolute inset-0 overflow-y-auto overflow-x-hidden pointer-events-none rounded-md bg-background"
        style={{
          ...textStyles,
          minHeight,
          // Offset by 1px to account for textarea's border (content starts at same position)
          padding: 'calc(0.75rem + 1px)',
          margin: '-1px',
        }}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: getHighlightedHtml(value) }}
      />
      
      {/* Actual textarea - transparent text, visible caret */}
      <textarea
        ref={mergeRefs(ref, textareaRef)}
        id={id}
        value={value}
        onChange={handleInput}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onKeyUp={onKeyUp}
        onClick={onClick}
        onSelect={onSelect}
        onBlur={handleBlurInternal}
        rows={rows}
        readOnly={readOnly}
        placeholder={placeholder}
        className={cn(
          "relative z-10 w-full resize-y overflow-auto",
          "border border-border rounded-md",
          "focus:ring-2 focus:ring-ring focus:border-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          readOnly && "cursor-not-allowed opacity-50",
          className,
          "!bg-transparent"
        )}
        style={{
          ...textStyles,
          minHeight,
          ...propStyle,
        }}
        {...props}
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
