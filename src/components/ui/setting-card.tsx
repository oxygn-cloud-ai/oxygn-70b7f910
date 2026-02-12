// @ts-nocheck
import * as React from "react"
import { cn } from "@/lib/utils"

interface SettingCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  children?: React.ReactNode;
}

const SettingCard = React.forwardRef<HTMLDivElement, SettingCardProps>(({ 
  className, 
  label, 
  children, 
  ...props 
}, ref) => (
  <div
    ref={ref}
    className={cn(
      "bg-surface-container-low rounded-m3-lg p-3 space-y-3",
      className
    )}
    {...props}
  >
    {label && (
      <span className="text-label-sm text-on-surface-variant uppercase">
        {label}
      </span>
    )}
    {children}
  </div>
))
SettingCard.displayName = "SettingCard"

export { SettingCard }
export type { SettingCardProps }
