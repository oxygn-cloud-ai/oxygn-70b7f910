

## Deep Adversarial Audit of `.lovable/plan.md`

### Critical Finding 1: The plan describes changes that are ALREADY IMPLEMENTED and ALREADY FAILING

The plan.md lists 5 steps. Every substantive step (1, 2, 3) has **already been applied** to the codebase:

| Plan Step | Current Code Status |
|---|---|
| Step 1: Change `redirect_uri` to `${origin}/auth` | Already done — `AuthContext.tsx` line 210 |
| Step 2: Harden `isOAuthCallbackInProgress` with hash + query params | Already done — `ProtectedRoute.tsx` lines 9-27 |
| Step 3: Skip `INITIAL_SESSION`, load via `getSession()` | Already done — `AuthContext.tsx` line 148 |
| Step 4: Keep `/~oauth/*` route | Already done — `App.tsx` line 41 |
| Step 5: Add debug logs | Partially done — debug logs exist in both files |

The plan is **stale**. It documents the approach that was implemented and is currently failing. Executing it again would be a no-op.

### Critical Finding 2: Skipping `INITIAL_SESSION` IS the root cause

Tracing the published-domain flow through the actual library source (`@lovable.dev/cloud-auth-js`):

1. User clicks "Sign in with Google"
2. `isInIframe` = `false` on published domain (line 65 of cloud-auth-js)
3. Browser navigates away to `/~oauth/initiate?provider=google&redirect_uri=https://oxygn.lovable.app/auth&...`
4. Lovable broker completes Google auth, redirects back to `https://oxygn.lovable.app/auth#access_token=...&refresh_token=...`
5. React app boots fresh (full page load — NOT an SPA navigation)
6. Supabase client initializes, detects hash tokens, begins async processing
7. `onAuthStateChange` fires `INITIAL_SESSION` — **but the current code skips it entirely** (line 148)
8. `getSession()` is called — it races against the async hash token processing
9. If `getSession()` resolves BEFORE hash processing completes → returns `null` → `loading=false` → user appears unauthenticated
10. Auth.tsx sees `!loading && !isAuthenticated` → stays on login screen
11. `SIGNED_IN` event fires later with the real session → sets `isAuthenticated=true` → Auth.tsx effect calls `navigate('/')` → but this navigate goes to `ProtectedRoute` which may re-evaluate too fast

The race between step 8 and step 9 is non-deterministic. On fast networks/machines it may work; on slower ones it fails consistently.

### Critical Finding 3: `ProtectedRoute` infinite spinner risk

