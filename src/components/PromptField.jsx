import React from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RotateCcw, Save } from 'lucide-react';
import { Button } from "@/components/ui/button";

const PromptField = ({ label, value, onChange, onReset, onSave, initialValue }) => {
  const hasChanged = value !== initialValue;

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <Label htmlFor={label}>{label}</Label>
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onSave}
            disabled={!hasChanged}
            className="h-6 w-6"
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onReset}
            disabled={!hasChanged}
            className="h-6 w-6"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
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
