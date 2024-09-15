import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, X, CheckSquare, Square, Info } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

const SettingInput = ({ 
  label, 
  value, 
  onChange, 
  onCopy, 
  onSetEmpty, 
  checked, 
  onCheckChange, 
  isSelect, 
  options, 
  isTemperature, 
  infoContent 
}) => {
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleInputChange = (e) => {
    let newValue = e.target.value;
    if (isTemperature) {
      newValue = parseFloat(newValue);
      if (!isNaN(newValue)) {
        newValue = Math.max(-2, Math.min(2, newValue)).toFixed(4);
      } else {
        newValue = value;
      }
    }
    setInputValue(newValue);
    onChange(newValue);
  };

  const handleSliderChange = (newValue) => {
    const formattedValue = newValue[0].toFixed(4);
    setInputValue(formattedValue);
    onChange(formattedValue);
  };

  const renderInput = () => {
    if (isTemperature) {
      return (
        <div className="flex items-center space-x-2">
          <Slider
            id={`${label}-slider`}
            min={-2}
            max={2}
            step={0.0001}
            value={[parseFloat(inputValue) || 0]}
            onValueChange={handleSliderChange}
            className="flex-grow"
          />
          <Input
            id={`${label}-input`}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            className="w-20"
            style={{ appearance: 'textfield' }}
          />
        </div>
      );
    } else if (isSelect) {
      return (
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
      );
    } else {
      return (
        <Input
          id={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full mt-1"
        />
      );
    }
  };

  return (
    <div className="mb-2">
      <div className="flex items-center space-x-2">
        <Label htmlFor={label} className="flex items-center space-x-1">
          <span>{label}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-gray-500 cursor-help" />
              </TooltipTrigger>
              <TooltipContent>{infoContent}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Label>
        <div className="flex space-x-1">
          <IconButton icon={<Copy />} onClick={onCopy} tooltip="Copy to clipboard" />
          <IconButton icon={<X />} onClick={onSetEmpty} tooltip="Set to empty" />
          <IconButton 
            icon={checked ? <CheckSquare /> : <Square />} 
            onClick={onCheckChange} 
            tooltip={checked ? "Uncheck" : "Check"}
          />
        </div>
      </div>
      {renderInput()}
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

export default SettingInput;