import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SettingField = ({ id, label, type, value, onChange, disabled }) => {
  const [jsonError, setJsonError] = useState(null);

  const handleChange = (e) => {
    const newValue = e.target.value;
    if (id === 'response_format') {
      try {
        JSON.parse(newValue);
        setJsonError(null);
        onChange(newValue);
      } catch (error) {
        setJsonError('Invalid JSON format');
      }
    } else {
      onChange(newValue);
    }
  };

  const formatJson = (jsonString) => {
    try {
      return JSON.stringify(JSON.parse(jsonString), null, 2);
    } catch {
      return jsonString;
    }
  };

  const InputComponent = type === 'textarea' || id === 'response_format' ? Textarea : Input;

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <InputComponent
        id={id}
        type={type}
        value={id === 'response_format' ? formatJson(value) : value}
        onChange={handleChange}
        placeholder={`Enter ${label}`}
        autoComplete="off"
        className={`w-full mt-1 ${id === 'response_format' ? 'font-mono resize-both min-h-[100px] overflow-auto' : ''}`}
        disabled={disabled}
        rows={id === 'response_format' ? 5 : undefined}
      />
      {jsonError && <p className="text-red-500 text-sm mt-1">{jsonError}</p>}
    </div>
  );
};

export default SettingField;
