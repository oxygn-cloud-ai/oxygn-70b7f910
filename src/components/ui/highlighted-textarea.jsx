import React, { useRef, useCallback, useLayoutEffect } from 'react';
import { cn } from '@/lib/utils';

/**
 * A textarea with syntax highlighting for {{variables}}
 * Uses a backdrop highlight technique where colored spans sit behind transparent text
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
  ...props
}, ref) => {
  const containerRef = useRef(null);
  const backdropRef = useRef(null);
  const textareaRef = useRef(null);

  // Forward ref to textarea
  React.useImperativeHandle(ref, () => textareaRef.current);

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

  // Parse text and create highlighted HTML
  const getHighlightedHtml = (text) => {
    if (!text) return '';
    
    // Escape HTML entities first
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Replace variables with highlighted spans
    const highlighted = escaped.replace(
      /(\{\{[^}]+\}\})/g,
      (match) => {
        const isSystemVar = match.includes('q.');
        const bgClass = isSystemVar ? 'var-system' : 'var-user';
        return `<mark class="${bgClass}">${match}</mark>`;
      }
    );

    // Preserve whitespace and newlines
    return highlighted;
  };

  const handleChange = (e) => {
    onChange?.(e);
    syncScroll();
  };

  const handleScroll = () => {
    syncScroll();
  };

  return (
    <div 
      ref={containerRef}
      className="relative highlighted-textarea-container"
    >
      {/* CSS for highlight marks */}
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
        onScroll={handleScroll}
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
    </div>
  );
});

HighlightedTextarea.displayName = 'HighlightedTextarea';

export default HighlightedTextarea;
