import * as React from "react"
import { useState } from "react"
import { Plus, X, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { LabelBadge, LABEL_COLORS } from "./label-badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover"

// All available labels
const AVAILABLE_LABELS = Object.keys(LABEL_COLORS);

const LabelPicker = React.forwardRef(({ 
  className,
  labels = [],
  onLabelsChange,
  maxDisplay = 3,
  size = "default",
  ...props 
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleToggleLabel = (label) => {
    if (labels.includes(label)) {
      onLabelsChange?.(labels.filter(l => l !== label));
    } else {
      onLabelsChange?.([...labels, label]);
    }
  };

  const handleRemoveLabel = (label) => {
    onLabelsChange?.(labels.filter(l => l !== label));
  };

  const filteredLabels = AVAILABLE_LABELS.filter(label =>
    label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayLabels = labels.slice(0, maxDisplay);
  const remainingCount = labels.length - maxDisplay;

  return (
    <div ref={ref} className={cn("flex items-center gap-1 flex-wrap", className)} {...props}>
      {/* Display current labels */}
      {displayLabels.map(label => (
        <LabelBadge 
          key={label} 
          label={label} 
          size={size}
          removable 
          onRemove={handleRemoveLabel} 
        />
      ))}
      
      {/* Show count of remaining labels */}
      {remainingCount > 0 && (
        <span className="text-[10px] text-on-surface-variant">
          +{remainingCount}
        </span>
      )}

      {/* Add label button */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button 
                className="w-5 h-5 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors"
              >
                <Plus className="h-3 w-3" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">Add label</TooltipContent>
        </Tooltip>
        
        <PopoverContent 
          className="w-48 p-0 bg-surface-container-high border-outline-variant" 
          align="start"
        >
          {/* Search input */}
          <div className="p-2 border-b border-outline-variant">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search labels..."
              className="w-full h-7 px-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>
          
          {/* Label list */}
          <div className="max-h-48 overflow-auto p-1">
            {filteredLabels.map(label => {
              const isSelected = labels.includes(label);
              return (
                <button
                  key={label}
                  onClick={() => handleToggleLabel(label)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-m3-sm text-left transition-colors",
                    isSelected 
                      ? "bg-secondary-container/50" 
                      : "hover:bg-on-surface/[0.08]"
                  )}
                >
                  <LabelBadge label={label} size="sm" />
                  <span className="flex-1" />
                  {isSelected && (
                    <Check className="h-3 w-3 text-primary" />
                  )}
                </button>
              );
            })}
            
            {filteredLabels.length === 0 && (
              <div className="px-2 py-3 text-center text-[10px] text-on-surface-variant">
                No labels found
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
});
LabelPicker.displayName = "LabelPicker";

export { LabelPicker, AVAILABLE_LABELS };
