

# Fix Google Sign-In (Lovable Cloud Migration)

## Root Cause

Google sign-in stopped working because the project now runs on Lovable Cloud, which manages OAuth differently. The current code at line 203 of `AuthContext.tsx` calls `supabase.auth.signInWithOAuth()` directly -- this no longer works on Lovable Cloud.

The required integration module (`src/integrations/lovable/`) does not exist.

## Fix

### Step 1: Configure Social Login (automated)

Use the Lovable Cloud social login configuration tool to generate the `src/integrations/lovable/` module and install the `@lovable.dev/cloud-auth-js` package. These files are auto-managed and will not be manually edited.

### Step 2: Update `signInWithGoogle` in `AuthContext.tsx`

Replace the direct Supabase OAuth call (lines 200-219) with the Lovable Cloud managed function:

```text
Before:
  supabase.auth.signInWithOAuth({ provider: 'google', ... })

After:
  lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin,
    extraParams: { prompt: 'select_account' }
  })
```

No other functions are changed -- password login and sign-up continue using `supabase.auth` as before.

### Files Changed

| File | Change |
|------|--------|
| `src/integrations/lovable/` | Auto-generated (do not edit) |
| `src/contexts/AuthContext.tsx` | Update `signInWithGoogle` function only |

### What stays the same

- Password sign-in and sign-up (unchanged, uses `supabase.auth`)
- Sign-out logic (unchanged)
- Admin checks, profile fetching, tenant logic (unchanged)
- Auth state listener and session handling (unchanged)

