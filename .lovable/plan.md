

# Fix: Template Children Missing After Save

## Root Cause

When `createFromPrompt` in `useTemplates.ts` builds the template structure, it deliberately omits `_id` fields from all nodes (to prevent cross-family UUID leakage). This is correct for data isolation.

However, `TemplateStructureEditor.tsx` requires every node to have a unique `_id` for selection, editing, drag-drop, and React keys. The current `structureWithId` memo only adds `_id: 'root'` to the top-level node:

```typescript
const structureWithId = useMemo(() => {
  return structure?._id ? structure : { ...structure, _id: 'root' };
}, [structure]);
```

Children from the database have no `_id`, so:
- `DraggableTreeNode` assigns `nodeId = node._id || 'root'` -- all children resolve to `'root'`
- React `key={child._id}` is `undefined` for all children, causing duplicate key collisions
- Only one child renders; the rest are dropped by React
- `findNode`, `updateNode`, `deleteNode` all match the root instead of the target child

This makes children invisible in the editor. Users see only the root prompt and conclude children were excluded.

## Fix

**File: `src/components/templates/TemplateStructureEditor.tsx`**

Replace the `structureWithId` memo with a recursive version that assigns unique `_id` to every node in the tree that lacks one.

**Current code (line 31-33):**
```typescript
const structureWithId = useMemo(() => {
  return structure?._id ? structure : { ...structure, _id: 'root' };
}, [structure]);
```

**Replacement:**
```typescript
const structureWithId = useMemo(() => {
  const ensureIds = (node: Record<string, unknown>, isRoot = false): Record<string, unknown> => {
    if (!node) return node;
    const id = node._id ?? (isRoot ? 'root' : uuidv4());
    const children = Array.isArray(node.children)
      ? node.children.map((child: Record<string, unknown>) => ensureIds(child, false))
      : [];
    return { ...node, _id: id, children };
  };
  return structure ? ensureIds(structure, true) : { _id: 'root', prompt_name: 'Root Prompt', children: [] };
}, [structure]);
```

This ensures every node -- root and descendants -- has a stable, unique `_id` for React keys, selection, drag-drop, and tree operations.

## Scope

| File | Change |
|------|--------|
| `src/components/templates/TemplateStructureEditor.tsx` | Replace `structureWithId` memo (lines 31-33) with recursive ID assignment |

No other files are modified. The `createFromPrompt` function correctly omits `_id` to prevent UUID leakage -- the editor is responsible for assigning ephemeral IDs at render time.

## Verification

After this fix:
- Open any template that was created via "Save as Template" from a prompt with children
- The TemplateStructureEditor tree should display all child nodes
- Each child should be selectable, editable, draggable, and deletable
- Saving the template should preserve the full hierarchy including children

