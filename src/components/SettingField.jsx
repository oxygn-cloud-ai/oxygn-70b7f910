import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const SettingField = ({ id, label, type, value, onChange }) => {
  const [fieldValue, setFieldValue] = useState(value);
  const [hasChanged, setHasChanged] = useState(false);

  useEffect(() => {
    setFieldValue(value);
    setHasChanged(false);
  }, [value]);

  const handleChange = (e) => {
    setFieldValue(e.target.value);
    setHasChanged(true);
  };

  const handleSave = () => {
    onChange(fieldValue);
    setHasChanged(false);
  };

  const InputComponent = type === 'textarea' ? Textarea : Input;

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex space-x-2">
        <InputComponent
          id={id}
          type={type}
          value={fieldValue}
          onChange={handleChange}
          placeholder={`Enter ${label}`}
          autoComplete="off"
          className="flex-grow"
        />
        <Button 
          variant="outline"
          onClick={handleSave} 
          disabled={!hasChanged}
        >
          Save
        </Button>
      </div>
    </div>
  );
};

export default SettingField;
