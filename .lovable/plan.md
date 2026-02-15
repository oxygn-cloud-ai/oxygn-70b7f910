

# Fix: Add Error Handling to `signInWithGoogle`

## Problem

The `signInWithGoogle` function in `AuthContext.tsx` lacks a `try/catch` block. If `lovable.auth.signInWithOAuth` throws (network failure, library error), the promise rejects unhandled instead of showing a user-facing toast.

## Change

**File:** `src/contexts/AuthContext.tsx` (lines 168-178)

Wrap the existing `lovable.auth.signInWithOAuth` call in a `try/catch` that catches thrown errors, shows a toast, and returns `{ error }` consistently.

```typescript
const signInWithGoogle = async (): Promise<{ error: Error | null }> => {
  try {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: { prompt: 'select_account' }
    });

    if (result.error) {
      toast.error(result.error.message);
      return { error: result.error };
    }

    return { error: null };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    toast.error(error.message);
    return { error };
  }
};
```

No other files are changed.

