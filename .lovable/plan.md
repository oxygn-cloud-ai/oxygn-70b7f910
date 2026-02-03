

# Remediation Plan for Remaining Issues

## Summary of Findings

The previous remediation was **partially successful** but two issues remain:

1. **CRITICAL (Build Blocking):** The `TS6310` error persists despite adding `noEmit: false` to `tsconfig.node.json`
2. **MEDIUM:** The duplicate processing guard specified in the plan was not implemented

---

## Step 1: Fix Build Error (CRITICAL)

**Problem:** TypeScript project references require the referenced project to have emit enabled, but the `noEmit: false` fix is not resolving the build error.

**Solution:** Remove the project reference entirely from `tsconfig.json`.

**File:** `tsconfig.json`

**Change:** Remove lines 31-35 (the `references` array):

```json
// REMOVE THIS:
  "references": [
    {
      "path": "./tsconfig.node.json"
    }
  ]
```

**Rationale:** 
- The `vite.config.ts` is already transpiled by Vite's internal esbuild using `esbuild.tsconfigRaw` (defined in `vite.config.ts` lines 32-44)
- The TypeScript project reference is redundant and only causing build issues
- This is a standard approach for Vite projects

---

## Step 2: Add Duplicate Processing Guard (MEDIUM)

**Problem:** The plan specified adding a `processedRef` guard to prevent duplicate message insertion if the effect runs multiple times, but this was omitted.

**File:** `src/hooks/usePromptFamilyChat.ts`

**Changes:**

1. Add ref after line 71:
```typescript
const processedWebhookRef = useRef<string | null>(null);
```

2. Add guard in webhook effect (after line 127):
```typescript
// Guard against duplicate processing
if (processedWebhookRef.current === pendingId) {
  console.log('[PromptFamilyChat] Already processed webhook:', pendingId);
  return;
}
```

3. Set the processed flag when processing (after line 130):
```typescript
if (webhookComplete && webhookOutput) {
  // Mark as processed BEFORE doing work to prevent race
  processedWebhookRef.current = pendingId;
  // ... rest of code
```

4. Reset in switchThread (line 168):
```typescript
const switchThread = useCallback(async (threadId: string): Promise<void> => {
  processedWebhookRef.current = null;  // Reset on thread switch
  // ... rest of code
```

5. Reset in createThread (line 177):
```typescript
const createThread = useCallback(async (title = 'New Chat'): Promise<ChatThread | null> => {
  processedWebhookRef.current = null;  // Reset on new thread
  // ... rest of code
```

---

## Files to Modify

| File | Change | Priority |
|------|--------|----------|
| `tsconfig.json` | Remove `references` array (lines 31-35) | CRITICAL |
| `src/hooks/usePromptFamilyChat.ts` | Add `processedWebhookRef` guard | MEDIUM |

---

## Verification Checklist

After implementation:
1. Build completes without `TS6310` error
2. Webhook completion effect only processes each response once
3. Thread switching clears the processed webhook ref
4. All existing functionality continues to work

