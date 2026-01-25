
# Plan: Fix Variable Autocomplete Popup to Show All Variables

## Problem Identified

The keyboard-triggered autocomplete popup (activated by typing `{{`) in `HighlightedTextarea` artificially limits displayed variables to **10 items** and lacks features present in the `VariablePicker`:

| Feature | VariablePicker (Icon) | Keyboard Autocomplete |
|---------|----------------------|----------------------|
| Shows all system variables | ✅ All (grouped) | ❌ Max 10 |
| Shows user variables | ✅ All | ✅ But capped at 10 total |
| Runtime variables (q.previous.*) | ❌ Not shown | ❌ Not shown |
| Prompt References | ✅ Opens picker | ❌ No access |
| Scrollable | ✅ 300px | ✅ 200px (but limited content) |

---

## Solution

### Phase 1: Remove 10-Item Limit

**File: `src/components/ui/highlighted-textarea.tsx`**

**Line 84-90** - Remove the `.slice(0, 10)` limits:

```typescript
// BEFORE (line 84-90):
const filteredVariables = useMemo(() => {
  if (!autocompleteQuery) return allVariables.slice(0, 10);
  const query = autocompleteQuery.toLowerCase();
  return allVariables
    .filter(v => v.name.toLowerCase().includes(query) || v.label.toLowerCase().includes(query))
    .slice(0, 10);
}, [allVariables, autocompleteQuery]);

// AFTER:
const filteredVariables = useMemo(() => {
  if (!autocompleteQuery) return allVariables;
  const query = autocompleteQuery.toLowerCase();
  return allVariables
    .filter(v => v.name.toLowerCase().includes(query) || v.label.toLowerCase().includes(query));
}, [allVariables, autocompleteQuery]);
```

---

### Phase 2: Increase Popup Height for More Visibility

**File: `src/components/ui/highlighted-textarea.tsx`**

**Line 366** - Increase max-height from 200px to 300px:

```typescript
// BEFORE (line 366):
<ScrollArea className="max-h-[200px]">

// AFTER:
<ScrollArea className="max-h-[300px]">
```

---

### Phase 3: Add Runtime Variables to System Variables List

The runtime variables (`q.previous.response`, `q.previous.name`) are defined in `SYSTEM_VARIABLES` but are filtered out because they have `runtimeOnly: true`. These should still appear in the autocomplete for users writing cascade prompts.

**File: `src/components/ui/highlighted-textarea.tsx`**

**Line 60-68** - Include runtime variables in the list:

```typescript
// BEFORE (line 60-68):
const allVariables = useMemo(() => {
  const systemVars = getSystemVariableNames().map(name => ({
    name,
    label: SYSTEM_VARIABLES[name]?.label || name,
    description: SYSTEM_VARIABLES[name]?.description || '',
    type: VARIABLE_TYPE_LABELS[SYSTEM_VARIABLES[name]?.type] || 'System',
    isSystem: true,
    isStatic: SYSTEM_VARIABLES[name]?.type === SYSTEM_VARIABLE_TYPES.STATIC,
  }));
  // ...
}, [userVariables]);

// AFTER - Add isRuntime flag for visual indication:
const allVariables = useMemo(() => {
  const systemVars = getSystemVariableNames().map(name => ({
    name,
    label: SYSTEM_VARIABLES[name]?.label || name,
    description: SYSTEM_VARIABLES[name]?.description || '',
    type: VARIABLE_TYPE_LABELS[SYSTEM_VARIABLES[name]?.type] || 'System',
    isSystem: true,
    isStatic: SYSTEM_VARIABLES[name]?.type === SYSTEM_VARIABLE_TYPES.STATIC,
    isRuntime: SYSTEM_VARIABLES[name]?.type === SYSTEM_VARIABLE_TYPES.RUNTIME,
  }));
  // ...
}, [userVariables]);
```

---

### Phase 4: Add Visual Indicator for Runtime Variables

**File: `src/components/ui/highlighted-textarea.tsx`**

**Line 388-390** - Add runtime indicator alongside the static indicator:

```typescript
// BEFORE (line 388-390):
{variable.isStatic && (
  <span className="text-[10px] text-muted-foreground">auto</span>
)}

// AFTER:
{variable.isStatic && (
  <span className="text-[10px] text-muted-foreground">auto</span>
)}
{variable.isRuntime && (
  <span className="text-[10px] text-amber-500">cascade</span>
)}
```

---

### Phase 5: Add "Prompt References" Option (Optional Enhancement)

To provide parity with VariablePicker, add a link to open the Prompt Reference picker at the bottom of the autocomplete dropdown.

**File: `src/components/ui/highlighted-textarea.tsx`**

This requires:
1. Adding `familyRootPromptRowId` prop to the component
2. Adding state for showing the PromptReferencePicker modal
3. Adding a footer option in the dropdown

**This is a larger change** - recommend as a follow-up enhancement rather than part of this fix.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/ui/highlighted-textarea.tsx` | Remove 10-item limit, increase popup height, add runtime variable indicator |

---

## Expected Result

After implementation:
- ✅ All 16+ system variables visible when typing `{{}` 
- ✅ All user-defined variables visible
- ✅ Runtime variables (`q.previous.response`, `q.previous.name`) shown with "cascade" badge
- ✅ Scrollable dropdown shows complete list
- ✅ Search/filter works across all variables without limit

---

## Testing Checklist

- [ ] Type `{{` → dropdown shows ALL system variables (not just 10)
- [ ] Type `{{q.p` → filters correctly, shows matching variables
- [ ] Runtime variables appear with amber "cascade" label
- [ ] Static variables show "auto" label
- [ ] User variables appear after system variables
- [ ] Dropdown scrolls smoothly for long lists
- [ ] Arrow key navigation works through full list
- [ ] Enter/Tab inserts selected variable correctly
