
# Fix Plan: Thread Creation Unique Constraint Violation

## Problem Summary
Chat functionality fails with "Failed to save thread" error (500) because the unique constraint `idx_q_threads_family_unique` prevents multiple active threads per prompt family per user, regardless of thread purpose (`chat` vs `run`).

## Root Cause
The unique index `idx_q_threads_family_unique` was created before the `purpose` column was introduced:
```sql
CREATE UNIQUE INDEX idx_q_threads_family_unique 
ON public.q_threads (root_prompt_row_id, owner_id) 
WHERE is_active = true AND root_prompt_row_id IS NOT NULL
```

This blocks creating a `purpose='chat'` thread when a `purpose='run'` thread already exists for the same user and prompt family.

## Solution Options

### Option A: Modify Unique Constraint to Include Purpose (Recommended)
Update the constraint to allow one active thread per purpose:

```sql
DROP INDEX IF EXISTS idx_q_threads_family_unique;

CREATE UNIQUE INDEX idx_q_threads_family_unique 
ON public.q_threads (root_prompt_row_id, owner_id, purpose) 
WHERE is_active = true AND root_prompt_row_id IS NOT NULL;
```

**Pros:**
- Preserves architectural intent (one active chat + one active run per family)
- Minimal code changes required
- Clean separation of concerns

**Cons:**
- Requires database migration

### Option B: Deactivate All Thread Types Before Create
Modify `usePromptFamilyThreads.ts` to deactivate all active threads (not just chat threads) before creating a new one.

**Pros:**
- No database change required

**Cons:**
- Would deactivate execution threads, breaking run history
- Violates architectural separation between chat and run threads
- Not recommended

---

## Recommended Implementation: Option A

### Step 1: Database Migration
Create migration to update the unique constraint:

```sql
-- Drop existing constraint that doesn't account for purpose
DROP INDEX IF EXISTS idx_q_threads_family_unique;

-- Create new constraint that allows one active thread per purpose
CREATE UNIQUE INDEX idx_q_threads_family_unique 
ON public.q_threads (root_prompt_row_id, owner_id, purpose) 
WHERE is_active = true AND root_prompt_row_id IS NOT NULL;
```

### Step 2: No Code Changes Required
The existing client code in `usePromptFamilyThreads.ts` already correctly:
- Deactivates only `chat` threads before creating a new chat thread (lines 78-84)
- Passes `purpose: 'chat'` when creating threads (line 97)

### Step 3: Verification
After migration:
- Existing `run` threads remain unaffected
- New `chat` threads can be created alongside existing `run` threads
- Each purpose type maintains single-active-thread semantics

---

## Technical Details

### Current Database State
```
row_id: 8be3a08f-10f5-4b30-af5f-39c4656368f0
root_prompt_row_id: 0d69b830-8837-4281-8801-051c1a1ee4ee
owner_id: 1da78055-6734-4b6e-8a50-9833d644cfca
purpose: run
is_active: true
```

### After Fix
The above `run` thread will continue to exist, and a new `chat` thread can be created:
```
root_prompt_row_id: 0d69b830-8837-4281-8801-051c1a1ee4ee
owner_id: 1da78055-6734-4b6e-8a50-9833d644cfca
purpose: chat
is_active: true
```

### Constraint Behavior After Fix
- `(root_prompt_row_id, owner_id, purpose='chat')` - One active allowed
- `(root_prompt_row_id, owner_id, purpose='run')` - One active allowed
- Both can coexist

---

## Risk Assessment
| Risk | Level | Mitigation |
|------|-------|------------|
| Data loss | None | Index modification only, no data affected |
| Downtime | None | Index changes are non-blocking |
| Rollback complexity | Low | Can restore original index if needed |

## Estimated Effort
- Migration: 5 minutes
- Testing: 10 minutes
