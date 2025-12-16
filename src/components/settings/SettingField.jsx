import React from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Save, RotateCcw } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SettingField = ({ 
  field, 
  label, 
  description,
  localData, 
  handleChange, 
  handleSave, 
  handleReset, 
  hasUnsavedChanges,
  handleCheckChange,
  customInput,
  selectedItemData,
  isSupported = true
}) => {
  const isChecked = localData[`${field}_on`] || false;
  const hasChanged = hasUnsavedChanges(field);
  const initialValue = selectedItemData?.[field];
  const currentValue = localData[field];
  const valueChanged = initialValue !== currentValue;

  // Disabled if not supported by current model
  const isDisabled = !isSupported;

  const fieldContent = (
    <div className={cn(
      "relative p-3 rounded-lg border transition-all",
      isDisabled 
        ? "bg-muted/50 border-muted opacity-60 cursor-not-allowed" 
        : "bg-background border-border hover:border-primary/50"
    )}>
      <div className="flex items-center space-x-2 mb-2">
        <Checkbox
          id={`${field}-checkbox`}
          checked={isChecked}
          onCheckedChange={(checked) => !isDisabled && handleCheckChange(field, checked)}
          disabled={isDisabled}
        />
        <label 
          htmlFor={field} 
          className={cn(
            "text-sm font-medium flex-grow",
            isDisabled ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {label || field}
        </label>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleSave(field)}
          disabled={(!valueChanged && !hasChanged) || isDisabled}
          className={cn(
            "h-6 w-6",
            (valueChanged || hasChanged) && !isDisabled ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <Save className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleReset(field)}
          disabled={(!valueChanged && !hasChanged) || isDisabled}
          className={cn(
            "h-6 w-6",
            (valueChanged || hasChanged) && !isDisabled ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
      
      {customInput ? (
        customInput
      ) : (
        <Input
          id={field}
          value={localData[field] || ''}
          onChange={(e) => handleChange(field, e.target.value)}
          disabled={!isChecked || isDisabled}
          className={cn(
            "w-full",
            isDisabled && "bg-muted cursor-not-allowed"
          )}
          placeholder={isDisabled ? "Not available for this model" : ""}
        />
      )}
      
      {description && !isDisabled && (
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      )}
      
      {isDisabled && (
        <p className="text-xs text-muted-foreground mt-1 italic">
          Not supported by selected model
        </p>
      )}
    </div>
  );

  if (isDisabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>{fieldContent}</div>
          </TooltipTrigger>
          <TooltipContent>
            <p>This setting is not available for the selected model</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return fieldContent;
};

export default SettingField;
