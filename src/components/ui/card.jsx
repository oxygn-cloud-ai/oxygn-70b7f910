import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const cardVariants = cva(
  "transition-all duration-medium-2 ease-emphasized",
  {
    variants: {
      variant: {
        default: "rounded-m3-lg border border-border bg-card text-card-foreground shadow-warm hover:shadow-warm-lg",
        elevated: "rounded-m3-xl bg-surface-container-low text-foreground shadow-m3-1 hover:shadow-m3-2",
        filled: "rounded-m3-xl bg-surface-container-highest text-foreground",
        outlined: "rounded-m3-xl border border-outline-variant bg-surface text-foreground",
        // M3 Expressive variants with larger radii
        "elevated-lg": "rounded-m3-2xl bg-surface-container-low text-foreground shadow-m3-2 hover:shadow-m3-3",
        "filled-lg": "rounded-m3-2xl bg-surface-container text-foreground",
        "container": "rounded-m3-2xl bg-surface-container text-foreground",
        "container-high": "rounded-m3-2xl bg-surface-container-high text-foreground",
        "container-highest": "rounded-m3-2xl bg-surface-container-highest text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Card = React.forwardRef(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(cardVariants({ variant, className }))}
    {...props} />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props} />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-title-lg font-semibold leading-none tracking-tight text-foreground", className)}
    {...props} />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-body-md text-muted-foreground", className)}
    {...props} />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props} />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants }