import React, { useState, useEffect } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Save, RotateCcw, Copy } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const TextAreaWithIcons = ({ placeholder, value, fieldName, onSave, onReset, readOnly }) => {
  const [text, setText] = useState(value || '');

  useEffect(() => {
    setText(value || '');
  }, [value]);

  const handleSave = () => onSave(fieldName, text);
  const handleReset = async () => {
    const resetValue = await onReset(fieldName);
    if (resetValue !== null) setText(resetValue);
  };
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard');
    }).catch((err) => {
      console.error('Failed to copy text: ', err);
      toast.error('Failed to copy text');
    });
  };

  return (
    <div className="relative mb-4">
      <div className="absolute top-2 right-2 z-10 flex space-x-1">
        <IconButton icon={<Copy />} onClick={handleCopy} tooltip="Copy to clipboard" />
        <IconButton icon={<Save />} onClick={handleSave} tooltip="Save changes" />
        <IconButton icon={<RotateCcw />} onClick={handleReset} tooltip="Reset to last saved" />
      </div>
      <Textarea 
        placeholder={placeholder} 
        className="w-full p-2 pr-24 border rounded" 
        value={text}
        onChange={(e) => setText(e.target.value)}
        readOnly={readOnly}
      />
    </div>
  );
};

const IconButton = ({ icon, onClick, tooltip }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0"
          onClick={(e) => {
            e.stopPropagation();
            onClick(e);
          }}
        >
          {React.cloneElement(icon, { className: "h-4 w-4" })}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export default TextAreaWithIcons;