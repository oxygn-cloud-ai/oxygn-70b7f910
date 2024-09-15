import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SettingField = ({ id, label, type, value, onChange }) => {
  const handleChange = (e) => {
    onChange(e.target.value);
  };

  const InputComponent = type === 'textarea' ? Textarea : Input;

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <InputComponent
        id={id}
        type={type}
        value={value}
        onChange={handleChange}
        placeholder={`Enter ${label}`}
        autoComplete="off"
        className="w-full mt-1"
      />
    </div>
  );
};

export default SettingField;
