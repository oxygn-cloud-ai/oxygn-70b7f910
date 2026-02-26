

## Plan: Update Webhook Secret + Fix Login Loop

### Step 1: Update OPENAI_WEBHOOK_SECRET
Use the `add_secret` tool to prompt you to enter the correct webhook signing secret from your OpenAI Dashboard (Settings → Webhooks → copy the signing secret). This resolves the persistent signature mismatch errors visible in the webhook logs.

### Step 2: Fix Login Loop (3 file changes)

**`src/App.tsx`** — Add a `/~oauth/*` route before the catch-all to prevent `ProtectedRoute` from intercepting the OAuth callback redirect:
```tsx
<Route path="/~oauth/*" element={<div />} />
```

**`src/components/ProtectedRoute.tsx`** — Add a hash check to avoid redirecting to `/auth` while OAuth tokens are still being parsed from the URL:
```tsx
const hash = window.location.hash;
if (hash && (hash.includes('access_token') || hash.includes('refresh_token'))) {
  return <loading spinner />;
}
```

**`src/contexts/AuthContext.tsx`** — Update `signOut` to use `{ scope: 'local' }` to fully clear stale tokens from localStorage, preventing them from interfering with the next login.

### Files Modified
| File | Change |
|---|---|
| (secret) | Update `OPENAI_WEBHOOK_SECRET` value |
| `src/App.tsx` | Add `/~oauth/*` route |
| `src/components/ProtectedRoute.tsx` | Add OAuth hash detection guard |
| `src/contexts/AuthContext.tsx` | Add `{ scope: 'local' }` to signOut |

