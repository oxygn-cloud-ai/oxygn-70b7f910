import React from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const PromptField = ({ label, value, onChange }) => {
  return (
    <div className="mb-4">
      <Label htmlFor={label}>{label}</Label>
      <Textarea
        id={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1"
        rows={4}
      />
    </div>
  );
};

export default PromptField;