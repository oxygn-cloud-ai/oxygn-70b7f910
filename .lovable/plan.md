

# Final Verified Plan: TypeScript Interfaces + Badge Color Fix

## Overview

This plan implements strict TypeScript typing and fixes the cascade badge color deviation in `highlighted-textarea.tsx`. All issues identified in the adversarial audit have been verified and addressed.

---

## Current State (Verified)

| Issue | Line(s) | Status |
|-------|---------|--------|
| Badge color `text-primary` instead of `text-amber-500` | 392 | Not fixed |
| User variables missing `isRuntime` property | 71-79 | Not fixed |
| No TypeScript interfaces | N/A | Missing |
| No type annotations on forwardRef | 33 | Missing |
| No type annotations on refs | 49-51 | Missing |
| No type annotations on callbacks | Multiple | Missing |

---

## Implementation Details

### File: `src/components/ui/highlighted-textarea.tsx`

---

### Change 1: Add TypeScript Interfaces (Insert after line 27)

```typescript
/**
 * Represents a variable available in the autocomplete dropdown
 */
interface AutocompleteVariable {
  name: string;
  label: string;
  description: string;
  type: string;
  isSystem: boolean;
  isStatic: boolean;
  isRuntime: boolean;
  value?: string;
}

/**
 * User variable input format - can be string or object
 */
interface UserVariableInput {
  name: string;
  description?: string;
  value?: string;
}

/**
 * Props for HighlightedTextarea component
 * Extends standard textarea attributes to support ...props spread
 */
interface HighlightedTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value' | 'style'> {
  value?: string;
  onChange?: (e: { target: { value: string; selectionStart: number; selectionEnd: number } }) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  readOnly?: boolean;
  id?: string;
  userVariables?: Array<string | UserVariableInput>;
  style?: React.CSSProperties;
}
```

---

### Change 2: Type the forwardRef (Line 33)

```typescript
// BEFORE:
const HighlightedTextarea = forwardRef(({

// AFTER:
const HighlightedTextarea = forwardRef<HTMLTextAreaElement, HighlightedTextareaProps>(({
```

---

### Change 3: Type the Refs (Lines 49-51)

```typescript
// BEFORE:
const containerRef = useRef(null);
const textareaRef = useRef(null);
const backdropRef = useRef(null);

// AFTER:
const containerRef = useRef<HTMLDivElement>(null);
const textareaRef = useRef<HTMLTextAreaElement>(null);
const backdropRef = useRef<HTMLPreElement>(null);
```

---

### Change 4: Type allVariables useMemo (Line 60)

```typescript
// BEFORE:
const allVariables = useMemo(() => {

// AFTER:
const allVariables = useMemo<AutocompleteVariable[]>(() => {
```

---

### Change 5: Type systemVars Mapping (Line 61)

```typescript
// BEFORE:
const systemVars = getSystemVariableNames().map(name => ({

// AFTER:
const systemVars = getSystemVariableNames().map((name): AutocompleteVariable => ({
```

---

### Change 6: Add isRuntime to User Variables + Type Mapping (Lines 71-79)

```typescript
// BEFORE:
const userVars = (userVariables || []).map(v => ({
  name: typeof v === 'string' ? v : v.name,
  label: typeof v === 'string' ? v : v.name,
  description: typeof v === 'string' ? '' : (v.description || ''),
  type: 'User Variable',
  isSystem: false,
  isStatic: false,
  value: typeof v === 'string' ? '' : (v.value || ''),
}));

// AFTER:
const userVars = (userVariables || []).map((v): AutocompleteVariable => ({
  name: typeof v === 'string' ? v : v.name,
  label: typeof v === 'string' ? v : v.name,
  description: typeof v === 'string' ? '' : (v.description || ''),
  type: 'User Variable',
  isSystem: false,
  isStatic: false,
  isRuntime: false,
  value: typeof v === 'string' ? '' : (v.value || ''),
}));
```

---

### Change 7: Type getHighlightedHtml Callback (Line 101)

```typescript
// BEFORE:
const getHighlightedHtml = useCallback((text) => {

// AFTER:
const getHighlightedHtml = useCallback((text: string): string => {
```

---

### Change 8: Type checkForTrigger Callback (Line 147)

```typescript
// BEFORE:
const checkForTrigger = useCallback((text, cursorPos) => {

// AFTER:
const checkForTrigger = useCallback((text: string, cursorPos: number): void => {
```

---

### Change 9: Type handleInput Callback (Line 170)

```typescript
// BEFORE:
const handleInput = useCallback((e) => {

// AFTER:
const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>): void => {
```

---

### Change 10: Type insertVariable Callback (Line 182)

```typescript
// BEFORE:
const insertVariable = useCallback((variable) => {

// AFTER:
const insertVariable = useCallback((variable: AutocompleteVariable): void => {
```

---

### Change 11: Type handleKeyDown Callback (Line 218)

```typescript
// BEFORE:
const handleKeyDown = useCallback((e) => {

// AFTER:
const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
```

---

### Change 12: Type handleBlurInternal Callback (Line 244)

```typescript
// BEFORE:
const handleBlurInternal = useCallback((e) => {

// AFTER:
const handleBlurInternal = useCallback((e: React.FocusEvent<HTMLTextAreaElement>): void => {
```

---

### Change 13: Fix Cascade Badge Color (Line 392)

```typescript
// BEFORE:
<span className="text-[10px] text-primary">cascade</span>

// AFTER:
<span className="text-[10px] text-amber-500">cascade</span>
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/ui/highlighted-textarea.tsx` | Add 3 interfaces, 10 type annotations, fix badge color, add isRuntime to user vars |

---

## Technical Notes

### Why Extend TextareaHTMLAttributes with Omit?
The component uses `{...props}` spread (line 351) to forward additional attributes like `disabled`, `name`, `maxLength`, etc. Extending `TextareaHTMLAttributes` ensures TypeScript accepts these. Using `Omit` prevents conflicts with custom `onChange`, `value`, and `style` signatures.

### Why text-amber-500 for Cascade Badge?
- `text-primary` (pink) is used for variable highlighting and active states throughout the app
- `text-amber-500` provides distinct visual separation for cascade-specific runtime variables
- This follows the original approved specification

### Known Limitation: mergeRefs Utility
The `mergeRefs` function in `src/lib/utils.ts` is not typed. This creates a minor type leak at line 324 where typed refs are passed. This is acceptable technical debt and tracked separately.

### Build Error Note
The `TS6310` error (`tsconfig.node.json may not disable emit`) is a platform infrastructure issue unrelated to this component. Per memory `architecture/typescript-infrastructure-and-preview-health`, it's handled by the Vite config bypass.

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Type errors from existing callers | Low | Interface matches existing implicit contract exactly |
| Build regression | Low | Types add strictness without changing runtime behavior |
| Visual inconsistency | None | Amber is standard Tailwind, distinct from primary pink |
| mergeRefs type leak | Low | Localized, tracked as separate tech debt |

---

## Deferred Items (Tracked)

1. **VariablePicker parity** - Add runtime variables to icon-based picker (creates UX consistency)
2. **Type mergeRefs utility** - Add TypeScript to `src/lib/utils.ts` (tech debt)

---

## Testing Checklist

- [ ] Component compiles without TypeScript errors
- [ ] Type `{{` triggers dropdown with all variables
- [ ] Runtime variables show **amber** "cascade" badge (not pink)
- [ ] Static variables show muted "auto" badge
- [ ] User variables render correctly without errors
- [ ] Existing callers compile without modification
- [ ] Arrow key navigation works through full list
- [ ] Enter/Tab inserts selected variable correctly

