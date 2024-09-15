import React, { useState, useEffect } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, RotateCcw, Copy, X, CheckSquare, Square } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useSaveField } from '../hooks/useSaveField';
import { useFetchLatestData } from '../hooks/useFetchLatestData';
import { useOpenAIModels } from '../hooks/useOpenAIModels';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

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

const SettingInput = ({ label, value, onChange, onCopy, onSetEmpty, checked, onCheckChange, isSelect, options, isTemperature }) => {
  const [sliderValue, setSliderValue] = useState(parseFloat(value) || 0);

  const handleSliderChange = (newValue) => {
    const formattedValue = newValue[0].toFixed(4);
    setSliderValue(newValue[0]);
    onChange(formattedValue);
  };

  if (isTemperature) {
    return (
      <div className="mb-2">
        <Label htmlFor={label} className="flex justify-between items-center">
          <span>{label}</span>
          <div className="flex space-x-1">
            <IconButton icon={<Copy />} onClick={onCopy} tooltip="Copy to clipboard" />
            <IconButton icon={<X />} onClick={onSetEmpty} tooltip="Set to empty" />
            <IconButton 
              icon={checked ? <CheckSquare /> : <Square />} 
              onClick={onCheckChange} 
              tooltip={checked ? "Uncheck" : "Check"}
            />
          </div>
        </Label>
        <div className="flex items-center space-x-2">
          <Slider
            id={label}
            min={-2}
            max={2}
            step={0.0001}
            value={[sliderValue]}
            onValueChange={handleSliderChange}
            className="flex-grow"
          />
          <Input
            type="text"
            value={sliderValue.toFixed(4)}
            onChange={(e) => {
              const newValue = parseFloat(e.target.value);
              if (!isNaN(newValue) && newValue >= -2 && newValue <= 2) {
                setSliderValue(newValue);
                onChange(newValue.toFixed(4));
              }
            }}
            className="w-20"
          />
        </div>
      </div>
    );
  }

  return isSelect ? (
    <div className="mb-2">
      <Label htmlFor={label} className="flex justify-between items-center">
        <span>{label}</span>
        <div className="flex space-x-1">
          <IconButton icon={<Copy />} onClick={onCopy} tooltip="Copy to clipboard" />
          <IconButton icon={<X />} onClick={onSetEmpty} tooltip="Set to empty" />
          <IconButton 
            icon={checked ? <CheckSquare /> : <Square />} 
            onClick={onCheckChange} 
            tooltip={checked ? "Uncheck" : "Check"}
          />
        </div>
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full mt-1">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.model} value={option.model}>
              {option.model}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ) : (
    <div className="mb-2">
      <Label htmlFor={label} className="flex justify-between items-center">
        <span>{label}</span>
        <div className="flex space-x-1">
          <IconButton icon={<Copy />} onClick={onCopy} tooltip="Copy to clipboard" />
          <IconButton icon={<X />} onClick={onSetEmpty} tooltip="Set to empty" />
          <IconButton 
            icon={checked ? <CheckSquare /> : <Square />} 
            onClick={onCheckChange} 
            tooltip={checked ? "Uncheck" : "Check"}
          />
        </div>
      </Label>
      <Input
        id={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1"
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

const ProjectPanels = ({ selectedItemData, projectRowId }) => {
  const { saveField, isSaving } = useSaveField(projectRowId);
  const { fetchLatestData, isLoading } = useFetchLatestData(projectRowId);
  const { models, isLoading: isLoadingModels } = useOpenAIModels();
  const [localData, setLocalData] = useState(selectedItemData || {});
  const [checkedSettings, setCheckedSettings] = useState({});

  useEffect(() => {
    setLocalData(selectedItemData || {});
  }, [selectedItemData]);

  useEffect(() => {
    console.log('Models:', models);
    console.log('Local Data:', localData);
  }, [models, localData]);

  const handleSave = async (fieldName, value) => {
    if (projectRowId) {
      await saveField(fieldName, value);
      setLocalData(prevData => ({ ...prevData, [fieldName]: value }));
    }
  };

  const handleReset = async (fieldName) => {
    if (projectRowId) {
      const latestData = await fetchLatestData();
      if (latestData !== null) {
        setLocalData(prevData => ({ ...prevData, ...latestData }));
        return latestData[fieldName];
      }
    }
    return null;
  };

  const handleCopy = (value) => {
    navigator.clipboard.writeText(value).then(() => {
      toast.success('Copied to clipboard');
    }).catch((err) => {
      console.error('Failed to copy text: ', err);
      toast.error('Failed to copy text');
    });
  };

  const handleSetEmpty = (fieldName) => {
    setLocalData(prevData => ({ ...prevData, [fieldName]: '' }));
    handleSave(fieldName, '');
  };

  const handleCheckChange = (fieldName) => {
    setCheckedSettings(prev => ({ ...prev, [fieldName]: !prev[fieldName] }));
  };

  const getMaxTokensLabel = () => {
    const selectedModel = models.find(m => m.model === localData.model);
    return selectedModel ? `max_tokens (<= ${selectedModel.max_tokens})` : 'max_tokens';
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
            <SettingInput
              key={field}
              label={field === 'max_tokens' ? getMaxTokensLabel() : field}
              value={localData[field] || ''}
              onChange={(value) => {
                setLocalData(prev => ({ ...prev, [field]: value }));
                handleSave(field, value);
              }}
              onCopy={() => handleCopy(localData[field] || '')}
              onSetEmpty={() => handleSetEmpty(field)}
              checked={checkedSettings[field] || false}
              onCheckChange={() => handleCheckChange(field)}
              isSelect={field === 'model'}
              options={models}
              isTemperature={field === 'temperature'}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectPanels;
