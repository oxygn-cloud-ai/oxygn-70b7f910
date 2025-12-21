import React, { useEffect, useRef, useState } from 'react';
import { Textarea } from "@/components/ui/textarea";
import HighlightedTextarea from "@/components/ui/highlighted-textarea";
import { Label } from "@/components/ui/label";
import { RotateCcw, Save, ClipboardCopy, Link2, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from '@/components/ui/sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import VariablePicker from './VariablePicker';

const PromptField = ({ label, value, onChange, onReset, onSave, onCascade, initialValue, onGenerate, isGenerating, formattedTime, isLinksPage, isReadOnly, hasUnsavedChanges, promptId, variables = [] }) => {
  const textareaRef = useRef(null);
  const [isLinking, setIsLinking] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  
  const storageKey = `promptField_collapsed_${promptId}_${label}`;
  
  // Default to expanded (false) for better UX
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored !== null ? JSON.parse(stored) : false;
  });
  
  const handleToggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem(storageKey, JSON.stringify(newState));
  };

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
    const pos = cursorPosition || currentValue.length;
    const newValue = currentValue.slice(0, pos) + varText + currentValue.slice(pos);
    onChange(newValue);
    setCursorPosition(pos + varText.length);
  };

  const handleCursorChange = (e) => {
    setCursorPosition(e.target.selectionStart);
  };

  const ActionButton = ({ icon, onClick, tooltip, disabled, active, variant = 'default' }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            disabled={disabled}
            className={`
              h-7 w-7 p-0 transition-all
              ${active ? 'text-primary hover:text-primary/80' : 'text-muted-foreground hover:text-foreground'}
              ${variant === 'generate' ? 'hover:bg-primary/10' : 'hover:bg-muted'}
              ${disabled ? 'opacity-40' : ''}
            `}
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

  return (
    <div className={`
      rounded-lg border transition-all duration-200
      ${hasUnsavedChanges ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleCollapse}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          <Label htmlFor={label} className="text-sm font-medium text-foreground cursor-pointer">
            {label}
          </Label>
          {hasUnsavedChanges && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5">
          {(label === 'Input Admin Prompt' || label === 'Input User Prompt') && !isLinksPage && (
            <div className="flex items-center mr-1">
              <ActionButton
                icon={<Sparkles className={`h-4 w-4 ${isGenerating ? 'animate-pulse' : ''}`} />}
                onClick={onGenerate}
                tooltip={isGenerating ? `Generating... ${formattedTime}` : 'Generate response'}
                disabled={isGenerating}
                variant="generate"
                active={true}
              />
              {isGenerating && (
                <span className="text-xs text-primary font-medium ml-1">{formattedTime}</span>
              )}
            </div>
          )}

          {/* Variable Picker for input prompts */}
          {(label === 'Input Admin Prompt' || label === 'Input User Prompt') && !isReadOnly && (
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
      {!isCollapsed && (
        <div className="p-3">
          {(label === 'Input Admin Prompt' || label === 'Input User Prompt') ? (
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
              className="w-full min-h-[100px] bg-background"
              rows={4}
              ref={textareaRef}
              readOnly={isReadOnly}
              placeholder={`Enter ${label.toLowerCase()}...`}
            />
          ) : (
            <Textarea
              id={label}
              value={value}
              onChange={(e) => {
                if (!isReadOnly) {
                  onChange(e.target.value);
                }
                if (label === 'Admin Result' || label === 'User Result') {
                  e.target.style.height = 'auto';
                }
                handleCursorChange(e);
              }}
              onSelect={handleCursorChange}
              onClick={handleCursorChange}
              onKeyUp={handleCursorChange}
              className="w-full min-h-[100px] resize-y border-border bg-background focus:ring-primary focus:border-primary"
              rows={4}
              ref={textareaRef}
              readOnly={isReadOnly}
              placeholder={`Enter ${label.toLowerCase()}...`}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default PromptField;
