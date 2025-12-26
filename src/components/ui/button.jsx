import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-m3-md text-sm font-medium ring-offset-background transition-all duration-medium-2 ease-emphasized focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-m3-1 hover:shadow-m3-2",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-outline bg-transparent hover:bg-on-surface/[0.08] hover:text-foreground",
        secondary:
          "bg-secondary-container text-secondary-container-foreground hover:bg-secondary-container/80",
        ghost: "hover:bg-on-surface/[0.08] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // M3 Expressive variants
        filled: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-m3-1 hover:shadow-m3-2",
        "filled-tonal": "bg-secondary-container text-secondary-container-foreground hover:bg-secondary-container/80",
        elevated: "bg-surface-container-low text-foreground shadow-m3-1 hover:shadow-m3-2 hover:bg-surface-container",
        // FAB variants with squircle morphing
        fab: "bg-primary-container text-on-primary-container shadow-m3-3 hover:shadow-m3-4 hover:scale-[1.02] active:scale-[0.98] active:shadow-m3-2 [border-radius:28%] hover:[border-radius:24%]",
        "fab-secondary": "bg-secondary-container text-secondary-container-foreground shadow-m3-3 hover:shadow-m3-4 hover:scale-[1.02] active:scale-[0.98] [border-radius:28%] hover:[border-radius:24%]",
        "fab-surface": "bg-surface-container-high text-on-surface shadow-m3-3 hover:shadow-m3-4 hover:scale-[1.02] active:scale-[0.98] [border-radius:28%] hover:[border-radius:24%]",
        "fab-tertiary": "bg-tertiary-container text-tertiary-foreground shadow-m3-3 hover:shadow-m3-4 hover:scale-[1.02] active:scale-[0.98] [border-radius:28%] hover:[border-radius:24%]",
        // Legacy brand variants
        ruby: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-ruby-glow",
        espresso: "bg-accent text-accent-foreground hover:bg-accent/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-m3-sm px-3",
        lg: "h-11 rounded-m3-md px-8",
        icon: "h-10 w-10",
        // M3 icon button sizes
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-12 w-12",
        // FAB sizes
        "fab": "h-14 w-14",
        "fab-small": "h-10 w-10 [border-radius:24%] hover:[border-radius:20%]",
        "fab-large": "h-24 w-24",
        "fab-extended": "h-14 px-5 gap-2 [border-radius:16px] hover:[border-radius:20px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    (<Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />)
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }