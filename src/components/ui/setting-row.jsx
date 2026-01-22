import * as React from "react"
import { cn } from "@/lib/utils"

const SettingRow = React.forwardRef(({ 
  className, 
  label, 
  description, 
  children, 
  ...props 
}, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center justify-between gap-4",
      className
    )}
    {...props}
  >
    <div className="flex-1 min-w-0">
      <div className="text-tree text-on-surface">{label}</div>
      {description && (
        <div className="text-compact text-on-surface-variant">
          {description}
        </div>
      )}
    </div>
    {children}
  </div>
))
SettingRow.displayName = "SettingRow"

export { SettingRow }
