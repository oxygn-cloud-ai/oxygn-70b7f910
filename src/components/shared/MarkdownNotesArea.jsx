import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Link as LinkIcon, 
  Code,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Heading1,
  Heading2,
  Heading3,
  Type,
  Check
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/sonner';

// Toolbar button component
const ToolbarButton = ({ icon: Icon, tooltip, onClick, active = false, disabled = false }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`w-6 h-6 flex items-center justify-center rounded-m3-sm transition-colors ${
          active
            ? 'bg-primary/10 text-primary'
            : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="text-[10px]">
      {tooltip}
    </TooltipContent>
  </Tooltip>
);

// Heading dropdown component
const HeadingDropdown = ({ editor }) => {
  const getCurrentHeading = () => {
    if (editor?.isActive('heading', { level: 1 })) return { label: 'H1', icon: Heading1 };
    if (editor?.isActive('heading', { level: 2 })) return { label: 'H2', icon: Heading2 };
    if (editor?.isActive('heading', { level: 3 })) return { label: 'H3', icon: Heading3 };
    return { label: 'Text', icon: Type };
  };

  const current = getCurrentHeading();
  const CurrentIcon = current.icon;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-6 px-1.5 flex items-center gap-1 rounded-m3-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
            >
              <CurrentIcon className="h-3.5 w-3.5" />
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[10px]">
          Text Style
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="min-w-[100px] bg-surface-container-high border-outline-variant">
        <DropdownMenuItem
          onClick={() => editor?.chain().focus().setParagraph().run()}
          className="text-body-sm text-on-surface cursor-pointer"
        >
          <Type className="h-3.5 w-3.5 mr-2" />
          Normal
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          className="text-body-sm text-on-surface cursor-pointer"
        >
          <Heading1 className="h-3.5 w-3.5 mr-2" />
          Heading 1
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          className="text-body-sm text-on-surface cursor-pointer"
        >
          <Heading2 className="h-3.5 w-3.5 mr-2" />
          Heading 2
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          className="text-body-sm text-on-surface cursor-pointer"
        >
          <Heading3 className="h-3.5 w-3.5 mr-2" />
          Heading 3
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/**
 * MarkdownNotesArea - A WYSIWYG notes editor using Tiptap
 * Features: formatting toolbar, real-time editing, collapsible, explicit save
 */
const MarkdownNotesArea = ({
  value = '',
  onChange,
  onSave,
  placeholder = 'Add notes...',
  label = 'Notes',
  defaultHeight = 80,
  readOnly = false, // When true, disables editing
  storageKey, // Optional key to persist collapsed state in localStorage
}) => {
  // Generate storage key from label if not provided
  const persistKey = storageKey || (label ? `qonsol-notes-collapsed-${label.toLowerCase().replace(/\s+/g, '-')}` : null);
  
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (persistKey) {
      try {
        const saved = localStorage.getItem(persistKey);
        if (saved !== null) {
          return saved === 'true';
        }
      } catch {}
    }
    return false;
  });
  const [localValue, setLocalValue] = useState(value || '');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const isInternalChange = useRef(false); // Track internal vs external changes

  // Persist collapsed state to localStorage
  useEffect(() => {
    if (persistKey) {
      localStorage.setItem(persistKey, String(isCollapsed));
    }
  }, [persistKey, isCollapsed]);

  // Sync local value when prop changes (external update)
  useEffect(() => {
    setLocalValue(value || '');
    setHasUnsavedChanges(false);
  }, [value]);

  const handleSave = useCallback(() => {
    if (hasUnsavedChanges && onSave) {
      onSave(localValue);
      setHasUnsavedChanges(false);
      toast.success('Notes saved');
    }
  }, [localValue, hasUnsavedChanges, onSave]);

  // Keyboard shortcut for save (Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: localValue || '',
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      if (readOnly) return;
      
      // Mark as internal change to prevent sync effect from resetting
      isInternalChange.current = true;
      
      const html = editor.getHTML();
      // Return empty string if editor only contains empty paragraph
      const isEmpty = html === '<p></p>' || html === '';
      const newValue = isEmpty ? '' : html;
      
      setLocalValue(newValue);
      
      // Track unsaved changes
      const originalIsEmpty = !value || value === '<p></p>';
      const newIsEmpty = !newValue || newValue === '<p></p>';
      
      if (originalIsEmpty && newIsEmpty) {
        setHasUnsavedChanges(false);
      } else {
        setHasUnsavedChanges(newValue !== value);
      }
      
      // Notify parent of local change (for tracking purposes only)
      onChange?.(newValue);
    },
    onBlur: () => {
      // Auto-save on blur if there are unsaved changes
      if (hasUnsavedChanges && onSave && !readOnly) {
        onSave(localValue);
        setHasUnsavedChanges(false);
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[80px] text-body-sm text-on-surface prose-p:my-1 prose-headings:text-on-surface prose-headings:font-medium prose-headings:mt-2 prose-headings:mb-1 prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-a:text-primary prose-code:text-primary prose-code:bg-surface-container-high prose-code:px-1 prose-code:rounded prose-strong:text-on-surface prose-em:text-on-surface',
      },
    },
  });

  // Sync external value changes to editor
  useEffect(() => {
    // Skip if this is an internal change (user editing)
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    
    if (editor && value !== editor.getHTML()) {
      const currentValue = editor.getHTML();
      const isEmpty = currentValue === '<p></p>' || currentValue === '';
      const newIsEmpty = !value || value === '<p></p>';
      
      // Only update if values are actually different
      if (isEmpty !== newIsEmpty || (!isEmpty && value !== currentValue)) {
        editor.commands.setContent(value || '');
        setLocalValue(value || '');
        setHasUnsavedChanges(false);
      }
    }
  }, [value, editor]);

  const handleAddLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor?.chain().focus().setLink({ href: url }).run();
    }
  };

  const handleRemoveLink = () => {
    editor?.chain().focus().unsetLink().run();
  };

  const hasContent = localValue && localValue !== '<p></p>' && localValue.trim() !== '';

  // Get plain text preview for collapsed state
  const getPlainTextPreview = () => {
    if (!localValue) return '';
    return localValue.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 100);
  };

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
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronUp className="h-3.5 w-3.5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">
              {isCollapsed ? 'Expand' : 'Collapse'}
            </TooltipContent>
          </Tooltip>
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">
            {label}
          </span>
          {/* Unsaved changes indicator */}
          {hasUnsavedChanges && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </div>

        {/* Toolbar - visible when not collapsed and not readOnly */}
        {!isCollapsed && !readOnly && (
          <div className="flex items-center gap-0.5" data-toolbar>
            {/* Save button - only show when there are unsaved changes */}
            {hasUnsavedChanges && onSave && (
              <>
                <ToolbarButton
                  icon={Check}
                  tooltip="Save (Ctrl+S)"
                  onClick={handleSave}
                  active={true}
                />
                <div className="w-px h-4 bg-outline-variant mx-1" />
              </>
            )}
            
            <HeadingDropdown editor={editor} />
            
            <div className="w-px h-4 bg-outline-variant mx-1" />
            
            <ToolbarButton
              icon={Bold}
              tooltip="Bold (Ctrl+B)"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              active={editor?.isActive('bold')}
            />
            <ToolbarButton
              icon={Italic}
              tooltip="Italic (Ctrl+I)"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              active={editor?.isActive('italic')}
            />
            
            <div className="w-px h-4 bg-outline-variant mx-1" />
            
            <ToolbarButton
              icon={List}
              tooltip="Bullet List"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              active={editor?.isActive('bulletList')}
            />
            <ToolbarButton
              icon={ListOrdered}
              tooltip="Numbered List"
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              active={editor?.isActive('orderedList')}
            />
            
            <div className="w-px h-4 bg-outline-variant mx-1" />
            
            <ToolbarButton
              icon={LinkIcon}
              tooltip={editor?.isActive('link') ? 'Remove Link' : 'Add Link'}
              onClick={editor?.isActive('link') ? handleRemoveLink : handleAddLink}
              active={editor?.isActive('link')}
            />
            <ToolbarButton
              icon={Code}
              tooltip="Code"
              onClick={() => editor?.chain().focus().toggleCode().run()}
              active={editor?.isActive('code')}
            />
          </div>
        )}
      </div>

      {/* Editor content */}
      {!isCollapsed && (
        <div 
          className={`bg-surface-container rounded-m3-sm border overflow-hidden transition-colors ${
            hasUnsavedChanges ? 'border-primary/50' : 'border-outline-variant'
          }`}
          style={{ minHeight: defaultHeight }}
        >
          <div className="p-3">
            <EditorContent 
              editor={editor} 
              className="tiptap-editor [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.is-editor-empty:first-child::before]:text-on-surface-variant/50 [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:pointer-events-none"
            />
          </div>
        </div>
      )}

      {/* Collapsed preview */}
      {isCollapsed && hasContent && (
        <div 
          className="px-3 py-2 bg-surface-container rounded-m3-sm border border-outline-variant cursor-pointer hover:bg-surface-container-high transition-colors"
          onClick={() => setIsCollapsed(false)}
        >
          <p className="text-body-sm text-on-surface-variant line-clamp-1">
            {getPlainTextPreview()}...
          </p>
        </div>
      )}
    </div>
  );
};

export default MarkdownNotesArea;
