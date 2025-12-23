import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Textarea } from "@/components/ui/textarea";
import HighlightedTextarea from "@/components/ui/highlighted-textarea";
import { Label } from "@/components/ui/label";
import { RotateCcw, Save, ClipboardCopy, Link2, Sparkles, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Info, GripHorizontal } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from '@/components/ui/sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import VariablePicker from './VariablePicker';
import { TOOLTIPS } from '@/config/labels';

const PromptField = ({ label, tooltip, value, onChange, onReset, onSave, onCascade, initialValue, onGenerate, isGenerating, formattedTime, isLinksPage, isReadOnly, hasUnsavedChanges, promptId, variables = [], placeholder }) => {
  const textareaRef = useRef(null);
  const containerRef = useRef(null);
  const [isLinking, setIsLinking] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [contentHeight, setContentHeight] = useState(100);
  const [manualHeight, setManualHeight] = useState(null);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);
  
  const storageKey = `promptField_expand_${promptId}_${label}`;
  
  // Default to collapsed for all fields
  const [expandState, setExpandState] = useState(() => {
    if (typeof window === 'undefined') return 'collapsed';
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && ['collapsed', 'min', 'full'].includes(stored)) {
        return stored;
      }
      return 'collapsed';
    } catch {
      return 'collapsed';
    }
  });
  
  const goToCollapsed = () => {
    setExpandState('collapsed');
    setManualHeight(null);
    localStorage.setItem(storageKey, 'collapsed');
  };
  
  const goToMin = () => {
    setExpandState('min');
    setManualHeight(null);
    localStorage.setItem(storageKey, 'min');
  };
  
  const goToFull = () => {
    setExpandState('full');
    setManualHeight(null);
    localStorage.setItem(storageKey, 'full');
  };

  // Mouse resize handlers
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    const currentHeight = containerRef.current?.querySelector('.resizable-content')?.offsetHeight || 100;
    resizeStartHeight.current = currentHeight;
  }, []);

  const handleResizeMove = useCallback((e) => {
    if (!isResizing) return;
    const deltaY = e.clientY - resizeStartY.current;
    const newHeight = Math.max(60, resizeStartHeight.current + deltaY);
    setManualHeight(newHeight);
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Calculate content height when in full mode
  useEffect(() => {
    if (expandState === 'full' && textareaRef.current) {
      const element = textareaRef.current;
      // For contenteditable divs
      if (element.scrollHeight) {
        setContentHeight(Math.max(100, element.scrollHeight));
      }
    }
  }, [expandState, value]);

  useEffect(() => {
    if (textareaRef.current && (label === 'Admin Result' || label === 'User Result')) {
      adjustHeight();
    }

    const handleMessage = (event) => {
      console.log('Response received from parent window:', event.data);
    };
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [value, label]);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Copied to clipboard');
    } catch (err) {
      console.error('Failed to copy: ', err);
      toast.error('Failed to copy');
    }
  };

  const handleSave = async () => {
    const fieldKey = label.toLowerCase().replace(' ', '_');
    const sourceInfo = {
      [fieldKey]: {
        parts: [
          {
            type: "user_input",
            text: value,
            order: 1
          }
        ],
        metadata: {
          created_at: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          part_count: 1
        }
      }
    };

    try {
      await onSave(sourceInfo);
      toast.success('Saved');
    } catch (err) {
      console.error('Failed to save: ', err);
      toast.error('Failed to save');
    }
  };

  const handleInsertVariable = (varName) => {
    const varText = `{{${varName}}}`;
    const currentValue = value || '';
    
    // Use stored cursor position (captured on blur or last interaction)
    const pos = cursorPosition ?? currentValue.length;
    const newValue = currentValue.slice(0, pos) + varText + currentValue.slice(pos);
    onChange(newValue);
    
    // Update cursor position to after inserted variable
    const newCursorPos = pos + varText.length;
    setCursorPosition(newCursorPos);
    
    // Restore focus and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        // For regular textarea
        if (typeof textareaRef.current.setSelectionRange === 'function') {
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }
    }, 0);
  };

  // Get cursor position from contenteditable or textarea
  const getCursorPositionFromElement = (element) => {
    // For regular textarea/input
    if (element.selectionStart !== undefined) {
      return element.selectionStart;
    }
    
    // For contenteditable (HighlightedTextarea)
    const selection = window.getSelection();
    if (!selection.rangeCount) return 0;
    
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    
    // Create a temporary div to get the text length
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(preCaretRange.cloneContents());
    
    // Handle br tags as newlines
    const brs = tempDiv.querySelectorAll('br');
    brs.forEach(br => br.replaceWith('\n'));
    
    return tempDiv.textContent?.length || 0;
  };

  // Capture cursor position on any interaction
  const handleCursorChange = (e) => {
    const pos = getCursorPositionFromElement(e.target);
    setCursorPosition(pos);
  };
  
  // Capture cursor position when textarea loses focus (before clicking variable picker)
  const handleBlur = (e) => {
    const pos = getCursorPositionFromElement(e.target);
    setCursorPosition(pos);
  };

  const ActionButton = ({ icon, onClick, tooltip, disabled, active, needsAttention = false }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            disabled={disabled}
            className={`h-7 w-7 p-0 transition-colors ${
              needsAttention
                ? 'animate-attention-flash rounded-md'
                : active 
                  ? '!text-primary !bg-transparent hover:!bg-muted/50' 
                  : '!text-muted-foreground hover:!text-foreground hover:!bg-muted/50'
            } ${disabled ? 'opacity-40' : ''}`}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  // Chevron button component for expand/collapse controls
  const ChevronButton = ({ icon: Icon, onClick, tooltipText }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            <Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  // Get textarea style based on expand state
  const getTextareaStyle = () => {
    if (manualHeight) {
      return 'overflow-auto';
    }
    if (expandState === 'min') {
      return 'min-h-[100px] max-h-[100px] overflow-auto';
    }
    return 'min-h-[100px]';
  };

  // Get dynamic height for full state or manual resize
  const getFullHeightStyle = () => {
    if (manualHeight) {
      return { height: `${manualHeight}px` };
    }
    if (expandState === 'full') {
      return { minHeight: `${Math.max(100, contentHeight)}px` };
    }
    return {};
  };

  return (
    <div 
      ref={containerRef}
      className={`
        rounded-lg border transition-all duration-200
        ${hasUnsavedChanges ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}
        ${isResizing ? 'select-none' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-1">
          {/* Dual chevron controls */}
          {expandState === 'collapsed' && (
            <>
              <ChevronButton 
                icon={ChevronDown} 
                onClick={goToMin} 
                tooltipText="Expand to minimum height" 
              />
              <ChevronButton 
                icon={ChevronsDown} 
                onClick={goToFull} 
                tooltipText="Expand to full height" 
              />
            </>
          )}
          {expandState === 'min' && (
            <>
              <ChevronButton 
                icon={ChevronUp} 
                onClick={goToCollapsed} 
                tooltipText="Collapse" 
              />
              <ChevronButton 
                icon={ChevronsDown} 
                onClick={goToFull} 
                tooltipText="Expand to full height" 
              />
            </>
          )}
          {expandState === 'full' && (
            <>
              <ChevronButton 
                icon={ChevronUp} 
                onClick={goToMin} 
                tooltipText="Reduce to minimum height" 
              />
              <ChevronButton 
                icon={ChevronsUp} 
                onClick={goToCollapsed} 
                tooltipText="Collapse" 
              />
            </>
          )}
          
          <Label htmlFor={label} className="text-sm font-medium text-foreground cursor-pointer ml-1">
            {label}
          </Label>
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {hasUnsavedChanges && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5">
          {(label === TOOLTIPS?.promptFields?.inputAdminPrompt?.label || label === TOOLTIPS?.promptFields?.inputUserPrompt?.label || label === 'Context Prompt' || label === 'User Message' || label === 'System Prompt') && !isLinksPage && (
            <div className="flex items-center mr-1">
              <ActionButton
                icon={<Sparkles className={`h-4 w-4 ${isGenerating ? 'animate-pulse' : ''}`} />}
                onClick={onGenerate}
                tooltip={isGenerating ? `Generating... ${formattedTime}` : 'Generate response'}
                disabled={isGenerating}
                active={isGenerating}
              />
              {isGenerating && (
                <span className="text-xs text-primary font-medium ml-1">{formattedTime}</span>
              )}
            </div>
          )}

          {/* Variable Picker for input prompts */}
          {(label === TOOLTIPS?.promptFields?.inputAdminPrompt?.label || label === TOOLTIPS?.promptFields?.inputUserPrompt?.label || label === 'Context Prompt' || label === 'User Message' || label === 'System Prompt') && !isReadOnly && (
            <VariablePicker 
              onInsert={handleInsertVariable}
              userVariables={variables}
            />
          )}

          <ActionButton
            icon={<Link2 className="h-4 w-4" />}
            onClick={() => onCascade(label)}
            tooltip="Cascade to children"
          />
          <ActionButton
            icon={<ClipboardCopy className="h-4 w-4" />}
            onClick={handleCopy}
            tooltip="Copy to clipboard"
          />
          
          {!isLinksPage && !isReadOnly && (
            <>
              <ActionButton
                icon={<Save className="h-4 w-4" />}
                onClick={handleSave}
                disabled={!hasUnsavedChanges}
                tooltip="Save changes"
                active={hasUnsavedChanges}
              />
              <ActionButton
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={onReset}
                disabled={!hasUnsavedChanges}
                tooltip="Reset changes"
                active={hasUnsavedChanges}
              />
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {expandState !== 'collapsed' && (
        <div className="p-3 pb-0">
          <div className="resizable-content">
            {(label === TOOLTIPS?.promptFields?.inputAdminPrompt?.label || label === TOOLTIPS?.promptFields?.inputUserPrompt?.label || label === 'Context Prompt' || label === 'User Message' || label === 'System Prompt') ? (
              <HighlightedTextarea
                id={label}
                value={value}
                onChange={(e) => {
                  if (!isReadOnly) {
                    onChange(e.target.value);
                  }
                  handleCursorChange(e);
                }}
                onSelect={handleCursorChange}
                onClick={handleCursorChange}
                onKeyUp={handleCursorChange}
                onBlur={handleBlur}
                className={`w-full bg-background ${getTextareaStyle()}`}
                style={getFullHeightStyle()}
                rows={4}
                ref={textareaRef}
                readOnly={isReadOnly}
                placeholder={placeholder || undefined}
                userVariables={variables}
              />
            ) : (
              <Textarea
                id={label}
                value={value}
                onChange={(e) => {
                  if (!isReadOnly) {
                    onChange(e.target.value);
                  }
                  if (label === TOOLTIPS?.promptFields?.adminResult?.label || label === TOOLTIPS?.promptFields?.userResult?.label || label === 'System Response' || label === 'AI Response') {
                    e.target.style.height = 'auto';
                  }
                  handleCursorChange(e);
                }}
                onSelect={handleCursorChange}
                onClick={handleCursorChange}
                onKeyUp={handleCursorChange}
                onBlur={handleBlur}
                className={`w-full border-border bg-background focus:ring-primary focus:border-primary ${getTextareaStyle()}`}
                style={getFullHeightStyle()}
                rows={4}
                ref={textareaRef}
                readOnly={isReadOnly}
                placeholder={placeholder || undefined}
              />
            )}
          </div>
          
          {/* Bottom controls - resize handle and chevrons */}
          <div className="flex items-center justify-between pt-2 pb-2 mt-2 border-t border-border/50">
            {/* Chevron controls */}
            <div className="flex items-center gap-1">
              {expandState === 'full' && (
                <>
                  <ChevronButton 
                    icon={ChevronUp} 
                    onClick={goToMin} 
                    tooltipText="Reduce to minimum height" 
                  />
                  <ChevronButton 
                    icon={ChevronsUp} 
                    onClick={goToCollapsed} 
                    tooltipText="Collapse" 
                  />
                </>
              )}
              {expandState === 'min' && (
                <>
                  <ChevronButton 
                    icon={ChevronsDown} 
                    onClick={goToFull} 
                    tooltipText="Expand to full height" 
                  />
                </>
              )}
              {manualHeight && (
                <span className="text-[10px] text-muted-foreground ml-1">Custom height</span>
              )}
            </div>
            
            {/* Resize handle */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    onMouseDown={handleResizeStart}
                    className="flex items-center justify-center px-2 py-1 cursor-ns-resize hover:bg-muted/50 rounded transition-colors group"
                  >
                    <GripHorizontal className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Drag to resize
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptField;
