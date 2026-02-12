

# Revised Plan: Persistent Background Processing Indicator

## Audit Findings

### Finding 1: All files use `@ts-nocheck` -- strict typing is impossible without a broader refactor

`MainLayout.tsx`, `ReadingPane.tsx`, `PromptsContent.tsx`, and `ResizableOutputArea.tsx` all have `// @ts-nocheck` at line 1. The plan stated "All new and amended files must be TypeScript with strict type safety." This is not achievable for these files without removing `@ts-nocheck` and fixing hundreds of pre-existing type errors -- far outside scope. **Resolution**: Accept that these files are `@ts-nocheck`. New code should still be written with correct types in practice (typed state, typed props destructuring) even though the compiler won't enforce it.

### Finding 2: `PromptTabContent` is an internal component -- the prop threading path is wrong

The plan says the prop flows to `PromptTabContent` as a separate step. In reality, `PromptTabContent` is defined **inside** `PromptsContent.tsx` (line 202) as a local component, not an exported standalone component. It's called at line 1669. This means the prop does NOT need a separate "PromptTabContent accepts and forwards" step -- `PromptTabContent` must simply receive it in its own parameter list and pass it to `ResizableOutputArea`. The plan's threading path is correct in substance but slightly misleading in presentation.

### Finding 3: No duplication risk

Searched for `isWaitingForBackground` -- zero matches. The Conversation Panel's `ThinkingIndicator` uses `isWaitingForWebhook` (different path, different component). No overlap.

### Finding 4: The banner should also show when `webhookComplete` fires but output hasn't refreshed yet

If the webhook completes but `fetchItemData` is still in-flight, the banner would disappear (because `pendingWebhookResponseId` is cleared in the effect). This is a minor race but acceptable -- the toast will still notify the user.

### Finding 5: Banner visibility when user switches tabs

`PromptTabContent` is only rendered when `activeTab === "prompt"`. If the user is on the "settings" or "variables" tab, the banner won't be visible. This is acceptable -- the toast handles notification regardless of tab, and the banner appears when they return to the prompt tab.

### Finding 6: Banner should not show alongside the existing progress indicator

The plan correctly specifies "when `isWaitingForBackground` is true and `isRegenerating` is false." The existing `AnimatePresence` block (lines 307-369) already guards on `isRegenerating && progress`. These are mutually exclusive because `endSingleRun()` is called before `setPendingWebhookResponseId`, so `isRegenerating` will be false when the background banner appears. Confirmed safe.

### Finding 7: No architectural divergence

The plan adds a single boolean prop threaded through existing component boundaries. This follows the exact same pattern as `isRunningPrompt`, `runProgress`, `isCascadeRunning`, and `singleRunPromptId` -- all threaded from `MainLayout` through `ReadingPane` through `PromptsContent` to child components. No new patterns introduced.

---

## Revised Implementation

### 1. `src/pages/MainLayout.tsx` -- Derive and pass prop (1 line)

Add to the `ReadingPane` JSX (after line ~1493):

```
isWaitingForBackground={pendingWebhookResponseId !== null}
```

### 2. `src/components/layout/ReadingPane.tsx` -- Accept and forward (2 lines)

Add `isWaitingForBackground = false` to the destructured props. Forward it to `PromptsContent`:

```
isWaitingForBackground={isWaitingForBackground}
```

### 3. `src/components/content/PromptsContent.tsx` -- Accept and forward (3 lines)

a) Add `isWaitingForBackground = false` to `PromptsContent` props (around line 1320).

b) Add `isWaitingForBackground = false` to `PromptTabContent` props (line 202).

c) Pass it to `ResizableOutputArea` in `PromptTabContent` JSX (line 238):

```
isWaitingForBackground={isWaitingForBackground}
```

d) Pass it from `PromptsContent` to `PromptTabContent` (line 1669):

```
isWaitingForBackground={isWaitingForBackground}
```

### 4. `src/components/shared/ResizableOutputArea.tsx` -- Add indicator (approx 20 lines)

a) Add `isWaitingForBackground = false` to the destructured props (line 92).

b) Add a new `AnimatePresence` block immediately after the existing progress indicator block (after line 369), before the content area:

```jsx
<AnimatePresence>
  {isWaitingForBackground && !isRegenerating && (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="flex items-center gap-2 px-2 py-1.5 bg-amber-500/5 rounded-m3-sm border border-amber-500/10">
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-1.5 h-1.5 rounded-full bg-amber-500"
        />
        <span className="text-[10px] text-amber-500">
          Waiting for background response...
        </span>
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

## What this changes

- 4 files, approximately 30 lines total
- Pure prop threading + a small visual element
- No logic changes, no database changes, no edge function changes
- No changes to any existing indicator, toast, or subscription logic

## What this does NOT change

- The webhook delivery effect (already implemented and working)
- The Conversation Panel's `ThinkingIndicator` / `isWaitingForWebhook`
- Any existing progress indicator styling or behavior
- The `usePendingResponseSubscription` hook

