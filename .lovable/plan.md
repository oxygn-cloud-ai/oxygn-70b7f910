

# Fix: Proper Error Handling for Thread Loading

## Problem Summary

When loading threads, the `useThreads.ts` hook shows a generic "Failed to load threads" error instead of the specific "OpenAI Not Configured" message. The edge function correctly returns the `OPENAI_NOT_CONFIGURED` error code, but the frontend doesn't parse it.

**Evidence from logs:**
```
2026-01-27T11:51:23Z WARNING [credentials] Failed to get credential: 404
2026-01-27T11:51:22Z INFO User validated: james@chocfin.com
```

The user is authenticated but has no OpenAI API key configured.

## Root Cause

In `src/hooks/useThreads.ts`, the `fetchThreads` function (lines 45-49) catches errors but displays a hardcoded toast message:

```typescript
} catch (error) {
  if (isMountedRef.current) {
    console.error('Error fetching threads:', error);
    toast.error('Failed to load threads');  // <-- Generic message, not using parseApiError
  }
}
```

The `parseApiError` utility exists in `src/utils/apiErrorUtils.ts` and correctly maps `OPENAI_NOT_CONFIGURED` to "Configure your OpenAI API key in Settings → Integrations → OpenAI." but it's not being used here.

## Solution

Update `useThreads.ts` to:
1. Import `parseApiError` from `apiErrorUtils.ts`
2. Parse the error response from the edge function
3. Display the parsed error message instead of the generic one
4. Apply the same pattern to all error handlers in the hook

## Implementation

### File: `src/hooks/useThreads.ts`

**Changes:**

1. **Add import** (line 4):
```typescript
import { parseApiError } from '@/utils/apiErrorUtils';
```

2. **Update `fetchThreads` error handler** (lines 45-49):
```typescript
} catch (error) {
  if (isMountedRef.current) {
    console.error('Error fetching threads:', error);
    const parsed = parseApiError(error);
    toast.error(parsed.title, {
      description: parsed.message,
      source: 'useThreads.fetchThreads',
      errorCode: parsed.code,
    });
  }
}
```

3. **Update `createThread` error handler** (lines 83-90):
```typescript
} catch (error) {
  console.error('Error creating thread:', error);
  const parsed = parseApiError(error);
  toast.error(parsed.title, {
    description: parsed.message,
    source: 'useThreads.createThread',
    errorCode: parsed.code,
    details: JSON.stringify({ assistantRowId, childPromptRowId, name, error: error?.message }, null, 2),
  });
  return null;
}
```

4. **Update `deleteThread` error handler** (lines 119-125):
```typescript
} catch (error) {
  console.error('Error deleting thread:', error);
  const parsed = parseApiError(error);
  toast.error(parsed.title, {
    description: parsed.message,
    source: 'useThreads.deleteThread',
    errorCode: parsed.code,
    details: JSON.stringify({ threadRowId, error: error?.message }, null, 2),
  });
  return false;
}
```

5. **Update `fetchMessages` error handler** (lines 148-150):
```typescript
} catch (error) {
  console.error('Error fetching messages:', error);
  const parsed = parseApiError(error);
  toast.error(parsed.title, {
    description: parsed.message,
    source: 'useThreads.fetchMessages',
    errorCode: parsed.code,
  });
  return [];
}
```

6. **Update `renameThread` error handler** (lines 177-179):
```typescript
} catch (error) {
  console.error('Error renaming thread:', error);
  const parsed = parseApiError(error);
  toast.error(parsed.title, {
    description: parsed.message,
    source: 'useThreads.renameThread',
    errorCode: parsed.code,
  });
  return false;
}
```

## Technical Details

The `parseApiError` function:
1. First checks for an explicit `error_code` or `code` property on the error object
2. Then matches the error message against known patterns
3. Returns structured data: `{ code, title, message, recoverable }`

For `OPENAI_NOT_CONFIGURED`, it returns:
- **title**: "OpenAI Not Configured"  
- **message**: "Configure your OpenAI API key in Settings → Integrations → OpenAI."

This is much more actionable than "Failed to load threads".

## Verification

After implementation:
1. When a user without an OpenAI API key tries to load threads, they will see:
   - **Title**: "OpenAI Not Configured"
   - **Message**: "Configure your OpenAI API key in Settings → Integrations → OpenAI."
2. The user can then navigate to Settings and add their API key
3. Thread loading will work after the key is configured

