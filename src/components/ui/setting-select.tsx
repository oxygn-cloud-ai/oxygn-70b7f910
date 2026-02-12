// @ts-nocheck
import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * SettingSelect - A styled select component for settings panels
 * 
 * @param {string} value - Current selected value
 * @param {function} onValueChange - Callback when value changes
 * @param {Array} options - Array of options: { value: string, label: string, description?: string, disabled?: boolean }
 * @param {string} placeholder - Placeholder text
 * @param {string} label - Optional label above the select
 * @param {string} hint - Optional hint text below the select
 * @param {React.ReactNode} icon - Optional icon to show before the value
 * @param {string} className - Additional classes for the container
 * @param {string} triggerClassName - Additional classes for the trigger
 * @param {string} contentClassName - Additional classes for the content
 * @param {boolean} disabled - Disable the select
 */
const SettingSelect = React.forwardRef(({
  value,
  onValueChange,
  options = [],
  placeholder = "Select option",
  label,
  hint,
  icon: Icon,
  className,
  triggerClassName,
  contentClassName,
  disabled = false,
  ...props
}, ref) => {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">
          {label}
        </label>
      )}
      <Select value={value} onValueChange={onValueChange} disabled={disabled} {...props}>
        <SelectTrigger 
          ref={ref}
          className={cn(
            "w-full h-8 px-2.5 bg-surface-container rounded-m3-sm border border-outline-variant text-tree text-on-surface",
            disabled && "opacity-50 cursor-not-allowed",
            triggerClassName
          )}
        >
          {Icon ? (
            <span className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-on-surface-variant" />
              <SelectValue placeholder={placeholder} />
            </span>
          ) : (
            <SelectValue placeholder={placeholder} />
          )}
        </SelectTrigger>
        <SelectContent 
          className={cn(
            "bg-surface-container-high border-outline-variant z-50",
            contentClassName
          )}
        >
          {options.length === 0 ? (
            <SelectItem value="__empty__" disabled className="text-tree text-on-surface-variant">
              No options available
            </SelectItem>
          ) : (
            options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  "text-tree text-on-surface",
                  option.disabled && "opacity-50"
                )}
              >
                {option.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {hint && (
        <p className="text-[10px] text-on-surface-variant">{hint}</p>
      )}
    </div>
  );
});

SettingSelect.displayName = "SettingSelect";

/**
 * SettingModelSelect - A specialized select for model selection with provider display
 */
const SettingModelSelect = React.forwardRef(({
  value,
  onValueChange,
  models = [],
  placeholder = "Select model",
  label = "Model",
  className,
  disabled = false,
  ...props
}, ref) => {
  const currentModel = models.find(m => m.model_id === value || m.id === value);
  const currentModelDisplay = currentModel?.model_name || currentModel?.name || value;

  const activeModels = models.filter(m => m.is_active !== false);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">
          {label}
        </label>
      )}
      <Select value={value} onValueChange={onValueChange} disabled={disabled} {...props}>
        <SelectTrigger 
          ref={ref}
          className={cn(
            "w-full h-8 px-2.5 bg-surface-container rounded-m3-sm border border-outline-variant text-tree text-on-surface",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <SelectValue placeholder={placeholder}>{currentModelDisplay}</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-64 bg-surface-container-high border-outline-variant z-50">
          {activeModels.length === 0 ? (
            <SelectItem value="__empty__" disabled className="text-tree text-on-surface-variant">
              No models available
            </SelectItem>
          ) : (
            activeModels.map((model) => (
              <SelectItem
                key={model.row_id || model.id || model.model_id}
                value={model.model_id || model.id}
                className="text-tree text-on-surface"
              >
                <span className="flex items-center justify-between w-full gap-2">
                  <span>{model.model_name || model.name}</span>
                  <span className="text-[10px] text-on-surface-variant">{model.provider || 'OpenAI'}</span>
                </span>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
});

SettingModelSelect.displayName = "SettingModelSelect";

export { SettingSelect, SettingModelSelect };
