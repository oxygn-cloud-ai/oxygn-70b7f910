
# Multi-Select Popup Menu: Revised Implementation Plan

## Executive Summary
Enable the popup menu when items are selected via checkbox, allowing batch actions on all selected prompts. This requires careful handling to avoid duplicating existing functionality and preventing dangerous parallel operations.

## Current State Analysis

### Existing Implementation
- **Line 577**: Menu is explicitly disabled when `isMultiSelectMode` is true
- **Lines 1475-1549**: Floating batch action bar appears when items are selected
- **Lines 975-1014**: Batch click handlers already exist in FolderPanel
- **useTreeOperations.ts**: Contains optimized batch handlers using Supabase `.in()` queries

### Critical Finding: Duplication Risk
The batch action bar already provides: Star, Duplicate, Exclude from Cascade, Exclude from Export, Delete. Adding these to the popup menu creates redundancy.

---

## Proposed Solution

### Approach: Unified Menu with Selective Batch Support

Rather than duplicating the batch bar functionality, the popup menu will:
1. Remain visible in multi-select mode
2. Show batch-applicable actions with selection count
3. Disable actions that are dangerous or semantically unclear for batch operations
4. Reuse existing batch handlers (no new logic duplication)

---

## Technical Implementation

### Step 1: Add TypeScript Interfaces (Type Safety)

Create proper interfaces for component props to satisfy strict type safety:

**File: `src/components/layout/FolderPanel.tsx`**

```typescript
interface TreeItemProps {
  item: PromptTreeItem;
  level?: number;
  isExpanded?: boolean;
  onToggle?: (id: string) => void;
  isActive?: boolean;
  onMoveInto?: (draggedId: string, targetId: string) => void;
  onMoveBetween?: (draggedId: string, targetIndex: number, siblingIds: string[]) => void;
  onSelect?: (id: string | null) => void;
  onAdd?: (parentId: string) => void;
  onDelete?: (id: string, name: string) => void;
  onDuplicate?: (id: string) => void;
  onExport?: (id: string) => void;
  expandedFolders: Record<string, boolean>;
  selectedPromptId?: string;
  onRunPrompt?: (id: string) => void;
  onRunCascade?: (id: string) => void;
  onToggleStar?: (id: string) => void;
  onToggleExcludeCascade?: (id: string) => void;
  onToggleExcludeExport?: (id: string) => void;
  isRunningPrompt?: boolean;
  isRunningCascade?: boolean;
  // Multi-select
  isMultiSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  lastSelectedId?: string | null;
  allFlatItems?: Array<{ id: string; item: PromptTreeItem }>;
  onRangeSelect?: (fromId: string, toId: string, flatItems: any[]) => void;
  selectedItems?: Set<string>;
  onSelectOnlyThis?: (id: string) => void;
  // NEW: Batch handlers
  onBatchStar?: (ids: string[], starred: boolean) => Promise<boolean>;
  onBatchDuplicate?: (ids: string[]) => Promise<boolean>;
  onBatchDelete?: (ids: string[]) => Promise<boolean>;
  onBatchToggleExcludeCascade?: (ids: string[], exclude: boolean) => Promise<boolean>;
  onBatchToggleExcludeExport?: (ids: string[], exclude: boolean) => Promise<boolean>;
  clearSelection?: () => void;
  // ... remaining props
}
```

### Step 2: Remove Multi-Select Guard on Menu

**File: `src/components/layout/FolderPanel.tsx`**
**Line: 577**

Change from:
```tsx
{isMenuOpen && !isMultiSelectMode && menuButtonRef.current && createPortal(
```

To:
```tsx
{isMenuOpen && menuButtonRef.current && createPortal(
```

### Step 3: Add Selection Count Header in Menu

**Inside the menu portal (after line 578)**

