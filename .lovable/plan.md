

# Comprehensive TypeScript Strict Mode Remediation Plan

## Problem Summary

The removal of `references` from `tsconfig.json` enforces TypeScript strict mode globally, exposing **150+ pre-existing violations** across the codebase. The build is completely blocked.

---

## Root Cause Analysis

The violations fall into 4 categories:

| Category | Count | Examples |
|----------|-------|----------|
| UI Primitives missing `forwardRef` type parameters | 27 files | `tooltip.tsx`, `dialog.tsx`, `progress.tsx`, `alert-dialog.tsx` |
| Untyped Context (`createContext(null)`) | 1 file | `CascadeRunContext.tsx` returns `never` types |
| Application components with untyped props/functions | 6 files | `ActionPreviewDialog.tsx`, `CascadeErrorDialog.tsx`, etc. |
| Unused imports | 6 files | `React` import in files using JSX transform |

---

## Phase 1: Critical Path UI Primitives (4 files)

These are blocking the main error dialogs and progress components.

### 1.1 `src/components/ui/tooltip.tsx`

Add type parameters to `Tooltip` component and `TooltipContent` forwardRef:

```typescript
import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cn } from "@/lib/utils"
import { useTooltipSettings } from "@/contexts/TooltipContext"

const TooltipProvider = TooltipPrimitive.Provider

interface TooltipProps extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root> {
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ children, ...props }) => {
  const { tooltipsEnabled } = useTooltipSettings();
  return <TooltipPrimitive.Root {...props}>{children}</TooltipPrimitive.Root>;
}

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => {
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
```

### 1.2 `src/components/ui/dialog.tsx`

Add type parameters to all forwardRef components and typed props for functional components:

```typescript
import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props} />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  hideCloseButton?: boolean;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, hideCloseButton = false, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}>
      {children}
      {!hideCloseButton && (
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}
const DialogHeader: React.FC<DialogHeaderProps> = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
)
DialogHeader.displayName = "DialogHeader"

interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {}
const DialogFooter: React.FC<DialogFooterProps> = ({ className, ...props }) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
```

### 1.3 `src/components/ui/alert-dialog.tsx`

Add type parameters to all forwardRef components:

```typescript
import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

const AlertDialog = AlertDialogPrimitive.Root
const AlertDialogTrigger = AlertDialogPrimitive.Trigger
const AlertDialogPortal = AlertDialogPrimitive.Portal

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref} />
))
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props} />
  </AlertDialogPortal>
))
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

interface AlertDialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}
const AlertDialogHeader: React.FC<AlertDialogHeaderProps> = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
)
AlertDialogHeader.displayName = "AlertDialogHeader"

interface AlertDialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {}
const AlertDialogFooter: React.FC<AlertDialogFooterProps> = ({ className, ...props }) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
)
AlertDialogFooter.displayName = "AlertDialogFooter"

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold", className)} {...props} />
))
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props} />
))
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
))
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)}
    {...props} />
))
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
```

### 1.4 `src/components/ui/progress.tsx`

Add type parameters to forwardRef:

```typescript
import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { value?: number }
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", className)}
    {...props}>
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }} />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
```

---

## Phase 2: Context and Application Components (7 files)

### 2.1 `src/contexts/CascadeRunContext.tsx`

Add full TypeScript interface for context value:

