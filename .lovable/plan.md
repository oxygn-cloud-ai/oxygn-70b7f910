

# CORS Fix: Add Specific Project Domain Only

## Problem

The application is being accessed from `https://5c8b7a90-dc2a-4bd7-9069-c2c2cd2e6062.lovableproject.com`, which is not in the CORS whitelist. This causes all edge function requests to fail with "Failed to fetch" errors.

## Solution

Add only the specific project domain to the `ALLOWED_ORIGINS` list as an exact match - no wildcard patterns for lovableproject.com.

## Implementation

### File: `supabase/functions/_shared/cors.ts`

**Change:** Add the specific lovableproject.com domain to the whitelist (line 37-38 area)

```typescript
const ALLOWED_ORIGINS: readonly string[] = [
  // Production
  'https://qonsol.app',
  'https://www.qonsol.app',
  
  // Lovable preview/deploy URLs
  'https://id-preview--5c8b7a90-dc2a-4bd7-9069-c2c2cd2e6062.lovable.app',
  'https://5c8b7a90-dc2a-4bd7-9069-c2c2cd2e6062.lovableproject.com',
  
  // Development
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
] as const;
```

**No changes to `isAllowedOrigin` function** - the existing exact-match logic on line 59 will handle this automatically.

## Security Note

This approach is more restrictive than a wildcard pattern. Only the exact project UUID-based domain is allowed, not any arbitrary lovableproject.com subdomain.

## Verification

After deployment, requests from `https://5c8b7a90-dc2a-4bd7-9069-c2c2cd2e6062.lovableproject.com` will be allowed, and the "Failed to fetch" errors will resolve.

