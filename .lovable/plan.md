

# Remediation Plan for Multi-Select Popup Menu Audit Findings

## Scope
Fix bugs identified in the adversarial audit of the multi-select popup menu implementation, plus address the child prompt highlighting issue.

---

## Part 1: Fix Batch Toggle Behavior Bugs

### File: `src/components/layout/FolderPanel.tsx`

### Step 1.1: Fix Star Batch Toggle Logic
**Current (Line 679-686):**
```typescript
onClick={() => { 
  if (isMultiSelectMode && selectedItems && selectedItems.size > 0) {
    onBatchStar?.(Array.from(selectedItems), true);  // BUG: Always stars
    clearSelection?.();
  } else {
    onToggleStar?.(id); 
  }
  setOpenMenuId?.(null); 
}}
```

**Fixed:**
```typescript
onClick={async () => { 
  if (isMultiSelectMode && selectedItems && selectedItems.size > 0) {
    // Determine toggle state: if ANY selected item is starred, unstar all; otherwise star all
    const anyStarred = Array.from(selectedItems).some(itemId => {
      const item = allFlatItems.find(f => f.id === itemId)?.item;
      return item?.starred;
    });
    await onBatchStar?.(Array.from(selectedItems), !anyStarred);
    clearSelection?.();
  } else {
    onToggleStar?.(id); 
  }
  setOpenMenuId?.(null); 
}}
```

**Also update label:**
```typescript
label={isMultiSelectMode && selectedItems?.size 
  ? `${Array.from(selectedItems).some(itemId => allFlatItems.find(f => f.id === itemId)?.item?.starred) ? 'Unstar' : 'Star'} ${selectedItems.size} items` 
  : (starred ? "Unstar" : "Star")} 
```

### Step 1.2: Fix Exclude from Cascade Batch Toggle Logic
**Current (Line 783-791):**
```typescript
onClick={() => { 
  if (isMultiSelectMode && selectedItems && selectedItems.size > 0) {
    onBatchToggleExcludeCascade?.(Array.from(selectedItems), true);  // BUG: Always excludes
    clearSelection?.();
  } else {
    onToggleExcludeCascade?.(id); 
  }
  setOpenMenuId?.(null); 
}}
```

**Fixed:**
```typescript
onClick={async () => { 
  if (isMultiSelectMode && selectedItems && selectedItems.size > 0) {
    // Determine toggle state: if ANY selected item is excluded, include all; otherwise exclude all
    const anyExcluded = Array.from(selectedItems).some(itemId => {
      const item = allFlatItems.find(f => f.id === itemId)?.item;
      return item?.exclude_from_cascade;
    });
    await onBatchToggleExcludeCascade?.(Array.from(selectedItems), !anyExcluded);
    clearSelection?.();
  } else {
    onToggleExcludeCascade?.(id); 
  }
  setOpenMenuId?.(null); 
}}
```

### Step 1.3: Fix Exclude from Export Batch Toggle Logic
**Current (Line 801-809):**
Apply same pattern as Step 1.2, checking `exclude_from_export` property.

---

## Part 2: Fix Child Prompt Highlighting Issue

### File: `src/hooks/useCascadeExecutor.ts`

### Step 2.1: Add updateProgress call in executeChildCascade

**Location:** Inside the for loop in `executeChildCascade` (~line 1731)

**Change:** After fetching childPrompt data (~line 1751), add:
```typescript
// Update progress to highlight the currently running child prompt
updateProgress(
  currentDepth,      // Level
  childPrompt.prompt_name,  // Prompt name
  idx + 1,           // Prompt index (1-based)
  childPrompt.row_id // Prompt row ID for highlighting
);
```

**Also update imports to include `updateProgress`:**
```typescript
const {
  startCascade,
  updateProgress,  // ADD THIS
  markPromptComplete,
  // ... rest
} = useCascadeRun();
```

---

## Part 3: Add Await to Batch Operations

### File: `src/components/layout/FolderPanel.tsx`

Ensure all batch operations in TreeItem onClick handlers are awaited before calling `clearSelection()`.

Example pattern:
```typescript
onClick={async () => { 
  if (isMultiSelectMode && selectedItems && selectedItems.size > 0) {
    await onBatchDuplicate?.(Array.from(selectedItems));
    clearSelection?.();
  } else {
    onDuplicate?.(id); 
  }
  setOpenMenuId?.(null); 
}}
```

Apply to: Star (Step 1.1), Duplicate, Delete, Exclude from Cascade (Step 1.2), Exclude from Export (Step 1.3).

---

## Part 4: Restore Deleted File (if needed)

### File: `.lovable/plan.md`

If this file is needed for documentation/history purposes, restore from git history using:
```
git checkout HEAD~1 -- .lovable/plan.md
```

---

## Testing Requirements

1. **Batch Star Toggle**
   - Select 3 unstarred items → Star → All 3 become starred
   - Select 3 starred items → Menu shows "Unstar 3 items" → Unstar → All 3 become unstarred
   - Select mix of starred/unstarred → Should unstar all (because "anyStarred" is true)

2. **Batch Exclude Toggle**
   - Same pattern as star toggle for cascade and export exclusion

3. **Child Prompt Highlighting**
   - Run cascade on a parent with 3 children
   - Observe tree: parent highlights first, then each child highlights in sequence
   - Spinner should move through the tree during execution

4. **Async Race Conditions**
   - Batch delete 10 items → Verify selection clears AFTER delete completes
   - No visual flicker or stale selection state

---

## Files Modified

1. `src/components/layout/FolderPanel.tsx` - Batch toggle logic fixes
2. `src/hooks/useCascadeExecutor.ts` - Child prompt highlighting

## Estimated Complexity

- Lines modified: ~40
- Risk: Low (targeted fixes to identified bugs)
- Testing: Medium (requires cascade run testing)

