import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

// Predefined label colors - consistent across the app
const LABEL_COLORS = {
  Business: "bg-amber-500/10 text-amber-600",
  Technical: "bg-green-500/10 text-green-600",
  Marketing: "bg-blue-500/10 text-blue-600",
  Creative: "bg-purple-500/10 text-purple-600",
  Action: "bg-orange-500/10 text-orange-600",
  Extraction: "bg-cyan-500/10 text-cyan-600",
  Analysis: "bg-indigo-500/10 text-indigo-600",
  NLP: "bg-pink-500/10 text-pink-600",
  Style: "bg-violet-500/10 text-violet-600",
  Intro: "bg-teal-500/10 text-teal-600",
  System: "bg-slate-500/10 text-slate-600",
  Format: "bg-rose-500/10 text-rose-600",
  Support: "bg-sky-500/10 text-sky-600",
  Docs: "bg-lime-500/10 text-lime-600",
};

const getLabelColor = (label) => {
  return LABEL_COLORS[label] || "bg-muted text-muted-foreground";
};

const LabelBadge = React.forwardRef(({ 
  className, 
  label,
  size = "default",
  removable = false,
  onRemove,
  ...props 
}, ref) => {
  const sizeClasses = {
    xs: "text-[8px] px-1 py-0.5",
    sm: "text-compact px-1.5 py-0.5",
    default: "text-compact px-1.5 py-0.5",
  };

  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        sizeClasses[size],
        getLabelColor(label),
        className
      )}
      {...props}
    >
      {label}
      {removable && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(label);
          }}
          className="hover:bg-on-surface/10 rounded-full p-0.5 -mr-0.5"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
});
LabelBadge.displayName = "LabelBadge";

export { LabelBadge, LABEL_COLORS, getLabelColor };
