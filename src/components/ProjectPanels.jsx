import React, { useState } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, RotateCcw, Copy } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useSaveField } from '../hooks/useSaveField';
import { useFetchLatestData } from '../hooks/useFetchLatestData';
import { useOpenAICall } from '../hooks/useOpenAICall';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const TextAreaWithIcons = ({ placeholder, value, fieldName, onSave, onReset, readOnly }) => {
  const [text, setText] = useState(value || '');

  React.useEffect(() => {
    setText(value || '');
  }, [value]);

  const handleSave = () => onSave(fieldName, text);
  const handleReset = async () => {
    const resetValue = await onReset(fieldName);
    if (resetValue !== null) setText(resetValue);
  };
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
      .then(() => toast.success('Copied to clipboard'))
      .catch(() => toast.error('Failed to copy text'));
  };

  return (
    <div className="relative mb-4">
      <div className="absolute top-2 left-2 z-10 flex space-x-1">
        <IconButton icon={<Copy />} onClick={handleCopy} tooltip="Copy to clipboard" />
        <IconButton icon={<Save />} onClick={handleSave} tooltip="Save changes" />
        <IconButton icon={<RotateCcw />} onClick={handleReset} tooltip="Reset to last saved" />
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

const IconButton = ({ icon, onClick, tooltip }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClick}>
          {React.cloneElement(icon, { className: "h-4 w-4" })}
        </Button>
      </TooltipTrigger>
      <TooltipContent><p>{tooltip}</p></TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const PromptSettings = ({ settings, onSettingChange }) => (
  <div className="border rounded-lg p-4">
    <h3 className="text-lg font-semibold mb-4">Prompt Settings</h3>
    <div className="grid grid-cols-2 gap-4">
      {Object.entries(settings).map(([key, value]) => (
        <div key={key} className="flex flex-col">
          <Label htmlFor={key}>{key}</Label>
          <Input
            id={key}
            value={value || ''}
            onChange={(e) => onSettingChange(key, e.target.value)}
          />
        </div>
      ))}
    </div>
  </div>
);

const ProjectPanels = ({ selectedItemData, projectRowId, onDataChange }) => {
  const { saveField, isSaving } = useSaveField(projectRowId);
  const { fetchLatestData, isLoading: isFetching } = useFetchLatestData(projectRowId);
  const { generatePrompts, isLoading: isGenerating } = useOpenAICall();
  const [localData, setLocalData] = useState(selectedItemData || {});

  React.useEffect(() => {
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

  const handleGeneratePrompts = async () => {
    try {
      const generatedPrompt = await generatePrompts(
        localData.input_admin_prompt,
        localData.input_user_prompt,
        localData.model
      );
      await handleSave('user_prompt_result', generatedPrompt);
      toast.success('Prompts generated successfully');
    } catch (error) {
      console.error('Error generating prompts:', error);
      // Error is already handled in useOpenAICall hook
    }
  };

  const handleSettingChange = (key, value) => {
    setLocalData(prev => ({ ...prev, [key]: value }));
    handleSave(key, value);
  };

  const textAreaFields = [
    { name: 'admin_prompt_result', placeholder: 'Admin Prompt' },
    { name: 'user_prompt_result', placeholder: 'User Prompt' },
    { name: 'input_admin_prompt', placeholder: 'Input Admin Prompt' },
    { name: 'input_user_prompt', placeholder: 'Input User Prompt' }
  ];

  const promptSettingsFields = {
    model: localData.model || '',
    temperature: localData.temperature || '',
    max_tokens: localData.max_tokens || '',
    top_p: localData.top_p || '',
    frequency_penalty: localData.frequency_penalty || '',
    presence_penalty: localData.presence_penalty || '',
    // Add other fields as needed
  };

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] overflow-auto p-4">
      <Button 
        variant="link" 
        onClick={handleGeneratePrompts} 
        className="self-start mb-2"
        disabled={isGenerating || isSaving || isFetching}
      >
        {isGenerating ? 'Generating...' : 'Generate Prompts'}
      </Button>
      {textAreaFields.map(field => (
        <TextAreaWithIcons
          key={field.name}
          placeholder={field.placeholder}
          value={localData[field.name] || ''}
          fieldName={field.name}
          onSave={handleSave}
          onReset={handleReset}
          readOnly={field.name === 'user_prompt_result'}
        />
      ))}
      <PromptSettings 
        settings={promptSettingsFields}
        onSettingChange={handleSettingChange}
      />
    </div>
  );
};

export default ProjectPanels;
