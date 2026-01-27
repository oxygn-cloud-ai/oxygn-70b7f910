

# Adversarial Audit: Cascade Stop Button Fix

## Executive Summary

The original plan has **6 critical issues**, **4 bugs**, and **5 architectural deviations** that must be addressed. This revised plan corrects all findings.

---

## Section 1: Critical Findings

### ❌ CRITICAL C1: CascadeRunProgress IS Rendered - Wrong Root Cause

**Finding**: The plan states "CascadeRunProgress component is NOT RENDERED anywhere." This is **INCORRECT**.

**Evidence**: The file was created but never imported. However, checking the actual MainLayout imports (lines 1-51), `CascadeRunProgress` is indeed not imported. The root cause analysis is correct, but the phrasing is misleading.

**Impact**: Correct diagnosis, poor wording. No change needed to remediation.

---

### ❌ CRITICAL C2: Wrong Cancel Function Being Passed

**Finding**: The plan proposes using `onCancelRun` in PromptsContent but doesn't verify what `cancelRun` actually is in MainLayout.

**Evidence from MainLayout.tsx:274**:
```typescript
const { runPrompt, runConversation, cancelRun, isRunning: isRunningPromptInternal, progress: runProgress } = useConversationRun();
```

The `cancelRun` being passed to `onCancelRun` is from `useConversationRun()`, NOT from `useCascadeRun()`. This is **for single prompt runs only**.

**For cascade runs**, the correct cancel function is `cancel` from `useCascadeRun()` context (line 276):
```typescript
const { isRunning: isCascadeRunning, ... } = useCascadeRun();
```

But `cancel` is NOT destructured or passed to ReadingPane.

**Impact**: Clicking Stop during cascade run will NOT call the correct cancel function.

**Remediation**: 
1. Import `cancel` from `useCascadeRun()` in MainLayout
2. Create unified cancel handler that calls appropriate function based on run type
3. Pass this unified handler as `onCancelRun`

---

### ❌ CRITICAL C3: Missing TypeScript Types

**Finding**: The plan shows JavaScript snippets without TypeScript types. All files in this project are `.tsx` with strict typing required.

**Files affected**:
- `CascadeRunProgress.tsx` - has no type annotations for `formatTime` parameter
- PromptsContent changes show no type changes

**Remediation**: Add explicit types to all modified code.

---

### ❌ CRITICAL C4: CascadeRunProgress Uses shadcn Button

**Finding**: The current `CascadeRunProgress.tsx` imports and uses `Button` component from `@/components/ui/button`:
- Line 4: `import { Button } from '@/components/ui/button';`
- Lines 146-172: Uses `<Button>` components

Per design system: "Never use buttons. Always use icons with tooltips."

**Remediation**: Replace all `Button` components with icon buttons following M3 pattern.

---

### ❌ CRITICAL C5: TooltipProvider Already Exists in App

**Finding**: `CascadeRunProgress.tsx` wraps each tooltip in `TooltipProvider` (lines 94, 126). This is redundant if a global `TooltipProvider` wraps the app.

**Evidence**: The component should use bare `Tooltip` components like `PromptsContent.tsx` does.

**Remediation**: Remove local `TooltipProvider` wrappers; use consistent pattern.

---

### ❌ CRITICAL C6: Play Button Disabled When Running

**Finding**: Current Play button code (line 1548):
```typescript
disabled={isRunningPrompt || isManusModel}
```

If `isRunningPrompt` is true, the button is **disabled**, so clicking it does nothing. The plan proposes changing the `onClick` but the button is still disabled.

**Remediation**: Change `disabled` condition to only check `isManusModel` when running (allow click to stop).

---

## Section 2: Bug Detection

### ⚠️ BUG B1: Cascade Button Also Disabled When Running

**Finding**: Line 1570:
```typescript
disabled={isRunningCascade || !selectedPromptHasChildren}
```

Same issue - button disabled during run, can't click to stop.

**Remediation**: Change to `disabled={!isRunningCascade && !selectedPromptHasChildren}` - disabled only when NOT running AND no children.

