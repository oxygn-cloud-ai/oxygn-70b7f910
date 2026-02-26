

## Auth Login Redirect Fix

### Root cause
`Auth.tsx` calls `navigate('/')` imperatively before React has flushed the `isAuthenticated` state update. `ProtectedRoute` reads stale state and bounces back to `/auth`.

### Fix: One file change — `src/pages/Auth.tsx`

**1. Imports (lines 1-2)**
- Remove `useEffect` from React import
- Replace `useNavigate` with `Navigate` from `react-router-dom`

**2. Delete (lines 13, 21-25)**
- Delete `const navigate = useNavigate()`
- Delete the navigation `useEffect` block

**3. Replace `handleGoogleSignIn` (lines 27-32)**
```typescript
const handleGoogleSignIn = async () => {
  if (isSubmitting) return;
  setIsSubmitting(true);
  try {
    await signInWithGoogle();
  } finally {
    setIsSubmitting(false);
  }
};
```

**4. Replace `handleEmailSubmit` (lines 34-47)**
```typescript
const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setIsSubmitting(true);
  const result = isSignUp
    ? await signUpWithPassword(email, password)
    : await signInWithPassword(email, password);
  if (result.error || isSignUp) {
    setIsSubmitting(false);
  }
};
```

**5. Add declarative redirect after loading check (after line 55)**
```typescript
if (isAuthenticated) {
  return <Navigate to="/" replace />;
}
```

**6. Google button — add disabled prop (line 83)**
```typescript
<Button
  onClick={handleGoogleSignIn}
  disabled={isSubmitting}
  ...
```

### No other files changed
- `AuthContext.tsx` — unchanged
- `ProtectedRoute.tsx` — unchanged
- No backend, routing, or dependency changes

