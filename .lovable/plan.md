

## Fix: Auto-Run Created Children Not Triggering

### Problem

After an action node completes and children are successfully created, the "auto run created children" toggle is enabled (`auto_run_children: true` confirmed in DB) but the auto-cascade does not fire. No "Auto-running N created child prompt(s)..." toast appears.

### Root Cause Analysis

The condition at line 474 (webhook flow) and line 975 (inline flow) checks:
```
if (promptData.auto_run_children && actionResult.children?.length > 0)
```

While `promptData.auto_run_children` is confirmed `true` in the database, the issue is that `actionResult.children` may be undefined or empty. This can happen if:

1. The `executePostAction` wrapper catches an error internally and returns `{ success: true }` without the `children` array (edge case in error recovery)
2. The executor's DB inserts succeed (children appear in tree) but the `select()` call after insert returns minimal data, or the `createdChildren` array isn't properly populated in certain conditions

### Solution

Add a **fallback mechanism**: when `auto_run_children` is enabled and `actionResult.createdCount > 0` but `actionResult.children` is empty/missing, fetch the newly created children directly from the database. Also add diagnostic logging to help trace future issues.

### Technical Changes

**File: `src/pages/MainLayout.tsx`**

**1. Webhook flow (around line 473-493):**

Replace the auto-run block with:
```typescript
// Auto-run created children if enabled
if (promptData.auto_run_children && actionResult.createdCount > 0) {
  // Use actionResult.children if available, otherwise fetch from DB
  let childrenToRun = actionResult.children;
  
  if (!childrenToRun || childrenToRun.length === 0) {
    console.warn('auto_run_children: actionResult.children empty despite createdCount > 0, fetching from DB');
    const { data: dbChildren } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select('row_id, prompt_name')
      .eq('parent_row_id', actionResult.placement === 'children' 
        ? completedPromptId 
        : (actionResult.targetParentRowId || completedPromptId))
      .eq('is_deleted', false)
      .order('position', { ascending: true });
    childrenToRun = dbChildren || [];
  }
  
  if (childrenToRun.length > 0) {
    toast.info(`Auto-running ${childrenToRun.length} created child prompt(s)...`);
    try {
      const cascadeResult = await executeChildCascade(
        childrenToRun,
        promptData,
        { maxDepth: 99 }
      );
      // ... existing cascade result handling
    } catch (cascadeError) {
      // ... existing error handling
    }
  }
}
```

**2. Inline flow (around line 974-1006):**

Apply the same fallback pattern -- check `actionResult.createdCount > 0` instead of relying solely on `actionResult.children?.length > 0`, and fetch from DB if needed.

**3. Add console.log diagnostics** in both flows:
```typescript
console.log('Post-action auto-run check:', {
  auto_run_children: promptData.auto_run_children,
  createdCount: actionResult.createdCount,
  childrenLength: actionResult.children?.length,
  success: actionResult.success,
});
```

### Why This Fixes It

The current code requires BOTH `auto_run_children === true` AND `actionResult.children?.length > 0`. By changing the condition to use `createdCount > 0` (which is reliably set) and adding a DB fallback for the children array, the auto-run will trigger even if the `children` array is missing from the executor result.

### Scope

- Only `src/pages/MainLayout.tsx` modified (two blocks)
- No edge function or database changes needed