```tsx
{isMenuOpen && menuButtonRef.current && createPortal(
  <div 
    ref={menuRef}
    className="fixed flex flex-col bg-surface-container-high rounded-m3-sm shadow-lg z-50 border border-outline-variant"
    style={getMenuPosition()}
  >
    {/* Selection count header - only shown in multi-select mode */}
    {isMultiSelectMode && selectedItems && selectedItems.size > 0 && (
      <div className="px-2 py-1 border-b border-outline-variant bg-primary/5">
        <span className="text-[10px] text-primary font-medium">
          {selectedItems.size} selected
        </span>
      </div>
    )}
    <div className="flex items-center gap-0.5 px-1 py-0.5">
      {/* Action buttons */}
    </div>
  </div>,
  document.body
)}
```

### Step 4: Update Action Handlers for Batch Support

**Star Action (line 583-588)**
```tsx
<IconButton 
  icon={Star} 
  label={isMultiSelectMode ? `Star ${selectedItems?.size} items` : (starred ? "Unstar" : "Star")} 
  className={starred ? "text-amber-500" : ""} 
  onClick={() => { 
    if (isMultiSelectMode && selectedItems && selectedItems.size > 0) {
      onBatchStar?.(Array.from(selectedItems), true);
      clearSelection?.();
    } else {
      onToggleStar?.(id); 
    }
    setOpenMenuId(null); 
  }}
/>
```

**Duplicate Action (line 618)**
```tsx
<IconButton 
  icon={Copy} 
  label={isMultiSelectMode ? `Duplicate ${selectedItems?.size} items` : "Duplicate"} 
  onClick={() => { 
    if (isMultiSelectMode && selectedItems && selectedItems.size > 0) {
      onBatchDuplicate?.(Array.from(selectedItems));
      clearSelection?.();
    } else {
      onDuplicate?.(id); 
    }
    setOpenMenuId(null); 
  }} 
/>
```

**Delete Action (line 637)**
```tsx
<IconButton 
  icon={Trash2} 
  label={isMultiSelectMode ? `Delete ${selectedItems?.size} items` : "Delete"} 
  onClick={() => { 
    if (isMultiSelectMode && selectedItems && selectedItems.size > 0) {
      onBatchDelete?.(Array.from(selectedItems));
      clearSelection?.();
    } else {
      onDelete?.(id, label); 
    }
    setOpenMenuId(null); 
  }} 
/>
```

**Exclude from Cascade (lines 626-630)**
```tsx
<IconButton 
  icon={Ban} 
  label={isMultiSelectMode ? `Exclude ${selectedItems?.size} from cascade` : (excludedFromCascade ? "Include in Cascade" : "Exclude from Cascade")} 
  className={excludedFromCascade ? "text-warning" : ""}
  onClick={() => { 
    if (isMultiSelectMode && selectedItems && selectedItems.size > 0) {
      onBatchToggleExcludeCascade?.(Array.from(selectedItems), true);
      clearSelection?.();
    } else {
      onToggleExcludeCascade?.(id); 
    }
    setOpenMenuId(null); 
  }}
/>
```

**Exclude from Export (lines 631-636)**
```tsx
<IconButton 
  icon={FileX} 
  label={isMultiSelectMode ? `Exclude ${selectedItems?.size} from export` : (excludedFromExport ? "Include in Export" : "Exclude from Export")} 
  className={excludedFromExport ? "text-warning" : ""}
  onClick={() => { 
    if (isMultiSelectMode && selectedItems && selectedItems.size > 0) {
      onBatchToggleExcludeExport?.(Array.from(selectedItems), true);
      clearSelection?.();
    } else {
      onToggleExcludeExport?.(id); 
    }
    setOpenMenuId(null); 
  }}
/>
```

### Step 5: Disable Dangerous Actions in Multi-Select Mode

**Play Action (lines 589-603)** - DISABLE in batch mode
```tsx
{isMultiSelectMode ? (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="w-5 h-5 flex items-center justify-center rounded-sm text-on-surface-variant/30 cursor-not-allowed">
        <Play className="h-3 w-3" />
      </span>
    </TooltipTrigger>
    <TooltipContent className="text-[10px]">Select single item to run</TooltipContent>
  </Tooltip>
) : isManusModelById?.(id) ? (
  // existing Manus handling
) : (
  // existing Play button
)}
```

