import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

const SettingField = ({ label, value, onChange, checked, onCheckChange, isSelect, options, isTemperature }) => {
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

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
    setInputValue(newValue.toString());
    onChange(newValue.toString());
  };

  const handleSliderChange = (newValue) => {
    const formattedValue = newValue[0].toFixed(4);
    setInputValue(formattedValue);
    onChange(formattedValue);
  };

  if (isTemperature) {
    return (
      <div className="mb-2">
        <Label htmlFor={label} className="flex justify-between items-center">
          <span>{label}</span>
          <Checkbox checked={checked} onCheckedChange={onCheckChange} />
        </Label>
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
          />
        </div>
      </div>
    );
  }

  return isSelect ? (
    <div className="mb-2">
      <Label htmlFor={label} className="flex justify-between items-center">
        <span>{label}</span>
        <Checkbox checked={checked} onCheckedChange={onCheckChange} />
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
        <Checkbox checked={checked} onCheckedChange={onCheckChange} />
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

export default SettingField;