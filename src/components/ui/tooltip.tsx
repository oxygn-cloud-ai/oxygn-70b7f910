import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"
import { useTooltipSettings } from "@/contexts/TooltipContext"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = ({ children, ...props }) => {
  const { tooltipsEnabled } = useTooltipSettings();
  
  if (!tooltipsEnabled) {
    // When tooltips are disabled, just render children without tooltip functionality
    return <TooltipPrimitive.Root {...props}>{children}</TooltipPrimitive.Root>;
  }
  
  return <TooltipPrimitive.Root {...props}>{children}</TooltipPrimitive.Root>;
}

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef(({ className, sideOffset = 4, ...props }, ref) => {
  const { tooltipsEnabled } = useTooltipSettings();
  
  if (!tooltipsEnabled) {
    return null;
  }
  
  return (
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md border bg-popover px-2 py-1 text-tree text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props} />
  );
})
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
