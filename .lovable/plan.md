

# Fix: "Cannot access 'webhookComplete' before initialization"

## Problem

The last edit placed the `useEffect` (line ~255) **above** the state and hook declarations (line ~318) that define `webhookComplete`, `webhookFailed`, `pendingWebhookResponseId`, etc. JavaScript's temporal dead zone prevents accessing `const`/`let` variables before they are declared, causing the app to crash on load.

## Fix

Move the GPT-5 webhook response delivery `useEffect` block (currently at lines 255-289) to **after** the state + hook declarations (after line ~328). No logic changes needed -- just reordering.

### `src/pages/MainLayout.tsx`

1. **Remove** the `useEffect` block from its current position (lines 255-289)
2. **Insert** the same `useEffect` block after the `usePendingResponseSubscription` hook call (after line ~328)

This ensures all referenced variables (`pendingWebhookResponseId`, `webhookComplete`, `webhookFailed`, `webhookOutputText`, `webhookErrorMessage`, `clearWebhookPending`, `pendingWebhookPromptId`) are declared before use.

## Scope

- Single file change: `src/pages/MainLayout.tsx`
- Code movement only, no logic changes

