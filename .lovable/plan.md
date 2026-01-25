
# Remediation Plan: Build Error and Batch Handler Fixes

## Priority 1: Fix Build Error (CRITICAL)

### File: `tsconfig.node.json`

Add `"noEmit": false` to fix TS6310 error:

```json
{
  "compilerOptions": {
    "composite": true,
    "noEmit": false,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

**Rationale:** When `composite: true` is set and the project is referenced by another tsconfig, TypeScript requires the referenced project to be able to emit declaration files. Setting `noEmit: false` explicitly allows this.

---

## Priority 2: Add Error Handling to Batch Handlers (MEDIUM)

### File: `src/components/layout/FolderPanel.tsx`

Wrap all batch operations in try/catch with finally block for cleanup:

**Star handler (lines 680-692):**
```typescript
onClick={async () => { 
  if (isMultiSelectMode && selectedItems && selectedItems.size > 0) {
    const anyStarred = Array.from(selectedItems).some(itemId => {
      const item = allFlatItems?.find(f => f.id === itemId)?.item;
      return item?.starred;
    });
    try {
      await onBatchStar?.(Array.from(selectedItems), !anyStarred);
    } catch (error) {
      console.error('Batch star operation failed:', error);
      toast.error('Some items could not be updated');
    } finally {
      clearSelection?.();
    }
  } else {
    onToggleStar?.(id); 
  }
  setOpenMenuId?.(null); 
}}
```

Apply same pattern to:
- Duplicate handler (lines 757-765)
- Delete handler (lines 830-838)
- Exclude from Cascade handler (lines 789-801)
- Exclude from Export handler (lines 811-823)

---

## Priority 3: Fix Performance Issue in useCascadeExecutor (LOW)

### File: `src/hooks/useCascadeExecutor.ts`

**Line 1731-1769:** Change from `for...of` to indexed loop to avoid O(n²) complexity:

```typescript
for (let idx = 0; idx < children.length; idx++) {
  const child = children[idx];
  // ... existing cancellation checks ...
  
  // Update progress to highlight the currently running child prompt
  updateProgress(
    currentDepth,
    childPrompt.prompt_name || 'Untitled',
    idx + 1,  // Now uses loop index directly, O(1)
    childPrompt.row_id
  );
  // ... rest of loop ...
}
```

---

## Priority 4: Optional - Memoize Label Computation (LOW)

This is a minor performance optimization that can be deferred. The current implementation is correct but recalculates on every render.

---

## Priority 5: Restore Deleted File (LOW)

### File: `.lovable/plan.md`

Create the file with current implementation documentation or leave as intentionally deleted if not needed for project operation.

---

## Files to Modify

1. `tsconfig.node.json` - Add `noEmit: false`
2. `src/components/layout/FolderPanel.tsx` - Add try/catch to 5 batch handlers
3. `src/hooks/useCascadeExecutor.ts` - Convert to indexed for-loop

## Estimated Complexity

- Lines modified: ~30
- Risk: Low (targeted fixes)
- Build should pass after tsconfig fix
