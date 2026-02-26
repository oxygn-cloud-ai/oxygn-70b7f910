

## Analysis of Your Google OAuth Redirect URIs

Your screenshot shows three Authorised Redirect URIs in Google Cloud Console:

| # | URI | Status |
|---|---|---|
| 1 | `https://edxkisyskfazjmqpburj.supabase.co/auth/v1/callback` | ✅ Correct — active project |
| 2 | `https://enhkhbppztvipdfnanli.supabase.co/auth/v1/callback` | ❌ Stale — legacy project ID |
| 3 | `https://oxygn.lovable.app/~oauth/callback` | ✅ Correct — Lovable Cloud managed OAuth |

### Finding 1 — URI 2 uses the legacy project ID

Per your project memory: *"The legacy/external project ID `enhkhbppztvipdfnanli` must not be used."* The active project ID is `edxkisyskfazjmqpburj`. URI 2 should be removed to avoid confusion. It is not causing the current error but is dead configuration.

### Finding 2 — The URIs themselves are not the root cause

These URIs are the **server-side callbacks** — where Google sends the authorization code back to the broker (Supabase or Lovable Cloud). URI 1 and URI 3 cover both direct Supabase and Lovable Cloud flows correctly.

The current error (`failed to exchange authorization code`) is caused by a different `redirect_uri` — the one your **code** sends when initiating the OAuth flow. Your code currently sends:

```typescript
redirect_uri: `${window.location.origin}/auth`   // line 207 of AuthContext.tsx
```

Lovable Cloud documentation specifies:

```typescript
redirect_uri: window.location.origin              // no /auth suffix
```

The broker uses this value during the token exchange step. If it doesn't match what was registered/expected on the broker side, the exchange fails — which is exactly the error you're seeing.

### Finding 3 — The `oauthDetection.ts` utility does NOT detect hash errors

The current code checks `hash.includes('access_token')` etc. for success tokens, and `params.has('error')` for **query string** errors. But the actual error callback returns errors in the **hash** (`#error=server_error`), not the query string. This means `isOAuthCallbackInProgress()` would return `false` on an error callback that uses hash fragments, which is fine for the success path but means errors won't be detected as "callback in progress."

This is not the root cause but is a gap in the defensive utility.

---

## Recommended Actions

1. **Remove URI 2** (`enhkhbppztvipdfnanli`) from your Google Console — it references the legacy project and is dead configuration.
2. **Keep URI 1 and URI 3** — they are correct for the active project.
3. **Fix line 207 of `AuthContext.tsx`** — change `redirect_uri` from `${window.location.origin}/auth` to `window.location.origin`. This is the actual fix for the `failed to exchange authorization code` error.
4. **Add error hash detection in `AuthContext.tsx`** — surface OAuth errors that come back via `#error=...` so users see a clear message instead of silently staying on the login page.

The Google Console URIs are correctly configured (minus the stale legacy one). The bug is in your application code, not in Google's configuration.

