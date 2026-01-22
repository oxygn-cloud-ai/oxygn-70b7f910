import React, { useState, useEffect, ChangeEvent } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SettingFieldProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const SettingField: React.FC<SettingFieldProps> = ({ 
  id, 
  label, 
  type = 'text', 
  value, 
  onChange, 
  disabled = false 
}) => {
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [parsedValue, setParsedValue] = useState<string>('');

  useEffect(() => {
    if (id === 'response_format' && value) {
      try {
        const parsed = JSON.parse(value);
        setParsedValue(JSON.stringify(parsed, null, 2));
        setJsonError(null);
      } catch (error) {
        console.error('Error parsing JSON:', error);
        setParsedValue(value);
        setJsonError('Invalid JSON format');
      }
    } else {
      setParsedValue(value);
    }
  }, [id, value]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (id === 'response_format') {
      try {
        JSON.parse(newValue);
        setJsonError(null);
        onChange(JSON.stringify(JSON.parse(newValue)));
      } catch {
        setJsonError('Invalid JSON format');
        onChange(newValue);
      }
    } else {
      onChange(newValue);
    }
  };

  const isTextarea = type === 'textarea' || id === 'response_format';
  const InputComponent = isTextarea ? Textarea : Input;

  return (
    <div>
      <Label htmlFor={id} className="text-body-sm text-on-surface">{label}</Label>
      <InputComponent
        id={id}
        type={isTextarea ? undefined : type}
        value={parsedValue}
        onChange={handleChange}
        placeholder={`Enter ${label}`}
        autoComplete="off"
        className={`w-full mt-1 ${id === 'response_format' ? 'font-mono resize-both min-h-[100px] overflow-auto' : ''}`}
        disabled={disabled}
        rows={id === 'response_format' ? 5 : undefined}
      />
      {jsonError && <p className="text-red-500 text-[10px] mt-1">{jsonError}</p>}
    </div>
  );
};

export default SettingField;