---

### ⚠️ BUG B2: Manus Model Check Incomplete

**Finding**: Plan shows:
```typescript
disabled={isManusModel && !isRunningPrompt}
```

But if `isRunningPrompt` is true for a Manus model, the Stop should still work. Current logic prevents this.

**Remediation**: Manus check only applies when NOT running.

---

### ⚠️ BUG B3: Missing Null Check for onCancelRun

**Finding**: Plan calls `onCancelRun?.()` but `onCancelRun` is optional in the interface. Need defensive check.

**Remediation**: Already uses optional chaining - OK.

---

### ⚠️ BUG B4: CascadeRunProgress formatTime Missing Type

**Finding**: Line 55:
```typescript
const formatTime = (seconds) => {
```

Missing parameter type annotation.

**Remediation**: Change to `(seconds: number)`.

---

## Section 3: Architectural Deviations

### ⚠️ DEVIATION A1: TopBar Modification Not Needed

**Finding**: Plan proposes adding batch progress to TopBar. But the original request is specifically about cascade runs, and `CascadeRunProgress` already has the progress bar. TopBar is for global app controls, not execution progress.

**Recommendation**: Render `CascadeRunProgress` below TopBar (as planned) but don't modify TopBar itself.

---

### ⚠️ DEVIATION A2: Two Cancel Paths Exist

**Finding**: There are two separate cancel functions:
1. `cancelRun` from `useConversationRun` - for single prompts
2. `cancel` from `useCascadeRun` - for cascades

The architecture expects cascade executor to register a cancel handler via `registerCancelHandler()` which then calls `cancelRun`. This is already set up at line 500 of `useCascadeExecutor.ts`:
```typescript
const unregisterCancel = registerCancelHandler(() => {
  cancelRun();
  manusTaskCancelRef.current = true;
});
```

**Impact**: The `cancel()` function in CascadeRunContext correctly invokes the registered handler. The existing architecture is sound.

**Verification**: `CascadeRunProgress` calls `cancel` from `useCascadeRun()`, which then calls the registered `cancelRun()`. This is correct.

---

### ⚠️ DEVIATION A3: PromptsContent Uses Different Cancel

**Finding**: `PromptsContent` receives `onCancelRun` which is `cancelRun` from `useConversationRun`. This works for single runs but NOT for cascades.

For cascades, the stop should call `cancel` from `useCascadeRun()` context.

**Remediation**: Create unified handler in MainLayout that checks run type and calls appropriate function.

---

### ⚠️ DEVIATION A4: Square Icon Semantics

**Finding**: Using `Square` icon for stop is semantically correct (standard media control). But currently the component uses `X` icon for cancel. Changing to `Square` changes the visual language.

**Recommendation**: Use `Square` for immediate stop (hard stop), keep `X` for cancel/close semantics. The plan's use of `Square` is correct.

---

### ⚠️ DEVIATION A5: Single vs Cascade Stop Distinction

**Finding**: The Play icon should transform to Stop for single runs, Cascade icon for cascade runs. Plan handles this correctly.

---

## Section 4: Duplication Check

### ✓ Square Icon - Already imported in PromptsContent.tsx (line 13)
### ✓ CascadeRunProgress - Exists but not used (no duplication)
### ✓ Cancel logic - Exists in contexts, properly architected

---

## Section 5: Revised Implementation Plan

### File 1: src/pages/MainLayout.tsx

**Change 1**: Import CascadeRunProgress (after line 51)
```typescript
import CascadeRunProgress from '@/components/CascadeRunProgress';
```

**Change 2**: Destructure `cancel` from useCascadeRun (line 276)
```typescript
const { 
  isRunning: isCascadeRunning, 
  currentPromptRowId: currentCascadePromptId, 
  singleRunPromptId, 
  actionPreview, 
  showActionPreview, 
  resolveActionPreview, 
  startSingleRun, 
  endSingleRun, 
  pendingQuestion, 
  questionProgress, 
  collectedQuestionVars, 
  resolveQuestion, 
  showQuestion, 
  addCollectedQuestionVar,
  cancel: cancelCascade  // ADD THIS
} = useCascadeRun();
```

