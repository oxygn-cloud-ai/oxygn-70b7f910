import React, { useState, useEffect } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, RotateCcw, Copy } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useSaveField } from '../hooks/useSaveField';
import { useFetchLatestData } from '../hooks/useFetchLatestData';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const TextAreaWithIcons = ({ placeholder, value, fieldName, onSave, onReset, readOnly }) => {
  const [text, setText] = useState(value || '');

  useEffect(() => {
    setText(value || '');
  }, [value]);

  const handleSave = () => {
    onSave(fieldName, text);
  };

  const handleReset = async () => {
    const resetValue = await onReset(fieldName);
    if (resetValue !== null) {
      setText(resetValue);
    }
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
      <div className="absolute top-2 left-2 z-10 flex space-x-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Copy to clipboard</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSave}>
                <Save className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Save changes</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Reset to last saved</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Textarea 
        placeholder={placeholder} 
        className="w-full p-2 pl-24 border rounded" 
        value={text}
        onChange={(e) => setText(e.target.value)}
        readOnly={readOnly}
      />
    </div>
  );
};

const ProjectPanels = ({ selectedItemData, projectRowId, onDataChange }) => {
  const { saveField, isSaving } = useSaveField(projectRowId);
  const { fetchLatestData, isLoading } = useFetchLatestData(projectRowId);
  const [localData, setLocalData] = useState(selectedItemData || {});

  useEffect(() => {
    setLocalData(selectedItemData || {});
  }, [selectedItemData]);

  const handleSave = async (fieldName, value) => {
    if (projectRowId) {
      await saveField(fieldName, value);
      setLocalData(prevData => {
        const newData = { ...prevData, [fieldName]: value };
        onDataChange(newData);
        return newData;
      });
    }
  };

  const handleReset = async (fieldName) => {
    if (projectRowId) {
      const latestData = await fetchLatestData();
      if (latestData !== null) {
        setLocalData(prevData => {
          const newData = { ...prevData, ...latestData };
          onDataChange(newData);
          return newData;
        });
        return latestData[fieldName];
      }
    }
    return null;
  };

  const handleGeneratePrompts = () => {
    // Placeholder for future implementation
    console.log("Generate Prompts clicked");
    toast.info("Generate Prompts functionality is not implemented yet.");
  };

  if (!projectRowId) {
    return <div>No project selected</div>;
  }

  const textAreaFields = [
    { name: 'admin_prompt_result', placeholder: 'Admin Prompt' },
    { name: 'user_prompt_result', placeholder: 'User Prompt' },
    { name: 'input_admin_prompt', placeholder: 'Input Admin Prompt' },
    { name: 'input_user_prompt', placeholder: 'Input User Prompt' }
  ];

  const promptSettingsFields = [
    'model', 'temperature', 'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty',
    'stop', 'n', 'logit_bias', 'user', 'stream', 'best_of', 'logprobs', 'echo', 'suffix',
    'temperature_scaling', 'prompt_tokens', 'response_tokens', 'batch_size',
    'learning_rate_multiplier', 'n_epochs', 'validation_file', 'training_file', 'engine',
    'input', 'context_length', 'custom_finetune'
  ];

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] overflow-auto p-4">
      <Button variant="link" onClick={handleGeneratePrompts} className="self-start mb-2">
        Generate Prompts
      </Button>
      {textAreaFields.map(field => (
        <TextAreaWithIcons
          key={field.name}
          placeholder={field.placeholder}
          value={localData[field.name] || ''}
          fieldName={field.name}
          onSave={handleSave}
          onReset={handleReset}
          readOnly={false}
        />
      ))}
      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Prompt Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          {promptSettingsFields.map(field => (
            <div key={field} className="flex flex-col">
              <Label htmlFor={field}>{field}</Label>
              <Input
                id={field}
                value={localData[field] || ''}
                onChange={(e) => setLocalData(prev => ({ ...prev, [field]: e.target.value }))}
                onBlur={() => handleSave(field, localData[field])}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectPanels;
