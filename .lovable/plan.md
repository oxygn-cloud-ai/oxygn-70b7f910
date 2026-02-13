

# Fix: Add Timeout for Stuck Background Responses

## Problem
The webhook signature verification fails intermittently, so `q_pending_responses` rows stay in `pending` status forever. The existing error toast (line 316-320 in MainLayout) only fires when `webhookFailed` is true, which requires the database row to be updated — but the webhook never updates it because of the 401.

The user sees "Waiting for background response..." indefinitely with no error notification.

## Solution
Add a client-side timeout inside `usePendingResponseSubscription` that transitions to a `timed_out` failure state after 3 minutes of no update. This triggers the existing error handling in MainLayout without any backend changes.

## Changes

### 1. `src/hooks/usePendingResponseSubscription.ts`
- Add a `useEffect` with a `setTimeout` of 180 seconds (3 minutes)
- If the response is still `pending` after 3 minutes, set a local `timedOut` state to `true`
- Include `timedOut` in the `isFailed` return value
- Set `errorMessage` to a descriptive timeout message when timed out
- Clear the timer on unmount or when status changes away from `pending`

### 2. `src/pages/MainLayout.tsx`
- No changes needed — the existing `webhookFailed` / `webhookErrorMessage` handling (lines 316-324) will automatically fire once the hook reports the timeout

## Technical Details

In `usePendingResponseSubscription.ts`:

```typescript
const [timedOut, setTimedOut] = useState(false);

useEffect(() => {
  if (!responseId || pendingResponse?.status !== 'pending') {
    setTimedOut(false);
    return;
  }
  const timer = setTimeout(() => {
    setTimedOut(true);
  }, 180_000); // 3 minutes
  return () => clearTimeout(timer);
}, [responseId, pendingResponse?.status]);
```

Return values updated:
- `isFailed` becomes: `timedOut || ['failed', 'cancelled', 'incomplete'].includes(pendingResponse?.status || '')`
- `errorMessage` becomes: `timedOut ? 'Background request timed out. The response may still arrive — try refreshing.' : (pendingResponse?.error || null)`

This is a single-file change that leverages the existing error flow with zero risk to other components.