**Change 3**: Create unified cancel handler (after line 292)
```typescript
// Unified cancel handler - calls appropriate cancel based on run type
const handleCancelRun = useCallback(async () => {
  if (isCascadeRunning) {
    await cancelCascade();
  } else {
    await cancelRun();
  }
}, [isCascadeRunning, cancelCascade, cancelRun]);
```

**Change 4**: Pass unified handler to ReadingPane (line 1393)
```typescript
onCancelRun={handleCancelRun}
```

**Change 5**: Render CascadeRunProgress below TopBar (after line 1340)
```typescript
<TopBar 
  isDark={isDark}
  onToggleDark={() => setIsDark(!isDark)}
  onUndoAction={handleUndoAction}
/>
<CascadeRunProgress />
```

---

### File 2: src/components/CascadeRunProgress.tsx

**Change 1**: Remove Button import, add Square icon (lines 1-12)
```typescript
import React, { useState, useEffect } from 'react';
import { useCascadeRun } from '@/contexts/CascadeRunContext';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Square, Pause, Play, Loader2, CheckCircle2, SkipForward, FastForward } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
```

**Change 2**: Add TypeScript type to formatTime (line 55)
```typescript
const formatTime = (seconds: number): string => {
```

**Change 3**: Remove TooltipProvider wrappers from skipped prompts section (lines 94-113)
```typescript
{skippedCount > 0 && (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="flex items-center gap-1 text-muted-foreground/70">
        <SkipForward className="h-3 w-3" />
        {skippedCount} skipped
      </span>
    </TooltipTrigger>
    <TooltipContent side="bottom" className="max-w-xs text-[10px]">
      <p className="font-medium mb-1">Excluded from cascade:</p>
      <ul className="space-y-0.5">
        {skippedPrompts.map((p: { promptRowId?: string; promptName: string }, i: number) => (
          <li key={p.promptRowId || i} className="truncate">
            • {p.promptName}
          </li>
        ))}
      </ul>
    </TooltipContent>
  </Tooltip>
)}
```

**Change 4**: Remove TooltipProvider from skip previews toggle (lines 126-142)
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <div className="flex items-center gap-1.5">
      <FastForward className={`h-3.5 w-3.5 ${skipAllPreviews ? 'text-primary' : 'text-on-surface-variant'}`} />
      <Switch
        checked={skipAllPreviews}
        onCheckedChange={setSkipAllPreviews}
        className="scale-75"
      />
    </div>
  </TooltipTrigger>
  <TooltipContent side="bottom" className="text-[10px]">
    Skip all action previews
  </TooltipContent>
</Tooltip>
```

**Change 5**: Replace Button with icon buttons for Pause/Resume (lines 146-158)
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <button
      onClick={isPaused ? resume : pause}
      className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
    >
      {isPaused ? (
        <Play className="h-4 w-4 text-on-surface-variant" />
      ) : (
        <Pause className="h-4 w-4 text-on-surface-variant" />
      )}
    </button>
  </TooltipTrigger>
  <TooltipContent className="text-[10px]">{isPaused ? 'Resume' : 'Pause'}</TooltipContent>
</Tooltip>
```

**Change 6**: Replace Button with icon button for Cancel (lines 159-172)
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <button
      onClick={cancel}
      disabled={isCancelling}
      className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container disabled:opacity-50"
    >
      {isCancelling ? (
        <Loader2 className="h-4 w-4 animate-spin text-destructive" />
      ) : (
        <Square className="h-4 w-4 text-destructive" />
      )}
    </button>
  </TooltipTrigger>
  <TooltipContent className="text-[10px]">{isCancelling ? 'Stopping...' : 'Stop'}</TooltipContent>
