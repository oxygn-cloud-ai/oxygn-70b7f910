
# Fix: Enable Email/Password Sign-In for Allowed Domains

## Overview

Update authentication to allow email/password login for users with `@chocfin.com` or `@oxygn.cloud` domains, while keeping Google OAuth available for all users.

## Changes Required

### 1. Modify `src/contexts/AuthContext.tsx`

**Update `signInWithPassword` function (lines 207-213):**

Replace the strict whitelist check with domain-aware logic:

```typescript
const signInWithPassword = async (email: string, password: string): Promise<{ error: Error | null }> => {
  // Allow emails from allowed domains OR explicitly whitelisted emails
  const emailDomain = email.toLowerCase().split('@')[1];
  const isAllowedDomain = ['chocfin.com', 'oxygn.cloud'].includes(emailDomain);
  const isWhitelisted = WHITELISTED_EMAILS.includes(email.toLowerCase());
  
  if (!isAllowedDomain && !isWhitelisted) {
    const error = new Error('Email/password login is only available for authorized accounts');
    toast.error(error.message);
    return { error };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  // ... rest unchanged
```

**Update `signUpWithPassword` function (lines 228-234):**

Apply the same pattern:

```typescript
const signUpWithPassword = async (email: string, password: string): Promise<{ error: Error | null }> => {
  // Allow emails from allowed domains OR explicitly whitelisted emails
  const emailDomain = email.toLowerCase().split('@')[1];
  const isAllowedDomain = ['chocfin.com', 'oxygn.cloud'].includes(emailDomain);
  const isWhitelisted = WHITELISTED_EMAILS.includes(email.toLowerCase());
  
  if (!isAllowedDomain && !isWhitelisted) {
    const error = new Error('Email/password signup is only available for authorized accounts');
    toast.error(error.message);
    return { error };
  }

  const { error } = await supabase.auth.signUp({
    // ... rest unchanged
```

## What Stays the Same

- **Google OAuth** remains fully functional for all users (line 186-205)
- Server-side RLS policies continue to enforce domain restrictions via `is_allowed_domain()` function
- The `VITE_WHITELISTED_EMAILS` env variable can still be used for additional specific emails if needed

## Security Notes

- Client-side domain check aligns with server-side RLS policies
- Both use the same allowed domains: `chocfin.com` and `oxygn.cloud`
- No security regression since server-side validation is the ultimate gatekeeper

## Build Blocker

The **TS6310** error in `tsconfig.json` is a platform infrastructure issue unrelated to this fix. The auth changes can be implemented, but full testing may require platform support to resolve the build error.
