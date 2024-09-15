import React, { useState } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, RotateCcw, Copy } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

const TextAreaWithIcons = ({ placeholder, value, onChange }) => {
  return (
    <div className="relative mb-4">
      <div className="absolute top-2 right-2 z-10 flex space-x-1">
        <IconButton icon={<Copy />} onClick={() => {}} tooltip="Copy to clipboard" />
        <IconButton icon={<Save />} onClick={() => {}} tooltip="Save changes" />
        <IconButton icon={<RotateCcw />} onClick={() => {}} tooltip="Reset to last saved" />
      </div>
      <Textarea 
        placeholder={placeholder} 
        className="w-full p-2 pr-24 border rounded" 
        value={value}
        onChange={onChange}
      />
    </div>
  );
};

const SettingInput = ({ label, value, onChange, isSelect, options, isTemperature }) => {
  const handleInputChange = (e) => {
    let newValue = e.target.value;
    if (isTemperature) {
      newValue = parseFloat(newValue);
      if (!isNaN(newValue)) {
        newValue = Math.max(-2, Math.min(2, parseFloat(newValue.toFixed(4))));
      } else {
        newValue = value;
      }
    }
    onChange(newValue.toString());
  };

  const handleSliderChange = (newValue) => {
    const formattedValue = newValue[0].toFixed(4);
    onChange(formattedValue);
  };

  if (isTemperature) {
    return (
      <div className="mb-2">
        <Label htmlFor={label}>{label}</Label>
        <div className="flex items-center space-x-2">
          <Slider
            id={`${label}-slider`}
            min={-2}
            max={2}
            step={0.0001}
            value={[parseFloat(value) || 0]}
            onValueChange={handleSliderChange}
            className="flex-grow"
          />
          <Input
            id={`${label}-input`}
            type="text"
            value={value}
            onChange={handleInputChange}
            className="w-20"
          />
        </div>
      </div>
    );
  }

  return isSelect ? (
    <div className="mb-2">
      <Label htmlFor={label}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full mt-1">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ) : (
    <div className="mb-2">
      <Label htmlFor={label}>{label}</Label>
      <Input
        id={label}
        value={value}
        onChange={handleInputChange}
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

const ProjectPanels = ({ projectRowId }) => {
  const [localData, setLocalData] = useState({
    admin_prompt_result: '',
    user_prompt_result: '',
    input_admin_prompt: '',
    input_user_prompt: '',
    model: 'gpt-3.5-turbo',
    temperature: '0',
    max_tokens: '100',
    top_p: '1',
    frequency_penalty: '0',
    presence_penalty: '0'
  });

  const handleChange = (field, value) => {
    setLocalData(prev => ({ ...prev, [field]: value }));
  };

  const textAreaFields = [
    { name: 'admin_prompt_result', placeholder: 'Admin Prompt' },
    { name: 'user_prompt_result', placeholder: 'User Prompt' },
    { name: 'input_admin_prompt', placeholder: 'Input Admin Prompt' },
    { name: 'input_user_prompt', placeholder: 'Input User Prompt' }
  ];

  const promptSettingsFields = [
    { name: 'model', label: 'Model', isSelect: true, options: ['gpt-3.5-turbo', 'gpt-4'] },
    { name: 'temperature', label: 'Temperature (-2 to 2)', isTemperature: true },
    { name: 'max_tokens', label: 'Max Tokens' },
    { name: 'top_p', label: 'Top P' },
    { name: 'frequency_penalty', label: 'Frequency Penalty' },
    { name: 'presence_penalty', label: 'Presence Penalty' }
  ];

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] overflow-auto p-4">
      {textAreaFields.map(field => (
        <TextAreaWithIcons
          key={field.name}
          placeholder={field.placeholder}
          value={localData[field.name]}
          onChange={(e) => handleChange(field.name, e.target.value)}
        />
      ))}
      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Prompt Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          {promptSettingsFields.map(field => (
            <SettingInput
              key={field.name}
              label={field.label}
              value={localData[field.name]}
              onChange={(value) => handleChange(field.name, value)}
              isSelect={field.isSelect}
              options={field.options}
              isTemperature={field.isTemperature}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectPanels;
