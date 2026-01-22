/**
 * EdgeTrigger Component (TypeScript)
 * 
 * A slim vertical trigger button that appears on screen edge
 * when a panel is hidden. Allows users to re-open the hidden panel.
 */

import React from "react";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LucideIcon } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface EdgeTriggerProps {
  side?: 'left' | 'right';
  onClick?: () => void;
  icon: LucideIcon;
  tooltip: string;
}

// ============================================================================
// ForwardRef wrapper for motion.button
// ============================================================================

const MotionButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof motion.button>
>((props, ref) => (
  <motion.button ref={ref} {...props} />
));
MotionButton.displayName = "MotionButton";

// ============================================================================
// EdgeTrigger Component
// ============================================================================

const EdgeTrigger: React.FC<EdgeTriggerProps> = ({ 
  side = "left", 
  onClick, 
  icon: Icon, 
  tooltip 
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <MotionButton
        onClick={onClick}
        initial={{ opacity: 0, x: side === "left" ? -16 : 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: side === "left" ? -16 : 16 }}
        transition={{ duration: 0.2 }}
        className={`
          fixed ${side === "left" ? "left-0" : "right-0"} top-1/2 -translate-y-1/2
          w-4 h-16 flex items-center justify-center
          bg-surface-container-low/90 hover:bg-surface-container
          border border-outline-variant 
          ${side === "left" ? "rounded-r-m3-sm border-l-0" : "rounded-l-m3-sm border-r-0"}
          text-on-surface-variant hover:text-primary
          transition-all duration-200 z-50
          shadow-sm hover:shadow-md
        `}
      >
        <Icon className="h-3 w-3" />
      </MotionButton>
    </TooltipTrigger>
    <TooltipContent side={side === "left" ? "right" : "left"} className="text-[10px]">
      {tooltip}
    </TooltipContent>
  </Tooltip>
);

export default EdgeTrigger;
