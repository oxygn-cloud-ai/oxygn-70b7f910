import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Bold, Italic, List, ListOrdered, Link, Code, 
  ChevronUp, ChevronDown, Eye, Edit3
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const MIN_HEIGHT = 80;

// Toolbar button component
const ToolbarButton = ({ icon: Icon, onClick, tooltipText, active = false }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        onClick={onClick}
        className={`w-6 h-6 flex items-center justify-center rounded-m3-sm transition-colors ${
          active 
            ? "bg-primary/20 text-primary" 
            : "text-on-surface-variant hover:bg-on-surface/[0.08] hover:text-on-surface"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="text-[10px]">{tooltipText}</TooltipContent>
  </Tooltip>
);

/**
 * MarkdownNotesArea - A rich text notes field with markdown support
 * Features: formatting toolbar, preview mode, collapsible
 */
const MarkdownNotesArea = ({ 
  label = "Notes",
  value, 
  placeholder = "Add notes...",
  onChange,
  defaultHeight = MIN_HEIGHT,
}) => {
  const [isPreview, setIsPreview] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [localValue, setLocalValue] = useState(value || "");
  const textareaRef = useRef(null);

  // Sync with external value
  useEffect(() => {
    setLocalValue(value || "");
  }, [value]);

  // Insert markdown formatting at cursor position
  const insertFormatting = useCallback((prefix, suffix = "", placeholder = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = localValue.substring(start, end);
    const textToInsert = selectedText || placeholder;
    
    const newValue = 
      localValue.substring(0, start) + 
      prefix + textToInsert + suffix + 
      localValue.substring(end);
    
    setLocalValue(newValue);
    onChange?.(newValue);

    // Restore focus and selection
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + textToInsert.length;
      textarea.setSelectionRange(
        selectedText ? newCursorPos + suffix.length : start + prefix.length,
        selectedText ? newCursorPos + suffix.length : start + prefix.length + textToInsert.length
      );
    }, 0);
  }, [localValue, onChange]);

  const handleBold = () => insertFormatting("**", "**", "bold text");
  const handleItalic = () => insertFormatting("*", "*", "italic text");
  const handleBulletList = () => insertFormatting("\n- ", "", "list item");
  const handleNumberedList = () => insertFormatting("\n1. ", "", "list item");
  const handleLink = () => insertFormatting("[", "](url)", "link text");
  const handleCode = () => insertFormatting("`", "`", "code");

  const handleChange = (e) => {
    setLocalValue(e.target.value);
    onChange?.(e.target.value);
  };

  const hasContent = localValue?.trim().length > 0;

  return (
    <div className="space-y-1.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="w-5 h-5 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]"
              >
                {isCollapsed ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronUp className="h-3.5 w-3.5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">
              {isCollapsed ? "Expand" : "Collapse"}
            </TooltipContent>
          </Tooltip>
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">
            {label}
          </span>
        </div>

        {/* Right side controls */}
        {!isCollapsed && (
          <div className="flex items-center gap-0.5">
            {/* Formatting toolbar */}
            <div className="flex items-center gap-0.5 mr-2 pr-2 border-r border-outline-variant">
              <ToolbarButton icon={Bold} onClick={handleBold} tooltipText="Bold (Ctrl+B)" />
              <ToolbarButton icon={Italic} onClick={handleItalic} tooltipText="Italic (Ctrl+I)" />
              <ToolbarButton icon={List} onClick={handleBulletList} tooltipText="Bullet list" />
              <ToolbarButton icon={ListOrdered} onClick={handleNumberedList} tooltipText="Numbered list" />
              <ToolbarButton icon={Link} onClick={handleLink} tooltipText="Insert link" />
              <ToolbarButton icon={Code} onClick={handleCode} tooltipText="Inline code" />
            </div>
            
            {/* Preview toggle */}
            <ToolbarButton 
              icon={isPreview ? Edit3 : Eye} 
              onClick={() => setIsPreview(!isPreview)} 
              tooltipText={isPreview ? "Edit" : "Preview"}
              active={isPreview}
            />
          </div>
        )}
      </div>

      {/* Content area */}
      {!isCollapsed && (
        <div 
          className="bg-surface-container rounded-m3-sm border border-outline-variant overflow-hidden"
          style={{ minHeight: defaultHeight }}
        >
          {isPreview ? (
            <div className="p-3 min-h-[80px]">
              {hasContent ? (
                <div className="prose prose-sm max-w-none text-on-surface prose-p:my-1 prose-p:text-body-sm prose-headings:text-on-surface prose-headings:font-medium prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-li:text-body-sm prose-a:text-primary prose-code:text-primary prose-code:bg-surface-container-high prose-code:px-1 prose-code:rounded">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {localValue}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-body-sm text-on-surface-variant/50 italic">
                  No notes yet
                </p>
              )}
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={localValue}
              onChange={handleChange}
              placeholder={placeholder}
              className="w-full p-3 bg-transparent text-body-sm text-on-surface placeholder:text-on-surface-variant/50 resize-y focus:outline-none"
              style={{ minHeight: defaultHeight }}
            />
          )}
        </div>
      )}

      {/* Collapsed preview */}
      {isCollapsed && hasContent && (
        <div 
          className="px-3 py-2 bg-surface-container rounded-m3-sm border border-outline-variant cursor-pointer hover:bg-surface-container-high transition-colors"
          onClick={() => setIsCollapsed(false)}
        >
          <p className="text-body-sm text-on-surface-variant line-clamp-1">
            {localValue.substring(0, 100)}...
          </p>
        </div>
      )}
    </div>
  );
};

export default MarkdownNotesArea;
