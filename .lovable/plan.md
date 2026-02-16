

## Fix: Tree Not Showing Child Prompts After Background Action Completion

### Root Cause

The `refreshTreeData()` call at line 435 **is working** -- the tree data is being refreshed. The problem is that the **parent folder is not being auto-expanded**, so the newly created children are invisible in the collapsed tree until a manual page refresh (which resets expanded state).

The auto-expand logic on line 438 checks:
```
if (actionResult.data?.createdCount > 0)
```

But `executePostAction` returns a **flat** object:
```
{ success: true, createdCount: 6, children: [...], placement: 'children', ... }
```

The properties are directly on `actionResult`, not nested under `.data`. So `actionResult.data` is always `undefined`, the condition is always false, and `setExpandedFolders` is never called. The children exist in the tree but the folder stays collapsed.

This same bug also exists in the **inline flow** (line 935) -- it just happens to be less noticeable there because the user is already viewing the prompt.

### Changes

**File: `src/pages/MainLayout.tsx`**

1. **Webhook post-action auto-expand (lines 438-447)**: Change `actionResult.data?.createdCount` to `actionResult.createdCount`, and `actionResult.data?.placement` to `actionResult.placement`, and `actionResult.data?.targetParentRowId` to `actionResult.targetParentRowId`.

2. **Inline post-action auto-expand (lines 935-944)**: Apply the same fix -- change `actionResult.data?.` references to direct `actionResult.` references.

Both blocks become:
```
if (actionResult.createdCount > 0) {
  const parentId = actionResult.placement === 'children'
    ? promptData.row_id
    : (actionResult.placement === 'specific_prompt'
        ? actionResult.targetParentRowId
        : promptData.parent_row_id);
  if (parentId) {
    setExpandedFolders(prev => ({ ...prev, [parentId]: true }));
  }
}
```

### Scope

- Only `src/pages/MainLayout.tsx` is modified (two small blocks)
- No backend or edge function changes needed

