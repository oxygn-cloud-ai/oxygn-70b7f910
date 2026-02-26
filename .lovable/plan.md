
Goal: eliminate the published-domain OAuth loop where Google login returns to the login screen.

What I found
- The loop is reproducible in the “published domain” path specifically (your answer confirms this), while preview auth requests show valid authenticated calls.
- Current Google OAuth starts with `redirect_uri: window.location.origin` (root `/`), which is protected by `ProtectedRoute`.
- If auth state briefly resolves to unauthenticated during callback processing, `/` is immediately redirected to `/auth`, which can discard OAuth callback params before session hydration finishes.
- Current `ProtectedRoute` guard only checks URL hash tokens (`access_token`, `refresh_token`) and does not guard query-based callbacks (`code`, `state`) that are common in redirect flows.
- Initial auth state handling in `AuthContext` can still transiently set `loading=false` too early for callback race windows.

Implementation plan
1) Make OAuth return to a public route first
- File: `src/contexts/AuthContext.tsx`
- Change Google sign-in redirect URI from root origin to `/auth`:
  - from: `redirect_uri: window.location.origin`
  - to: `redirect_uri: \`\${window.location.origin}/auth\``
- Why: `/auth` is public, so callback parameters are not intercepted by `ProtectedRoute`. Auth can complete there, then existing `Auth.tsx` effect redirects authenticated users to `/`.

2) Harden callback-in-progress detection in route protection
- File: `src/components/ProtectedRoute.tsx`
- Expand OAuth-in-progress detection to include query params and callback markers, not only hash:
  - hash: `access_token`, `refresh_token`, `id_token`
  - search: `code`, `state`, `error`, `error_description`
- While any callback marker exists, render loading state (no redirect).
- Why: prevents premature redirect that strips callback params before session is established.

3) Remove initial-session race window in auth state bootstrap
- File: `src/contexts/AuthContext.tsx`
- Update `onAuthStateChange` handler logic:
  - Ignore `INITIAL_SESSION` event for redirect-critical state transitions.
  - Only finalize first-load `loading=false` via `getSession()` completion path.
  - Keep post-initial events (`SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`) active as normal.
- Why: avoids early unauthenticated render during callback hydration.

4) Keep current `/~oauth/*` route, but do not rely on it
- File: `src/App.tsx`
- Keep existing route for safety/compat:
  - `<Route path="/~oauth/*" element={<div />} />`
- Why: harmless fallback, but the real stabilization is callbacking to `/auth` + stronger guards.

5) Add targeted diagnostics for one deploy cycle (temporary)
- File: `src/contexts/AuthContext.tsx`, `src/components/ProtectedRoute.tsx`
- Add concise debug logs for:
  - auth event type
  - current pathname/search/hash presence of OAuth markers
  - redirect decisions in `ProtectedRoute`
- Remove or reduce once verified.
- Why: gives definitive visibility on live callback timing and prevents blind retries.

Validation plan (must be end-to-end on live)
1. Publish frontend update to live (critical: live uses published frontend bundle, not test preview bundle).
2. Test Google login on `https://oxygn.lovable.app` in:
   - normal window
   - incognito window
3. Verify expected path sequence:
   - `/auth` → Google → back to `/auth` with callback params → authenticated redirect to `/`
4. Confirm no bounce back to login and no repeated redirect loops.
5. Confirm auth logs continue showing successful `/user` calls and no abnormal sign-out churn.

Rollback/safety
- If any regression appears, quick rollback path is to keep current behavior except step (1) redirect URI to `/auth`, which is the lowest-risk, highest-impact fix.
- No database or backend schema change required.

Technical details
- Root cause class: frontend callback-routing race in published non-iframe OAuth flow.
- Why preview can differ: preview often uses a web-message/popup path; published uses full-page redirect path.
- Session establishment in redirect flows may rely on callback query/hash presence at load time; redirecting away too early loses that state.
- This plan addresses both callback-route safety and auth bootstrap timing deterministically.
