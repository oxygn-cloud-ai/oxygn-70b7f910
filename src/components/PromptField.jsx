import React, { useEffect, useRef, useState } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RotateCcw, Save, ClipboardCopy, ClipboardPaste, Link, SmilePlus, BrainCircuit } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';

const PromptField = ({ label, value, onChange, onReset, onSave, onCascade, initialValue, onGenerate, isGenerating, formattedTime }) => {
  const hasChanged = value !== initialValue;
  const textareaRef = useRef(null);
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    if (textareaRef.current && (label === 'Admin Result' || label === 'User Result')) {
      adjustHeight();
    }
  }, [value, label]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data.type === 'CHATINPUT_FOCUS_RESULT') {
        if (event.data.success) {
          toast.success('Notes content copied to target field');
        } else {
          toast.error('Failed to focus on target field');
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

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
      toast.success('Content copied to clipboard');
    } catch (err) {
      console.error('Failed to copy: ', err);
      toast.error('Failed to copy content');
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text);
      toast.success('Content pasted from clipboard');
    } catch (err) {
      console.error('Failed to paste: ', err);
      toast.error('Failed to paste content');
    }
  };

  const handleSmilePlusClick = () => {
    if (label === 'Notes') {
      window.parent.postMessage({
        type: 'FOCUS_CHATINPUT',
        value: value
      }, '*');
      
      console.log('SmilePlus Button Clicked');
      console.log('Call Details:');
      console.log('Label:', label);
      console.log('Value:', value);
      console.log('Action:', 'Sent message to parent window');

      // New code to attempt pasting directly
      const chatInput = window.parent.document.querySelector('#chatinput');
      if (chatInput) {
        chatInput.focus();
        chatInput.setRangeText(value, chatInput.selectionStart, chatInput.selectionEnd, 'end');
        chatInput.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('Attempted to paste text directly into #chatinput');
      } else {
        console.error('#chatinput element not found in parent window');
      }
    }
  };

  const renderLabel = () => {
    if (label === 'Input Admin Prompt' || label === 'Input User Prompt') {
      return (
        <div className="flex items-center">
          <span>{label}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onGenerate}
            className="ml-2 p-0"
            title="Generate"
          >
            <BrainCircuit className="h-4 w-4 text-green-700" />
          </Button>
          {isGenerating && (
            <span className="ml-2 text-xs text-green-700">{formattedTime}</span>
          )}
        </div>
      );
    }
    return (
      <div className="flex items-center">
        <span>{label}</span>
      </div>
    );
  };

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <Label htmlFor={label}>{renderLabel()}</Label>
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSmilePlusClick}
            className="h-6 w-6 text-green-700"
            title="SmilePlus"
          >
            <SmilePlus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onMouseDown={() => setIsLinking(true)}
            onMouseUp={() => setIsLinking(false)}
            onMouseLeave={() => setIsLinking(false)}
            onClick={onCascade}
            className={`h-6 w-6 text-green-700 ${isLinking ? 'cursor-alias' : ''}`}
            title="Cascade"
          >
            <Link className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-6 w-6 text-green-700"
            title="Copy to clipboard"
          >
            <ClipboardCopy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePaste}
            className="h-6 w-6 text-green-700"
            title="Paste from clipboard"
          >
            <ClipboardPaste className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSave}
            disabled={!hasChanged}
            className={`h-6 w-6 ${hasChanged ? 'text-green-700' : ''}`}
            title="Save changes"
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onReset}
            disabled={!hasChanged}
            className={`h-6 w-6 ${hasChanged ? 'text-green-700' : ''}`}
            title="Reset to initial value"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Textarea
        id={label}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (label === 'Admin Result' || label === 'User Result') {
            e.target.style.height = 'auto';
          }
        }}
        className="w-full mt-1"
        rows={4}
        ref={textareaRef}
      />
    </div>
  );
};

export default PromptField;
