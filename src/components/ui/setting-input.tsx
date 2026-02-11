import * as React from "react"
import { cn } from "@/lib/utils"

interface SettingInputProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  minWidth?: string;
}

const SettingInput = React.forwardRef<HTMLDivElement, SettingInputProps>(({ 
  className, 
  children,
  minWidth = "min-w-44",
  ...props 
}, ref) => (
  <div
    ref={ref}
    className={cn(
      "h-8 px-3 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant",
      minWidth,
      className
    )}
    {...props}
  >
    <span className="text-tree text-on-surface truncate">{children}</span>
  </div>
))
SettingInput.displayName = "SettingInput"

export { SettingInput }
export type { SettingInputProps }
