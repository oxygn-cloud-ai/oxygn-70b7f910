import React, { useCallback, useState, useEffect } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { RotateCcw, Info, ExternalLink } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const MAX_HISTORY = 99;

const SettingField = ({ 
  field, 
  label, 
  description,
  details,
  docUrl,
  localData, 
  handleChange, 
  handleSave, 
  handleCheckChange,
  customInput,
  selectedItemData,
  isSupported = true,
  type = 'text' // 'text' or 'switch'
}) => {
  const isChecked = localData[`${field}_on`] || false;
  const isDisabled = !isSupported;
  
  // History state for this field - stores previous values
  const [valueHistory, setValueHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Initialize history with the initial value from database
  useEffect(() => {
    const initialValue = selectedItemData?.[field];
    if (initialValue !== undefined && initialValue !== null) {
      setValueHistory([initialValue]);
      setHistoryIndex(-1);
    }
  }, [selectedItemData?.row_id, field]);

  // Track value changes to build history
  const handleValueChange = useCallback((newValue) => {
    const currentValue = localData[field];
    
    if (currentValue !== undefined && 
        currentValue !== null && 
        currentValue !== '' &&
        (valueHistory.length === 0 || valueHistory[valueHistory.length - 1] !== currentValue)) {
      setValueHistory(prev => {
        const newHistory = [...prev, currentValue];
        if (newHistory.length > MAX_HISTORY) {
          return newHistory.slice(-MAX_HISTORY);
        }
        return newHistory;
      });
    }
    
    setHistoryIndex(-1);
    handleChange(field, newValue);
  }, [field, localData, handleChange, valueHistory]);

  // Cycle back through previous values
  const handleCycleBack = useCallback(() => {
    if (valueHistory.length === 0) return;
    
    if (historyIndex === -1) {
      const currentValue = localData[field];
      if (currentValue !== undefined && 
          currentValue !== null && 
          currentValue !== '' &&
          (valueHistory.length === 0 || valueHistory[valueHistory.length - 1] !== currentValue)) {
        setValueHistory(prev => {
          const newHistory = [...prev, currentValue];
          if (newHistory.length > MAX_HISTORY) {
            return newHistory.slice(-MAX_HISTORY);
          }
          return newHistory;
        });
      }
    }
    
    const newIndex = historyIndex === -1 
      ? valueHistory.length - 1 
      : (historyIndex - 1 + valueHistory.length) % valueHistory.length;
    
    setHistoryIndex(newIndex);
    const historicalValue = valueHistory[newIndex];
    handleChange(field, historicalValue);
  }, [field, historyIndex, valueHistory, localData, handleChange]);

  // Auto-save on blur
  const handleBlur = useCallback(() => {
    const initialValue = selectedItemData?.[field];
    const currentValue = localData[field];
    if (initialValue !== currentValue) {
      handleSave(field);
    }
  }, [field, localData, selectedItemData, handleSave]);

  const hasHistory = valueHistory.length > 0;

  const fieldContent = (
    <div className={cn(
      "relative p-4 rounded-2xl border transition-all duration-medium-2 ease-standard",
      isDisabled 
        ? "bg-surface-container-low border-outline-variant/50 opacity-60 cursor-not-allowed" 
        : "bg-surface-container border-outline-variant hover:border-primary/50"
    )}>
      <div className="flex items-center space-x-2 mb-2">
        {type === 'switch' ? (
          <Switch
            id={`${field}-switch`}
            checked={isChecked}
            onCheckedChange={(checked) => !isDisabled && handleCheckChange(field, checked)}
            disabled={isDisabled}
          />
        ) : (
          <Checkbox
            id={`${field}-checkbox`}
            checked={isChecked}
            onCheckedChange={(checked) => !isDisabled && handleCheckChange(field, checked)}
            disabled={isDisabled}
          />
        )}
        <label 
          htmlFor={field} 
          className={cn(
            "text-sm font-medium flex-grow",
            isDisabled ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {label || field}
        </label>
        
        {/* Info popover */}
        {(details || docUrl) && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
              >
                <Info className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" side="top">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">{label || field}</h4>
                {details && (
                  <p className="text-xs text-muted-foreground">{details}</p>
                )}
                {docUrl && (
                  <a 
                    href={docUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    API Documentation
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCycleBack}
                disabled={!hasHistory || isDisabled}
                className={cn(
                  "h-6 w-6",
                  hasHistory && !isDisabled ? 'text-primary hover:text-primary' : 'text-muted-foreground'
                )}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Cycle through previous values ({valueHistory.length} saved)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      {type === 'switch' ? null : customInput ? (
        customInput
      ) : (
        <Input
          id={field}
          value={localData[field] || ''}
          onChange={(e) => handleValueChange(e.target.value)}
          onBlur={handleBlur}
          disabled={!isChecked || isDisabled}
          className={cn(
            "w-full",
            isDisabled && "bg-muted cursor-not-allowed"
          )}
          placeholder={isDisabled ? "Not available for this model" : ""}
          autoComplete="off"
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
