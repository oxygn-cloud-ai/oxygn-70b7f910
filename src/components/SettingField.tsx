import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SettingFieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const SettingField = ({ id, label, type, value, onChange, disabled }: SettingFieldProps) => {
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [parsedValue, setParsedValue] = useState('');

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

  const InputComponent = type === 'textarea' || id === 'response_format' ? Textarea : Input;

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <InputComponent
        id={id}
        type={type}
        value={parsedValue}
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
