import React from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Save, RotateCcw } from 'lucide-react';
import { Input } from "@/components/ui/input";

const SettingField = ({ 
  field, 
  label, 
  localData, 
  handleChange, 
  handleSave, 
  handleReset, 
  hasUnsavedChanges,
  handleCheckChange 
}) => {
  return (
    <div className="relative">
      <div className="flex items-center space-x-2 mb-2">
        <Checkbox
          id={`${field}-checkbox`}
          checked={localData[`${field}_on`] || false}
          onCheckedChange={(checked) => handleCheckChange(field, checked)}
        />
        <label htmlFor={field} className="text-sm font-medium text-gray-700 flex-grow">
          {label || field}
        </label>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleSave(field)}
          disabled={!hasUnsavedChanges(field)}
          className="h-6 w-6"
        >
          <Save className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleReset(field)}
          disabled={!hasUnsavedChanges(field)}
          className="h-6 w-6"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
      <Input
        id={field}
        value={localData[field] || ''}
        onChange={(e) => handleChange(field, e.target.value)}
        disabled={!localData[`${field}_on`]}
        className="w-full"
      />
    </div>
  );
};

export default SettingField;