**Run Cascade (lines 604-611)** - DISABLE in batch mode
```tsx
{hasChildren && !isMultiSelectMode && (
  <IconButton 
    icon={isRunningCascade ? Loader2 : Workflow} 
    label="Run Cascade" 
    onClick={() => { onRunCascade?.(id); setOpenMenuId(null); }}
    className={isRunningCascade ? "animate-spin" : ""}
  />
)}
```

**Add Child (line 617)** - DISABLE in batch mode
```tsx
{!isMultiSelectMode && (
  <IconButton icon={Plus} label="Add Child" onClick={() => { onAdd?.(id); setOpenMenuId(null); }} />
)}
```

**Save as Template (lines 620-624)** - DISABLE in batch mode
```tsx
{!isMultiSelectMode && (
  <IconButton 
    icon={LayoutTemplate} 
    label="Save as Template" 
    onClick={() => { onSaveAsTemplate?.(id, label, hasChildren); setOpenMenuId(null); }}
  />
)}
```

### Step 6: Copy Variable Reference - Batch Support

**Line 612-616**
```tsx
<IconButton icon={Braces} label={isMultiSelectMode ? `Copy ${selectedItems?.size} references` : "Copy Variable Reference"} onClick={() => {
  if (isMultiSelectMode && selectedItems && selectedItems.size > 0) {
    const refs = Array.from(selectedItems).map(itemId => `{{q.ref[${itemId}]}}`).join('\n');
    navigator.clipboard.writeText(refs);
    toast.success(`Copied ${selectedItems.size} variable references`);
  } else {
    navigator.clipboard.writeText(`{{q.ref[${id}]}}`);
    toast.success('Copied variable reference');
  }
  setOpenMenuId(null);
}} />
```

### Step 7: Pass New Props to TreeItem

**FolderPanel render (around line 1415)** - Add to TreeItem props:
```tsx
<TreeItem
  // ... existing props ...
  // NEW batch props
  onBatchStar={onBatchStar}
  onBatchDuplicate={onBatchDuplicate}
  onBatchDelete={onBatchDelete}
  onBatchToggleExcludeCascade={onBatchToggleExcludeCascade}
  onBatchToggleExcludeExport={onBatchToggleExcludeExport}
  clearSelection={clearSelection}
/>
```

**Also update recursive child rendering (lines 667-720)** - Same props must be passed.

### Step 8: Consider Removing Batch Action Bar (Optional)

With batch actions now available in the popup menu, the floating batch action bar may become redundant. Options:

**Option A: Keep Both** (Recommended initially)
- Menu for quick single-action batch operations
- Bar for bulk operations with clear visibility

**Option B: Remove Bar**
- Cleaner UI, single interaction pattern
- Risk: Less discoverable for users

---

## Actions NOT Supported in Multi-Select Mode

| Action | Reason |
|--------|--------|
| Play (Run Prompt) | Parallel API calls, cost/rate concerns |
| Run Cascade | Same as above, plus state tracking issues |
| Add Child | Semantically undefined for multiple parents |
| Save as Template | Unclear semantics, single-item only |
| Export | Could be batched but needs separate design |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Parallel prompt execution | Disable Play/Cascade in batch mode |
| Type safety violations | Add TypeScript interfaces |
| Selection race condition | Use functional setState pattern |
| Partial failure in batch | Existing handlers have try/catch |
| UX confusion (two batch UIs) | Clear visual differentiation |

---

## Testing Requirements

1. **Single-select behavior unchanged**: Open menu on single item, all actions work as before
2. **Multi-select batch actions**: Select 3 items, open menu, Star → all 3 starred
3. **Selection clears after action**: After batch delete, `selectedItems` is empty
4. **Disabled actions visible**: In multi-select, Play/Cascade show disabled state with tooltip
5. **Recursive children**: Batch props pass through to nested TreeItems
6. **Large selection**: Select 50+ items, batch delete, confirm no performance issues

---

## Files Modified

1. `src/components/layout/FolderPanel.tsx` - All changes in this single file

## Estimated Complexity

- Lines added: ~50
- Lines modified: ~30
- New props: 6 (batch handlers + clearSelection)
- Risk: Medium (architectural change to existing pattern)
