

## Diagnosis

**Evidence from network logs and session replay:**
- Password auth succeeds (6+ calls returning HTTP 200 with valid tokens)
- `is_admin` and `profiles` fetches fire (confirming `setupAuthenticatedUser` runs)
- The Sign In button shows a spinner for ~400ms then re-enables with "Sign In" text
- User remains on `/auth` for 48+ seconds despite being authenticated
- No console errors

**Root cause:** Auth.tsx relies solely on a reactive `useEffect` to navigate after login:
```typescript
useEffect(() => {
  if (!loading && isAuthenticated) {
    navigate('/');
  }
}, [isAuthenticated, loading, navigate]);
```

This pattern has a timing fragility: `supabase.auth.signInWithPassword` resolves its promise (triggering `setIsSubmitting(false)` which re-renders Auth.tsx) in the same microtask batch as `onAuthStateChange` fires SIGNED_IN (which sets `user` in context). Depending on React's batching behavior in the preview iframe, the useEffect may fire with stale closure values or miss the `isAuthenticated` transition entirely — especially when the user double-clicks (which the session replay confirms: two submissions within 133ms, creating competing session updates).

**The fix:** Add explicit navigation on successful login in `handleEmailSubmit`, so the redirect doesn't depend solely on the reactive useEffect. Keep the useEffect as a fallback for page-load scenarios (e.g., returning with an existing session).

---

## Plan

### File: `src/pages/Auth.tsx`

**Change:** In `handleEmailSubmit`, navigate to `/` explicitly when login/signup succeeds, instead of relying solely on the context-driven useEffect.

**Current code (lines 31-42):**
```typescript
const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setIsSubmitting(true);
  
  if (isSignUp) {
    await signUpWithPassword(email, password);
  } else {
    await signInWithPassword(email, password);
  }
  
  setIsSubmitting(false);
};
```

**New code:**
```typescript
const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setIsSubmitting(true);
  
  const result = isSignUp
    ? await signUpWithPassword(email, password)
    : await signInWithPassword(email, password);
  
  if (!result.error && !isSignUp) {
    navigate('/');
  }
  
  setIsSubmitting(false);
};
```

Key details:
- Only navigates for sign-in (not sign-up, which may require email verification)
- Checks `result.error` to avoid navigating on failure
- The existing useEffect is kept as a fallback (handles page-load redirects for existing sessions)
- No other changes to Auth.tsx or AuthContext.tsx

### Files NOT changed
- `src/contexts/AuthContext.tsx` — no changes needed
- `src/components/ProtectedRoute.tsx` — no changes needed
- No backend, database, or dependency changes

### Technical detail
The `signInWithPassword` function returns `{ error: null }` on success. By the time this promise resolves, `supabase.auth.signInWithPassword` has already internally stored the session. So when `navigate('/')` fires, ProtectedRoute will see `isAuthenticated=true` (the `onAuthStateChange` SIGNED_IN event has already set the user in context) and render MainLayout instead of redirecting back to `/auth`.