`isOAuthCallbackInProgress()` checks `window.location.hash` and `window.location.search` for OAuth markers. If the Supabase client processes tokens but the URL hash is NOT cleared (Supabase sometimes clears it, sometimes doesn't), this function returns `true` indefinitely, causing an **infinite loading spinner** with no timeout or escape hatch.

### Critical Finding 4: `AuthContextValue` interface mismatch

The `AuthContextValue` interface declares `isPlatformAdmin: boolean` and 5 tenant fields (`tenantId`, `tenantName`, `tenantRole`, `tenantStatus`, `isTenantAdmin`) — but the `value` object returned at line 297-308 does NOT include any of them. With `// @ts-nocheck` this is silent. With strict TypeScript this would be a compile error and consumers accessing these fields get `undefined`.

### Critical Finding 5: `Auth.tsx` has `// @ts-nocheck`

The plan proposes adding a "safety mechanism" to `Auth.tsx` but does not address that the file has `// @ts-nocheck`, which contradicts the requirement that all files must have strict type safety. The `handleEmailSubmit` handler parameter `e` is untyped (line 32).

### Critical Finding 6: Proposed `src/utils/oauthDetection.ts` duplicates existing code

The plan proposes creating a new shared utility file. The function `isOAuthCallbackInProgress()` already exists in `ProtectedRoute.tsx` (lines 9-27) with identical logic. The plan must specify this is an extraction/refactor, not new logic, and must remove the inline version.

### Critical Finding 7: Plan step 3 contradicts the approved conversation plan

The plan.md says "Ignore `INITIAL_SESSION` event" (step 3). But the conversation's approved fix (the one that received "Lovable plan: Approved") says the opposite: **stop skipping `INITIAL_SESSION`** and handle it with callback awareness. The plan.md was never updated to reflect the approved analysis.

### Critical Finding 8: No timeout on callback waiting

Both `ProtectedRoute` and the proposed `AuthContext` callback guard lack a timeout. If the OAuth callback fails silently (broker error, network issue, corrupted tokens), the user sees an infinite spinner with no way to recover except manually navigating to `/auth`.

### Critical Finding 9: `Auth.tsx` redirect effect has no callback awareness

`Auth.tsx` line 22-26: `useEffect(() => { if (!loading && isAuthenticated) navigate('/'); })`. When Auth.tsx loads with hash tokens (the callback landing), `loading` starts `true`, then flips to `false` after `getSession()`. If `getSession()` returns null (race), `isAuthenticated` is false, so the user stays on the login page. When `SIGNED_IN` finally fires, `isAuthenticated` becomes true and `navigate('/')` fires — but at this point the hash tokens may still be in the URL, and `ProtectedRoute` on `/` may detect them and show a spinner, or `getSession()` from `/` may still race.

---

## Revised Plan

### Goal
Fix the published-domain Google OAuth login loop. No other changes.

### Files Modified

| File | Change Type |
|---|---|
| `src/utils/oauthDetection.ts` | New file |
| `src/contexts/AuthContext.tsx` | Amend |
| `src/components/ProtectedRoute.tsx` | Amend |

Files NOT touched: `src/App.tsx`, `src/pages/Auth.tsx`, `src/integrations/lovable/index.ts` (auto-generated), any backend/DB files.

### Step 1: Create `src/utils/oauthDetection.ts`

Extract callback detection to a shared utility with strict types. No `// @ts-nocheck`.

```typescript
/**
 * Detects if the current URL contains OAuth callback markers,
 * indicating a redirect flow is in progress and session hydration
 * has not yet completed.
 */
export const isOAuthCallbackInProgress = (): boolean => {
  const hash = window.location.hash;
  const search = window.location.search;

  // Implicit flow: tokens in hash
  if (
    hash &&
    (hash.includes('access_token') ||
      hash.includes('refresh_token') ||
      hash.includes('id_token'))
  ) {
    return true;
  }

  // Authorization code flow: params in query string
  const params = new URLSearchParams(search);
  if (params.has('code') || params.has('state') || params.has('error')) {
    return true;
  }

  return false;
};
```

Why: eliminates duplication between `ProtectedRoute` and `AuthContext`. Single source of truth.

### Step 2: Amend `src/contexts/AuthContext.tsx`

**Remove `// @ts-nocheck`.** Fix all resulting type issues (the `value` object missing `isPlatformAdmin` and tenant fields).

**Stop skipping `INITIAL_SESSION`.** Handle it with callback awareness:

```typescript
// In onAuthStateChange handler:
if (event === 'INITIAL_SESSION') {
  setSession(newSession);
  const currentUser = newSession?.user ?? null;
  setUser(currentUser);

  if (currentUser) {
    // Session already resolved from hash tokens — finalize
    initialSessionHandledRef.current = true;
    setLoading(false);
    setTimeout(() => {
      setupAuthenticatedUser(currentUser, false);
    }, 0);
  } else if (!isOAuthCallbackInProgress()) {
    // No callback in progress, genuinely unauthenticated
    initialSessionHandledRef.current = true;
    setLoading(false);
  }
  // else: callback in progress but session not ready yet
  // keep loading=true, wait for SIGNED_IN event
  return;
}
```

**Remove the standalone `getSession()` call** — it races against `INITIAL_SESSION` and is the source of the null-session-during-callback bug. Replace with a **safety timeout** (5 seconds) that fires only if `INITIAL_SESSION` hasn't resolved:

```typescript
// Safety timeout: if neither INITIAL_SESSION nor SIGNED_IN
// delivers a session within 5 seconds, give up and show login
const safetyTimeout = setTimeout(() => {
  if (!mountedRef.current) return;
  if (!initialSessionHandledRef.current) {
    console.warn('[Auth] Safety timeout: no session after 5s');
    initialSessionHandledRef.current = true;
    setLoading(false);
  }
}, 5000);

// In cleanup:
return () => {
  mountedRef.current = false;
  clearTimeout(safetyTimeout);
  subscription.unsubscribe();
};
```

**Fix the `value` object** to include all declared interface fields:

```typescript
const value: AuthContextValue = {
  user,
  session,
  loading,
  isAdmin,
  isPlatformAdmin: false,  // Not yet implemented
  userProfile,
  tenantId,
  tenantName,
  tenantRole,
  tenantStatus,
  isTenantAdmin,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
  signOut,
  isAuthenticated: !!user,
};
```

**Keep `redirect_uri: \`\${window.location.origin}/auth\``** — already correct, no change needed.

### Step 3: Amend `src/components/ProtectedRoute.tsx`

Replace inline `isOAuthCallbackInProgress` with import from shared utility. Add a **timeout-based escape hatch** so the spinner cannot persist indefinitely:

```typescript
import { isOAuthCallbackInProgress } from '@/utils/oauthDetection';

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, loading } = useAuth();
  const [callbackTimedOut, setCallbackTimedOut] = useState(false);

  useEffect(() => {
    if (!isOAuthCallbackInProgress()) return;
    const timer = setTimeout(() => setCallbackTimedOut(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  const callbackInProgress = isOAuthCallbackInProgress() && !callbackTimedOut;

  if (loading || callbackInProgress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};
```

Add `import { useState, useEffect } from 'react';` to the imports.

### What is NOT changed

- `src/App.tsx` — no changes. `/~oauth/*` route stays as-is.
- `src/pages/Auth.tsx` — no changes. Its `useEffect` redirect (`if (!loading && isAuthenticated) navigate('/')`) continues to work correctly because the `SIGNED_IN` event from `AuthContext` will set `isAuthenticated=true` and `loading=false`, triggering the navigate.
- No database, edge function, or backend changes.
- No new dependencies.

### Why this fixes the loop

On published domain after Google auth:
1. Browser loads `https://oxygn.lovable.app/auth#access_token=...&refresh_token=...`
2. `/auth` route renders `Auth.tsx` (public route, no `ProtectedRoute`)
3. Supabase client initializes, detects hash, begins processing
4. `INITIAL_SESSION` fires — if session is ready (common case), `isAuthenticated=true`, `loading=false`, Auth.tsx navigates to `/`
5. If `INITIAL_SESSION` fires with null (tokens still processing), `isOAuthCallbackInProgress()` returns `true` → `loading` stays `true` → Auth.tsx shows spinner
6. `SIGNED_IN` fires with the real session → `isAuthenticated=true`, `loading=false` → Auth.tsx navigates to `/`
7. Safety timeout at 5s prevents infinite spinner

### Risk assessment

| Risk | Mitigation |
|---|---|
| `getSession()` removal breaks session restoration on normal page loads (no callback) | `INITIAL_SESSION` handles this case: session exists → immediate finalize. This is the documented Supabase pattern. |
| Safety timeout too short | 5 seconds is generous for token exchange. Can be increased if needed. |
| `isPlatformAdmin: false` hardcoded | Matches current behavior (field existed in interface but was never provided — consumers already get `undefined`). No functional change. |
| Removing `// @ts-nocheck` from AuthContext surfaces other type errors | Must fix all errors during implementation. The file is well-typed except for the missing `value` fields. |

### Validation plan

1. Publish to `oxygn.lovable.app`
2. Test Google login in incognito window (no cached session)
3. Verify: `/auth` → Google → `/auth#tokens` → auto-redirect to `/`
4. Test password login still works
5. Test page refresh with existing session (session restoration)
6. Test sign-out → redirect to `/auth`
7. Test with slow network (throttle to 3G) to stress the race window

### Technical details

Root cause: `INITIAL_SESSION` is the primary event through which Supabase delivers sessions parsed from URL hash tokens during full-page-redirect OAuth flows. Skipping it forces reliance on `getSession()`, which races against async hash processing and frequently resolves to null, leaving the user appearing unauthenticated on the login page.