```typescript
import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';

interface CompletedPrompt {
  promptRowId: string;
  promptName: string;
  response: string;
}

interface SkippedPrompt {
  promptRowId: string;
  promptName: string;
}

interface ErrorPrompt {
  name: string;
  row_id?: string;
}

interface ActionPreviewData {
  jsonResponse: unknown;
  config: unknown;
  promptName: string;
}

interface QuestionData {
  question: string;
  variableName: string;
  maxQuestions?: number;
}

interface QuestionProgress {
  current: number;
  max: number;
}

interface CollectedQuestionVar {
  name: string;
  value: string;
}

type ErrorAction = 'retry' | 'skip' | 'stop';

interface CascadeRunContextValue {
  // State
  isRunning: boolean;
  isPaused: boolean;
  isCancelling: boolean;
  currentLevel: number;
  totalLevels: number;
  currentPromptName: string;
  currentPromptRowId: string | null;
  currentPromptIndex: number;
  totalPrompts: number;
  completedPrompts: CompletedPrompt[];
  skippedPrompts: SkippedPrompt[];
  startTime: number | null;
  error: string | null;
  errorPrompt: ErrorPrompt | null;
  singleRunPromptId: string | null;
  actionPreview: ActionPreviewData | null;
  skipAllPreviews: boolean;
  pendingQuestion: QuestionData | null;
  questionProgress: QuestionProgress;
  collectedQuestionVars: CollectedQuestionVar[];
  
  // Actions
  startCascade: (levels: number, promptCount: number, skippedCount?: number) => void;
  updateProgress: (level: number, promptName: string, promptIndex: number, promptRowId?: string | null) => void;
  markPromptComplete: (promptRowId: string, promptName: string, response: string) => void;
  markPromptSkipped: (promptRowId: string, promptName: string) => void;
  completeCascade: () => void;
  cancel: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  isCancelled: () => boolean;
  checkPaused: () => boolean;
  showError: (promptData: ErrorPrompt, errorMessage: string) => Promise<ErrorAction>;
  resolveError: (action: ErrorAction) => void;
  showActionPreview: (previewData: ActionPreviewData) => Promise<boolean>;
  resolveActionPreview: (confirmed: boolean) => void;
  setSkipAllPreviews: (skip: boolean) => void;
  startSingleRun: (promptRowId: string) => void;
  endSingleRun: () => void;
  registerCancelHandler: (handler: () => Promise<void>) => () => void;
  showQuestion: (questionData: QuestionData) => Promise<string | null>;
  resolveQuestion: (answer: string | null) => void;
  addCollectedQuestionVar: (name: string, value: string) => void;
  resetQuestionState: () => void;
}

const CascadeRunContext = createContext<CascadeRunContextValue | null>(null);

export const useCascadeRun = (): CascadeRunContextValue => {
  const context = useContext(CascadeRunContext);
  if (!context) {
    throw new Error('useCascadeRun must be used within a CascadeRunProvider');
  }
  return context;
};

interface CascadeRunProviderProps {
  children: ReactNode;
}

export const CascadeRunProvider: React.FC<CascadeRunProviderProps> = ({ children }) => {
  // ... rest of implementation unchanged
};

export default CascadeRunContext;
```

### 2.2 `src/components/ActionPreviewDialog.tsx`

Remove unused imports and add prop interface:

```typescript
import { useMemo } from 'react';
// ... other imports (remove ArrowRight from lucide-react)

interface ActionPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jsonResponse: Record<string, unknown> | null;
  config: {
    json_path?: string | string[];
    name_field?: string;
    content_field?: string;
    placement?: 'children' | 'siblings' | 'top_level' | 'specific_prompt';
    target_prompt_id?: string;
  } | null;
  promptName: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface AnalysisResult {
  items: { name: string; contentPreview: string }[];
  error: string | null;
  availableArrays?: string[];
}

const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
  if (!path || path === 'root') return obj;
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj);
};

const ActionPreviewDialog: React.FC<ActionPreviewDialogProps> = ({
  open,
  onOpenChange,
  jsonResponse,
  config,
  promptName,
  onConfirm,
  onCancel,
}) => {
  // ... implementation with proper null checks
};
```

### 2.3 `src/components/CascadeErrorDialog.tsx`

Remove unused React import and add function parameter types:

```typescript
import { useCascadeRun } from '@/contexts/CascadeRunContext';
// ... other imports (remove React import)
import { LucideIcon } from 'lucide-react';

interface ErrorDetails {
  type: string;
  icon: LucideIcon;
  suggestion: string | null;
}

const getErrorDetails = (error: string | null): ErrorDetails => {
  // ... implementation
};

const CascadeErrorDialog: React.FC = () => {
  // ... implementation
};
```

### 2.4 `src/components/CascadePopup.tsx`

Remove unused React import and add prop interface:

```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CascadePopupProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  itemName: string;
  fieldName: string;
  fieldContent: string;
}

const CascadePopup: React.FC<CascadePopupProps> = ({ isOpen, onClose, itemName, fieldName, fieldContent }) => {
  // ... implementation
};
```

### 2.5 `src/components/CascadeRunProgress.tsx`

Remove unused React import and currentPromptIndex variable:

```typescript
import { useState, useEffect } from 'react';
// ... other imports

const CascadeRunProgress: React.FC = () => {
  const {
    isRunning,
    isPaused,
    isCancelling,
    currentLevel,
    totalLevels,
    currentPromptName,
    // Remove: currentPromptIndex,
    totalPrompts,
    completedPrompts,
    skippedPrompts,
    startTime,
    cancel,
    pause,
    resume,
    skipAllPreviews,
    setSkipAllPreviews,
  } = useCascadeRun();
  // ... rest unchanged
};
```

### 2.6 `src/components/BackgroundCallsIndicator.tsx`

Remove all unused imports:

```typescript
const BackgroundCallsIndicator: React.FC = () => {
  return null;
};

export default BackgroundCallsIndicator;
```

