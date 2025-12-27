import * as React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

/**
 * M3 Icon Button Component
 * Material Design 3 compliant icon button with proper touch targets,
 * state layers, and variants.
 * 
 * Touch target: 40x40dp minimum (h-10 w-10)
 * Icon size: 24x24dp (h-6 w-6) for standard, 20x20dp (h-5 w-5) for small
 */

const M3IconButton = React.forwardRef(({
  children,
  className,
  variant = 'standard',
  size = 'default',
  tooltip,
  disabled,
  onClick,
  ...props
}, ref) => {
  const variants = {
    standard: cn(
      'text-on-surface-variant hover:bg-on-surface/8 active:bg-on-surface/12',
      'dark:text-on-surface-variant dark:hover:bg-on-surface/8 dark:active:bg-on-surface/12'
    ),
    filled: cn(
      'bg-primary text-on-primary hover:bg-primary/90 active:bg-primary/80',
      'shadow-elevation-1 hover:shadow-elevation-2'
    ),
    filledTonal: cn(
      'bg-secondary-container text-on-secondary-container',
      'hover:bg-secondary-container/90 active:bg-secondary-container/80'
    ),
    outlined: cn(
      'border border-outline text-on-surface-variant',
      'hover:bg-on-surface/8 active:bg-on-surface/12'
    ),
  };

  const sizes = {
    default: 'h-10 w-10', // 40dp touch target
    small: 'h-8 w-8',     // 32dp for compact UIs
    large: 'h-12 w-12',   // 48dp for emphasis
  };

  const iconSizes = {
    default: '[&>svg]:h-6 [&>svg]:w-6',   // 24dp icon
    small: '[&>svg]:h-5 [&>svg]:w-5',     // 20dp icon
    large: '[&>svg]:h-7 [&>svg]:w-7',     // 28dp icon
  };

  const button = (
    <button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        // Base styles
        'inline-flex items-center justify-center rounded-full',
        'transition-all duration-medium-1 ease-standard',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'disabled:opacity-38 disabled:pointer-events-none',
        // State layer
        'relative overflow-hidden',
        // Size
        sizes[size],
        iconSizes[size],
        // Variant
        variants[variant],
        className
      )}
      {...props}
    >
      {/* State layer overlay */}
      <span className="absolute inset-0 rounded-full state-layer pointer-events-none" />
      {/* Icon content */}
      <span className="relative z-10 flex items-center justify-center">
        {children}
      </span>
    </button>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent>
            <span className="text-label-medium">{tooltip}</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
});

M3IconButton.displayName = 'M3IconButton';

export { M3IconButton };