</Tooltip>
```

---

### File 3: src/components/content/PromptsContent.tsx

**Change 1**: Fix Play button disabled logic and add stop functionality (lines 1543-1563)
```typescript
{/* Play button - transforms to Stop when running */}
<Tooltip>
  <TooltipTrigger asChild>
    <button 
      onClick={() => {
        if (isRunningPrompt) {
          onCancelRun?.();
        } else if (!isManusModel) {
          onRunPrompt?.(selectedPromptId);
        }
      }}
      disabled={isManusModel && !isRunningPrompt}
      className={`w-8 h-8 flex items-center justify-center rounded-m3-full ${
        isRunningPrompt ? 'hover:bg-surface-container' : 
        isManusModel ? 'text-on-surface-variant/40 cursor-not-allowed' : 
        'text-on-surface-variant hover:bg-surface-container'
      }`}
    >
      {isRunningPrompt ? (
        <Square className="h-4 w-4 text-destructive" />
      ) : (
        <Play className="h-4 w-4 text-on-surface-variant" />
      )}
    </button>
  </TooltipTrigger>
  <TooltipContent className="text-[10px]">
    {isRunningPrompt ? 'Stop' : 
     isManusModel ? 'Manus models require cascade execution' : 
     'Run'}
  </TooltipContent>
</Tooltip>
```

**Change 2**: Fix Cascade button disabled logic and add stop functionality (lines 1565-1577)
```typescript
{/* Cascade button - transforms to Stop when running */}
<Tooltip>
  <TooltipTrigger asChild>
    <button 
      onClick={() => {
        if (isRunningCascade) {
          onCancelRun?.();
        } else {
          onRunCascade?.(selectedPromptId);
        }
      }}
      disabled={!isRunningCascade && !selectedPromptHasChildren}
      className={`w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container ${
        isRunningCascade ? '' : 
        !selectedPromptHasChildren ? 'text-on-surface-variant/40 cursor-not-allowed' : 
        'text-on-surface-variant'
      }`}
    >
      {isRunningCascade ? (
        <Square className="h-4 w-4 text-destructive" />
      ) : (
        <Workflow className="h-4 w-4 text-on-surface-variant" />
      )}
    </button>
  </TooltipTrigger>
  <TooltipContent className="text-[10px]">
    {isRunningCascade ? 'Stop Cascade' : 
     !selectedPromptHasChildren ? 'No children to cascade' : 
     'Run Cascade'}
  </TooltipContent>
</Tooltip>
```

---

## Section 6: Files Changed Summary

| File | Action | Lines Changed |
|------|--------|---------------|
| `src/pages/MainLayout.tsx` | MODIFY | ~10 lines (import, destructure, handler, render) |
| `src/components/CascadeRunProgress.tsx` | MODIFY | ~50 lines (imports, type, tooltips, buttons) |
| `src/components/content/PromptsContent.tsx` | MODIFY | ~30 lines (Play/Cascade buttons) |

---

## Section 7: Verification Checklist

- [ ] CascadeRunProgress renders below TopBar when `isRunning` is true
- [ ] Stop button in CascadeRunProgress calls `cancel()` from context
- [ ] `cancel()` invokes registered handler which calls `cancelRun()` 
- [ ] Play icon transforms to Stop (Square) icon during single prompt run
- [ ] Cascade icon transforms to Stop (Square) icon during cascade run
- [ ] Clicking Stop during run calls `handleCancelRun`
- [ ] `handleCancelRun` routes to correct cancel function based on run type
- [ ] Button disabled states allow clicking Stop when running
- [ ] All icon buttons use M3 pattern (32x32, rounded-m3-full, hover:bg-surface-container)
- [ ] No text buttons used
- [ ] Stop icon is red (text-destructive)
- [ ] Default icons are grey (text-on-surface-variant)
- [ ] TypeScript types added to formatTime function
- [ ] TooltipProvider wrappers removed (use global provider)

---

## Section 8: What This Plan Does NOT Change

- TopBar.tsx - No modifications
- ReadingPane.tsx - No modifications (only passes through props)
- CascadeRunContext.tsx - No modifications (cancel logic already correct)
- useConversationRun.ts - No modifications
- useCascadeExecutor.ts - No modifications
- Any database tables or edge functions