### 2.7 `src/components/ConfluencePagesSection.tsx`

Remove unused React import and add function parameter types:

```typescript
import { useState, useMemo } from 'react';
// ... other imports

interface ConfluencePage {
  row_id: string;
  page_id: string;
  page_title: string;
  parent_page_id: string | null;
  page_url: string | null;
  sync_status: 'synced' | 'pending' | 'error';
  openai_file_id: string | null;
  content_type: string;
  position: number | null;
}

interface PageTreeNode extends ConfluencePage {
  children: PageTreeNode[];
}

const buildPageTree = (pages: ConfluencePage[]): PageTreeNode[] => {
  // ... implementation
};

interface PageTreeNodeProps {
  page: PageTreeNode;
  level?: number;
  syncingPageId: string | null;
  onSync: (rowId: string) => Promise<void>;
  onDetach: (rowId: string) => void;
  isLast?: boolean;
  parentLines?: boolean[];
}

const PageTreeNode: React.FC<PageTreeNodeProps> = ({ /* ... */ }) => {
  // ... implementation
};
```

---

## Phase 3: Remaining UI Primitives (23 files)

The following files require the same pattern of adding `React.forwardRef` type parameters:

| File | Components |
|------|------------|
| `popover.tsx` | `PopoverContent` |
| `accordion.tsx` | `AccordionItem`, `AccordionTrigger`, `AccordionContent` |
| `tabs.tsx` | `TabsList`, `TabsTrigger`, `TabsContent` |
| `avatar.tsx` | `Avatar`, `AvatarImage`, `AvatarFallback` |
| `dropdown-menu.tsx` | All 15+ components |
| `collapsible.tsx` | All components |
| `sheet.tsx` | All components |
| `table.tsx` | All 8 components |
| `form.tsx` | All components |
| `drawer.tsx` | All components |
| `slider.tsx` | `Slider` |
| `radio-group.tsx` | `RadioGroup`, `RadioGroupItem` |
| `navigation-menu.tsx` | All components |
| `context-menu.tsx` | All components |
| `menubar.tsx` | All components |
| `hover-card.tsx` | All components |
| `toggle.tsx` | `Toggle` |
| `toggle-group.tsx` | All components |
| `pagination.tsx` | All components |
| `resizable.tsx` | All components |
| `carousel.tsx` | All components |
| `command.tsx` | All components |
| `input-otp.tsx` | All components |

---

## Files to Modify (Complete List)

| # | File | Priority | Changes |
|---|------|----------|---------|
| 1 | `src/components/ui/tooltip.tsx` | CRITICAL | Add forwardRef types |
| 2 | `src/components/ui/dialog.tsx` | CRITICAL | Add forwardRef types + prop interfaces |
| 3 | `src/components/ui/alert-dialog.tsx` | CRITICAL | Add forwardRef types + prop interfaces |
| 4 | `src/components/ui/progress.tsx` | CRITICAL | Add forwardRef types |
| 5 | `src/contexts/CascadeRunContext.tsx` | CRITICAL | Add full context interface |
| 6 | `src/components/ActionPreviewDialog.tsx` | HIGH | Add prop interface, remove unused imports |
| 7 | `src/components/CascadeErrorDialog.tsx` | HIGH | Add function types, remove unused import |
| 8 | `src/components/CascadePopup.tsx` | HIGH | Add prop interface, remove unused import |
| 9 | `src/components/CascadeRunProgress.tsx` | HIGH | Remove unused variable and import |
| 10 | `src/components/BackgroundCallsIndicator.tsx` | HIGH | Remove all unused imports |
| 11 | `src/components/ConfluencePagesSection.tsx` | HIGH | Add interfaces, remove unused import |
| 12-34 | Phase 3 UI Primitives (23 files) | MEDIUM | Add forwardRef types |

---

## Edge Function Error (Separate Issue)

The "No response received from edge function" error is **unrelated to the build errors**. The logs show:

- OpenAI request ran for 6+ minutes (360,021ms)
- Only `keepalive` events received, no actual content
- `accumulatedTextLength: 0` throughout

This is a long-running gpt-5 request that timed out. The existing webhook-based background execution should handle this, but the stream appears to have hung. This requires separate investigation after the build is fixed.

---

## Verification Checklist

After implementation:
1. `npm run build` completes with zero TypeScript errors
2. All UI components render correctly
3. CascadeRunContext provides properly typed values
4. No runtime regressions

---

## Recommendation

**Proceed with Phases 1 and 2 first** (11 files) to unblock the critical path and verify the build. Then complete Phase 3 (23 files) systematically.

Estimated changes: ~35 files, ~1200 lines of type definitions.

