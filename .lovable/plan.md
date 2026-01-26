

# Plan: Add Type Annotation to filteredVariables useMemo

## Overview

This is a single-line change to add an explicit return type annotation to the `filteredVariables` useMemo for consistency with the strict typing pattern already applied to `allVariables`.

---

## Current State

**Line 126:**
```typescript
const filteredVariables = useMemo(() => {
```

**Line 100 (pattern to match):**
```typescript
const allVariables = useMemo<AutocompleteVariable[]>(() => {
```

---

## Implementation

### File: `src/components/ui/highlighted-textarea.tsx`

### Change 1: Add Type Annotation (Line 126)

```typescript
// BEFORE (line 126):
const filteredVariables = useMemo(() => {

// AFTER:
const filteredVariables = useMemo<AutocompleteVariable[]>(() => {
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/ui/highlighted-textarea.tsx` | Add `<AutocompleteVariable[]>` type parameter to useMemo |

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Type mismatch | None | Return value is already `AutocompleteVariable[]` from allVariables |
| Build regression | None | No runtime behavior change |

---

## Testing Checklist

- [ ] Component compiles without TypeScript errors
- [ ] Autocomplete filtering still works correctly

