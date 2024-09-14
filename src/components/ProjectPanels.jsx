import React, { useState, useEffect } from 'react';
import { Textarea } from "@/components/ui/textarea";
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

const ProjectPanels = ({ selectedItemData, projectRowId }) => {
  const { saveField, isSaving } = useSaveField(projectRowId);
  const { fetchLatestData, isLoading } = useFetchLatestData(projectRowId);
  const [localData, setLocalData] = useState(selectedItemData || {});

  useEffect(() => {
    setLocalData(selectedItemData || {});
  }, [selectedItemData]);

  const handleSave = async (fieldName, value) => {
    if (projectRowId) {
      await saveField(fieldName, value);
      setLocalData(prevData => ({ ...prevData, [fieldName]: value }));
    }
  };

  const handleReset = async (fieldName) => {
    if (projectRowId) {
      const latestValue = await fetchLatestData(fieldName);
      if (latestValue !== null) {
        setLocalData(prevData => ({ ...prevData, [fieldName]: latestValue }));
      }
      return latestValue;
    }
    return null;
  };

  if (!projectRowId) {
    return <div>No project selected</div>;
  }

  const fields = [
    { name: 'admin_prompt_result', placeholder: 'Admin Prompt' },
    { name: 'user_prompt_result', placeholder: 'User Prompt' },
    { name: 'input_admin_prompt', placeholder: 'Input Admin Prompt' },
    { name: 'input_user_prompt', placeholder: 'Input User Prompt' },
    { name: 'prompt_settings', placeholder: 'Prompt Settings' },
  ];

  const promptSettingsFields = [
    'project_id', 'admin_prompt_result', 'user_prompt_result', 'input_admin_prompt', 'input_user_prompt',
    'level', 'model', 'temperature', 'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'stop',
    'n', 'logit_bias', 'user', 'stream', 'best_of', 'logprobs', 'echo', 'suffix', 'temperature_scaling',
    'prompt_tokens', 'response_tokens', 'batch_size', 'learning_rate_multiplier', 'created',
    'project_row_id', 'parent_row_id', 'prompt_name', 'n_epochs', 'validation_file', 'training_file',
    'engine', 'input', 'context_length', 'custom_finetune'
  ];

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] overflow-auto p-4">
      {fields.map(field => (
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
      <div className="border rounded-lg p-4 relative mb-4">
        <span className="absolute -top-3 left-2 bg-white px-2 text-sm font-semibold text-gray-600 z-10">
          Prompt Settings
        </span>
        <div className="grid grid-cols-2 gap-4">
          {promptSettingsFields.map(field => (
            <div key={field} className="flex flex-col">
              <label className="text-sm font-medium text-gray-700">{field}</label>
              <input
                type="text"
                value={localData[field] || ''}
                onChange={(e) => handleSave(field, e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectPanels;
