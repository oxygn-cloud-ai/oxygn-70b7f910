import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Bold, Italic, List, ListOrdered, Link, Code, 
  ChevronUp, ChevronDown, Eye, Edit3, Heading1, Heading2, Heading3, ChevronDown as DropdownIcon
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

// Heading dropdown component
const HeadingDropdown = ({ onSelect }) => {
  const [open, setOpen] = useState(false);
  
  const headings = [
    { label: "Heading 1", prefix: "# ", icon: Heading1 },
    { label: "Heading 2", prefix: "## ", icon: Heading2 },
    { label: "Heading 3", prefix: "### ", icon: Heading3 },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-6 px-1.5 flex items-center gap-0.5 rounded-m3-sm text-on-surface-variant hover:bg-on-surface/[0.08] hover:text-on-surface transition-colors"
        >
          <Heading1 className="h-3.5 w-3.5" />
          <DropdownIcon className="h-2.5 w-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-32 p-1 bg-surface-container-high border-outline-variant" align="start">
        {headings.map(({ label, prefix, icon: Icon }) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              onSelect(prefix);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-m3-sm text-body-sm text-on-surface hover:bg-on-surface/[0.08] transition-colors"
          >
            <Icon className="h-3.5 w-3.5 text-on-surface-variant" />
            {label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};

/**
 * MarkdownNotesArea - A rich text notes field with markdown support
 * Features: formatting toolbar, live preview while editing, collapsible
 */
const MarkdownNotesArea = ({ 
  label = "Notes",
  value, 
  placeholder = "Add notes...",
  onChange,
  defaultHeight = MIN_HEIGHT,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [localValue, setLocalValue] = useState(value || "");
  const textareaRef = useRef(null);

  // Sync with external value
  useEffect(() => {
    setLocalValue(value || "");
  }, [value]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

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

  // Insert heading at line start
  const insertHeading = useCallback((prefix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    // Find the start of the current line
    const lineStart = localValue.lastIndexOf("\n", start - 1) + 1;
    
    // Check if line already has a heading prefix and remove it
    const lineContent = localValue.substring(lineStart);
    const existingHeadingMatch = lineContent.match(/^#{1,3}\s*/);
    
    let newValue;
    if (existingHeadingMatch) {
      // Replace existing heading
      newValue = 
        localValue.substring(0, lineStart) + 
        prefix + 
        lineContent.substring(existingHeadingMatch[0].length);
    } else {
      // Insert new heading
      newValue = 
        localValue.substring(0, lineStart) + 
        prefix + 
        localValue.substring(lineStart);
    }
    
    setLocalValue(newValue);
    onChange?.(newValue);

    setTimeout(() => {
      textarea.focus();
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

  const handleContentClick = () => {
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  const handleBlur = (e) => {
    // Don't exit edit mode if clicking on toolbar
    if (e.relatedTarget?.closest('[data-toolbar]')) {
      return;
    }
    setIsEditing(false);
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
          <div className="flex items-center gap-0.5" data-toolbar>
            {/* Formatting toolbar - always visible */}
            <div className="flex items-center gap-0.5 mr-2 pr-2 border-r border-outline-variant">
              <HeadingDropdown onSelect={insertHeading} />
              <ToolbarButton icon={Bold} onClick={handleBold} tooltipText="Bold (Ctrl+B)" />
              <ToolbarButton icon={Italic} onClick={handleItalic} tooltipText="Italic (Ctrl+I)" />
              <ToolbarButton icon={List} onClick={handleBulletList} tooltipText="Bullet list" />
              <ToolbarButton icon={ListOrdered} onClick={handleNumberedList} tooltipText="Numbered list" />
              <ToolbarButton icon={Link} onClick={handleLink} tooltipText="Insert link" />
              <ToolbarButton icon={Code} onClick={handleCode} tooltipText="Inline code" />
            </div>
            
            {/* Edit/Preview toggle */}
            <ToolbarButton 
              icon={isEditing ? Eye : Edit3} 
              onClick={() => setIsEditing(!isEditing)} 
              tooltipText={isEditing ? "Preview" : "Edit"}
              active={isEditing}
            />
          </div>
        )}
      </div>

      {/* Content area */}
      {!isCollapsed && (
        <div 
          className="bg-surface-container rounded-m3-sm border border-outline-variant overflow-hidden cursor-text"
          style={{ minHeight: defaultHeight }}
          onClick={handleContentClick}
        >
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={localValue}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder={placeholder}
              className="w-full p-3 bg-transparent text-body-sm text-on-surface placeholder:text-on-surface-variant/50 resize-y focus:outline-none"
              style={{ minHeight: defaultHeight }}
            />
          ) : (
            <div className="p-3 min-h-[80px]">
              {hasContent ? (
                <div className="prose prose-sm max-w-none text-on-surface prose-p:my-1 prose-p:text-body-sm prose-headings:text-on-surface prose-headings:font-medium prose-headings:mt-2 prose-headings:mb-1 prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-li:text-body-sm prose-a:text-primary prose-code:text-primary prose-code:bg-surface-container-high prose-code:px-1 prose-code:rounded prose-strong:text-on-surface prose-em:text-on-surface">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {localValue}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-body-sm text-on-surface-variant/50 italic">
                  {placeholder}
                </p>
              )}
            </div>
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
