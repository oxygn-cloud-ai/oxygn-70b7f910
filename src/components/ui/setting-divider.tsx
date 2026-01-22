import * as React from "react"
import { cn } from "@/lib/utils"

const SettingDivider = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("h-px bg-outline-variant", className)}
    {...props}
  />
))
SettingDivider.displayName = "SettingDivider"

export { SettingDivider }
