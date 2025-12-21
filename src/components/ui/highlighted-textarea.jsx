import React, { useRef, useCallback, useLayoutEffect, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  SYSTEM_VARIABLES, 
  SYSTEM_VARIABLE_TYPES,
  getSystemVariableNames 
} from '@/config/systemVariables';

/**
 * A textarea with syntax highlighting for {{variables}} and autocomplete
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
  const backdropRef = useRef(null);
  const textareaRef = useRef(null);
  
  // Autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [triggerStart, setTriggerStart] = useState(-1);

  // Forward ref to textarea
  React.useImperativeHandle(ref, () => textareaRef.current);

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

  // Sync scroll between textarea and backdrop
  const syncScroll = useCallback(() => {
    if (backdropRef.current && textareaRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  useLayoutEffect(() => {
    syncScroll();
  }, [value, syncScroll]);

  // Get caret coordinates for positioning autocomplete
  const getCaretCoordinates = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return { top: 0, left: 0 };

    const { selectionStart } = textarea;
    const textBeforeCaret = value.substring(0, selectionStart);
    
    // Create a hidden div to measure text
    const div = document.createElement('div');
    const style = window.getComputedStyle(textarea);
    
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.width = style.width;
    div.style.font = style.font;
    div.style.padding = style.padding;
    div.style.border = style.border;
    div.style.lineHeight = style.lineHeight;
    
    div.textContent = textBeforeCaret;
    
    const span = document.createElement('span');
    span.textContent = '|';
    div.appendChild(span);
    
    document.body.appendChild(div);
    
    const spanRect = span.getBoundingClientRect();
    const divRect = div.getBoundingClientRect();
    
    document.body.removeChild(div);
    
    return {
      top: spanRect.top - divRect.top + parseInt(style.paddingTop) - textarea.scrollTop + 20,
      left: spanRect.left - divRect.left + parseInt(style.paddingLeft) - textarea.scrollLeft,
    };
  }, [value]);

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

  // Handle text change
  const handleChange = (e) => {
    const newValue = e.target.value;
    onChange?.(e);
    syncScroll();
    
    // Check for autocomplete trigger
    setTimeout(() => {
      checkForTrigger(newValue, e.target.selectionStart);
    }, 0);
  };

  // Handle key events for autocomplete navigation
  const handleKeyDown = (e) => {
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
  };

  // Insert selected variable
  const insertVariable = (variable) => {
    const textarea = textareaRef.current;
    if (!textarea || triggerStart === -1) return;
    
    const beforeTrigger = value.substring(0, triggerStart);
    const afterCursor = value.substring(textarea.selectionStart);
    const varText = `{{${variable.name}}}`;
    const newValue = beforeTrigger + varText + afterCursor;
    
    // Create synthetic event
    const event = {
      target: {
        value: newValue,
        selectionStart: beforeTrigger.length + varText.length,
        selectionEnd: beforeTrigger.length + varText.length,
      },
    };
    
    onChange?.(event);
    setShowAutocomplete(false);
    
    // Reset cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        beforeTrigger.length + varText.length,
        beforeTrigger.length + varText.length
      );
    }, 0);
  };

  const handleScroll = () => {
    syncScroll();
    setShowAutocomplete(false);
  };

  const handleBlur = (e) => {
    // Delay hiding to allow click on autocomplete item
    setTimeout(() => {
      setShowAutocomplete(false);
    }, 150);
  };

  // Parse text and create highlighted HTML
  const getHighlightedHtml = (text) => {
    if (!text) return '';
    
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const highlighted = escaped.replace(
      /(\{\{[^}]+\}\})/g,
      (match) => {
        const isSystemVar = match.includes('q.');
        const bgClass = isSystemVar ? 'var-system' : 'var-user';
        return `<mark class="${bgClass}">${match}</mark>`;
      }
    );

    return highlighted;
  };

  return (
    <div 
      ref={containerRef}
      className="relative highlighted-textarea-container"
    >
      <style>{`
        .highlighted-textarea-container .var-system {
          background-color: hsl(var(--primary) / 0.2);
          color: transparent;
          border-radius: 2px;
          padding: 0 1px;
          margin: 0 -1px;
        }
        .highlighted-textarea-container .var-user {
          background-color: hsl(var(--secondary));
          color: transparent;
          border-radius: 2px;
          padding: 0 1px;
          margin: 0 -1px;
        }
        .highlighted-textarea-container .backdrop {
          position: absolute;
          inset: 0;
          overflow: auto;
          pointer-events: none;
          white-space: pre-wrap;
          word-wrap: break-word;
          color: transparent;
          border: 1px solid transparent;
          padding: 0.75rem;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace;
          font-size: 0.875rem;
          line-height: 1.5;
        }
        .highlighted-textarea-container textarea {
          position: relative;
          background: transparent;
          caret-color: hsl(var(--foreground));
        }
      `}</style>

      {/* Backdrop with highlights */}
      <div
        ref={backdropRef}
        className="backdrop"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: getHighlightedHtml(value) + '\n' }}
      />

      {/* Actual textarea */}
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={handleChange}
        onSelect={onSelect}
        onClick={onClick}
        onKeyUp={onKeyUp}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        onBlur={handleBlur}
        placeholder={placeholder}
        rows={rows}
        readOnly={readOnly}
        className={cn(
          "w-full resize-y",
          "font-mono text-sm leading-relaxed",
          "border border-border rounded-md p-3",
          "focus:outline-none focus:ring-2 focus:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "text-foreground",
          className
        )}
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
