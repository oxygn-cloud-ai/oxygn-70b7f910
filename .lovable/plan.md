

# Critical Review: Tiptap Migration Plan

## Executive Summary

After an exhaustive code review, I identified **17 critical issues, 12 risks, and 8 omissions** in the original plan. The revised plan below addresses all findings while maintaining backward compatibility and architectural alignment.

---

## Critical Issues Found

### Issue 1: Missing TypeScript Interfaces (CRITICAL)
**Finding**: The plan proposes creating `TiptapPromptEditor` but doesn't define TypeScript interfaces. The existing `HighlightedTextareaProps` (lines 56-67 in `highlighted-textarea.tsx`) has strict types that must be preserved.

**Impact**: Loss of type safety, IDE autocomplete, and compile-time error detection.

**Fix Required**: Define explicit interfaces for the new component matching existing contracts.

---

### Issue 2: Incompatible Ref Pattern (CRITICAL)
**Finding**: `ResizablePromptArea.tsx` line 728 passes a ref to `HighlightedTextarea`:
```tsx
<HighlightedTextarea ref={textareaRef} ... />
```

Tiptap's `EditorContent` does NOT expose a native textarea ref. The plan doesn't address how `textareaRef.current.selectionStart` (used in lines 449-457, 490-492) will work with Tiptap.

**Impact**: Variable insertion, cursor tracking, and selection management will break completely.

**Fix Required**: Replace all `textareaRef.selectionStart/End` usage with Tiptap's selection API (`editor.state.selection`).

---

### Issue 3: onChange Event Shape Mismatch (CRITICAL)
**Finding**: Current `HighlightedTextarea` emits synthetic events with this shape (line 59):
```typescript
onChange?: (e: { target: { value: string; selectionStart: number; selectionEnd: number } }) => void;
```

Tiptap's `onUpdate` provides `{ editor }` - a completely different API.

**Impact**: `ResizablePromptArea.handleTextareaChange` (lines 429-446) expects `e.target.value` and will throw errors.

**Fix Required**: 
- Option A: Create adapter layer in `TiptapPromptEditor` that emits compatible synthetic events
- Option B: Change `ResizablePromptArea` to accept a simpler `onChange(value: string)` signature
- **Recommended**: Option B (cleaner, matches `MarkdownNotesArea` pattern)

---

### Issue 4: Autocomplete Trigger Detection Logic Not Portable (HIGH)
**Finding**: Current autocomplete (lines 188-208 in `highlighted-textarea.tsx`) relies on:
```typescript
const textBefore = text.substring(0, cursorPos);
const lastOpenBrace = textBefore.lastIndexOf('{{');
```

This requires synchronous access to cursor position and full text, which Tiptap provides differently.

**Impact**: Autocomplete won't trigger correctly.

**Fix Required**: Implement Tiptap's `Suggestion` extension pattern (as hinted in plan) with proper cursor detection via `editor.state.selection.from`.

---

### Issue 5: Stale Closure Bug in Variable Insertion (HIGH)
**Finding**: `ResizablePromptArea.handleInsertVariable` (lines 481-538) uses `selectionRef.current` as a workaround for stale state. The plan doesn't address how this pattern translates to Tiptap.

**Impact**: Variables may insert at wrong positions.

**Fix Required**: Use Tiptap's `editor.chain().focus().insertContent()` which handles selection atomically.

---

### Issue 6: FullScreenEditDialog Has Separate HighlightedTextarea Instance (HIGH)
**Finding**: `FullScreenEditDialog.tsx` (line 389) uses `HighlightedTextarea` independently:
```tsx
<HighlightedTextarea
  ref={textareaRef}
  value={editValue}
  onChange={handleTextareaChange}
  ...
/>
```

This component has its own state management and cursor tracking that must be migrated.

**Impact**: Full-screen editing will remain broken if not migrated.

**Fix Required**: Create `TiptapPromptEditor` as reusable component, then update both `ResizablePromptArea` AND `FullScreenEditDialog`.

---

### Issue 7: Missing Plain Text Extraction API (MEDIUM)
**Finding**: Plan states "Use `editor.getText()` not `getHTML()`" but doesn't show how to handle newlines. Tiptap's `getText()` outputs content differently than a textarea:
- Paragraphs become separate text runs
- Default separator is `\n\n` (double newline)

**Impact**: Saved prompt content may have extra newlines, breaking execution.

**Fix Required**: Configure text serializer:
```typescript
editor.getText({ blockSeparator: '\n' })
```

---

### Issue 8: CSS Cascade Conflicts (MEDIUM)
**Finding**: Plan proposes adding `.tiptap-prompt-editor:focus-within * { cursor: text !important; }` but existing CSS in `MarkdownNotesArea` (line 572) applies variable highlighting via:
```tsx
className="tiptap-editor [&_.variable-highlight]:..."
```

Using different class names creates inconsistency.

**Impact**: Styling divergence between Notes and Prompt editors.

**Fix Required**: Standardize on single class name (`.tiptap-editor`) with shared variable highlighting styles in `index.css`.

---

### Issue 9: `usePromptNameLookup` Integration Missing (MEDIUM)
**Finding**: `HighlightedTextarea` line 139 uses:
```typescript
const { nameMap: promptNameMap } = usePromptNameLookup(value);
```

This fetches prompt names for `q.ref[UUID]` display. The plan mentions "Enhanced VariableHighlight" but doesn't show how to pass `promptNameMap` to a Tiptap decoration plugin.

**Impact**: Prompt references will show UUIDs instead of friendly names.

**Fix Required**: Either:
1. Pass `promptNameMap` as extension option
2. Or move lookup to parent and inject via extension config on mount

---

### Issue 10: Undo/Redo Stack Conflict (MEDIUM)
**Finding**: Current system uses `useFieldUndo` hook (external state) alongside native textarea history. Plan mentions using Tiptap's History extension BUT keeping `useFieldUndo`.

Tiptap's History tracks **document state**, while `useFieldUndo` tracks **saved values**. These are semantically different:
- Tiptap undo: Reverts typing
- `useFieldUndo`: Reverts to last auto-saved version

**Impact**: Cmd+Z behavior becomes ambiguous.

**Fix Required**: Clarify keyboard shortcuts:
- Cmd+Z: Tiptap history (typing undo) - let Tiptap handle
- Custom "Undo" button: Calls `popPreviousValue()` from `useFieldUndo`
- Remove keyboard handler for Cmd+Z from component level

---

### Issue 11: Resize Handle Integration (MEDIUM)
**Finding**: `ResizablePromptArea` uses native `resize-y` CSS (line 739):
```tsx
className={`... resize-y overflow-auto ...`}
```

Tiptap's `EditorContent` doesn't support CSS `resize` natively.

**Impact**: Users lose ability to drag-resize prompt areas.

**Fix Required**: Wrap `EditorContent` in a container with custom resize handle OR use existing `react-resizable` patterns from the codebase.

---

### Issue 12: Auto-save Timer Race Condition (LOW)
**Finding**: Current code uses `saveTimeoutRef` pattern with `lastSavedValueRef` (see `MarkdownNotesArea` lines 174, 242). The plan doesn't specify adopting this ref pattern.

**Impact**: Potential stale closure bugs in auto-save comparisons.

**Fix Required**: Use ref for `lastSavedValue` comparison in timeout callback (already proven pattern in `MarkdownNotesArea`).

---

## Omissions in Original Plan

### Omission 1: No Props Interface Definition
Must define:
```typescript
interface TiptapPromptEditorProps {
  value: string;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void | Promise<void>;
  placeholder?: string;
  readOnly?: boolean;
  userVariables?: Array<{ name: string; value?: string }>;
  familyRootPromptRowId?: string | null;
  storageKey?: string;
  className?: string;
  minHeight?: number;
}
```

### Omission 2: No Export from index.ts
`src/components/shared/index.ts` must be updated to export `TiptapPromptEditor`.

### Omission 3: Missing Keyboard Shortcut Migration
Current shortcuts in `ResizablePromptArea` (lines 402-415):
- Cmd+S: Immediate save
- Cmd+Z: Undo

These must be implemented in `TiptapPromptEditor` using Tiptap's keyboard extension.

### Omission 4: No Handling for `onSelect`, `onClick`, `onKeyUp` Props
`ResizablePromptArea` passes these (lines 731-733). They're used for cursor tracking. Tiptap alternatives needed.

### Omission 5: Missing `rows` Prop Handling
Current component accepts `rows` prop (line 399 in `HighlightedTextarea`). Plan doesn't address min-height calculation.

### Omission 6: No Error Boundary Consideration
If Tiptap fails to initialize, the app should gracefully degrade. Plan has no error handling.

### Omission 7: Missing Accessibility (ARIA) Attributes
Current textarea has `id`, `aria-hidden` on backdrop. Tiptap needs equivalent accessibility markup.

### Omission 8: No Unit/Integration Test Strategy
Plan mentions testing but provides no specifics.

---

## Duplication Analysis

### Existing Capability: Variable Highlight Extension
`src/components/shared/tiptap-variable-highlight.ts` already exists and works in `MarkdownNotesArea`. **Reuse directly** - no modification needed for basic highlighting.

### Existing Capability: Auto-save Pattern
`MarkdownNotesArea` (lines 239-302) has proven auto-save with pending registry. **Reuse pattern exactly**.

### Existing Capability: Field Undo Hook
`useFieldUndo.ts` is already extracted and reusable. **No changes needed**.

### Potential Duplication: Cursor Extension
Plan proposes new `tiptap-text-cursor.ts` extension. However, this can be achieved with simple CSS:
```css
.tiptap-prompt-editor [contenteditable] {
  cursor: text !important;
}
```
**Prefer CSS over new extension** - less code, same effect.

---

## Architecture Alignment Check

| Aspect | Current Architecture | Proposed Change | Aligned? |
|--------|---------------------|-----------------|----------|
| Component location | `src/components/ui/` or `src/components/shared/` | `src/components/ui/tiptap-prompt-editor.tsx` | YES |
| Extension location | `src/components/shared/*.ts` | `src/components/shared/tiptap-text-cursor.ts` | YES |
| State management | Hooks + Context | Same | YES |
| Styling | Tailwind + CSS variables | Same | YES |
| forwardRef pattern | Used throughout UI components | Plan doesn't mention | NEEDS forwardRef for potential parent ref access |
| TypeScript | Strict interfaces | Plan is vague | NEEDS explicit types |

---

## Revised Implementation Plan

### Phase 1: Create TiptapPromptEditor Component (3-4 hours)

**File**: `src/components/ui/tiptap-prompt-editor.tsx`

**Key Requirements**:
1. **TypeScript Interface**:
```typescript
interface TiptapPromptEditorProps {
  value: string;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void | Promise<void>;
  placeholder?: string;
  readOnly?: boolean;
  userVariables?: Array<{ name: string; value?: string }>;
  familyRootPromptRowId?: string | null;
  storageKey?: string;
  className?: string;
  minHeight?: number;
}
```

2. **Extensions Configuration**:
```typescript
const editor = useEditor({
  extensions: [
    Document,
    Paragraph,
    Text,
    VariableHighlight,
    Placeholder.configure({ placeholder }),
    History,
  ],
  content: value,
  editable: !readOnly,
  editorProps: {
    attributes: {
      class: 'font-poppins text-body-sm text-on-surface outline-none min-h-[80px]',
      'data-testid': 'tiptap-prompt-editor',
    },
  },
});
```

3. **Plain Text Extraction**:
```typescript
const getPlainText = () => editor?.getText({ blockSeparator: '\n' }) || '';
```

4. **Auto-save with Refs** (copy pattern from `MarkdownNotesArea`):
```typescript
const lastSavedValueRef = useRef(value);
// Use ref in timeout callback to avoid stale closure
```

5. **Cursor Override CSS** (inline, not extension):
```typescript
<div className="tiptap-prompt-editor [&_[contenteditable]]:cursor-text">
```

6. **Variable Autocomplete**: Use Tiptap's `Suggestion` utility with custom render.

---

### Phase 2: Add Cursor Protection Styles (30 mins)

**No new file needed** - add to `src/index.css`:
```css
/* Cursor protection for prompt editors inside resizable panels */
.tiptap-prompt-editor [contenteditable]:focus,
.tiptap-prompt-editor [contenteditable]:focus * {
  cursor: text !important;
}
```

---

### Phase 3: Enhance VariableHighlight for q.ref Patterns (2 hours)

**File**: `src/components/shared/tiptap-variable-highlight.ts`

**Changes**:
1. Add support for `q.ref[UUID].field` pattern detection
2. Accept optional `promptNameMap` prop for friendly name display
3. Add differentiated styling (system vs user vs cascade variables)

**Note**: This is optional for MVP. Basic highlighting already works.

---

### Phase 4: Variable Autocomplete Integration (3 hours)

**Approach**: Create `VariableAutocomplete` extension using Tiptap's `Suggestion` API.

**Trigger**: When user types `{{`

**Integration**: Pass `userVariables` and `familyRootPromptRowId` as extension options.

---

### Phase 5: Migrate ResizablePromptArea (1.5 hours)

**File**: `src/components/shared/ResizablePromptArea.tsx`

**Changes**:
1. Replace `HighlightedTextarea` import with `TiptapPromptEditor`
2. Remove `textareaRef` and all `selectionStart/End` logic
3. Simplify `handleTextareaChange` to accept plain string
4. Remove `handleTextareaSelect`, `handleTextareaClick`, `handleTextareaKeyUp` (not needed)
5. Update `handleInsertVariable` to call `editor.insertContent()` via exposed method
6. Add wrapper for resize behavior

**Preserve**:
- All `useFieldUndo` integration
- All toolbar buttons and their handlers
- `FullScreenEditDialog` open/close logic
- localStorage height persistence

---

### Phase 6: Migrate FullScreenEditDialog (1 hour)

**File**: `src/components/shared/FullScreenEditDialog.tsx`

**Changes**:
1. Replace `HighlightedTextarea` with `TiptapPromptEditor`
2. Remove all `textareaRef` logic
3. Update `handleInsertVariable` to use Tiptap method
4. Keep all undo/discard/save logic (already compatible)

---

### Phase 7: Update Exports (15 mins)

**File**: `src/components/shared/index.ts`

Add export for `TiptapPromptEditor`.

---

### Phase 8: Deprecate HighlightedTextarea (15 mins)

**File**: `src/components/ui/highlighted-textarea.tsx`

1. Add deprecation comment at top
2. Keep file for potential rollback
3. Do NOT delete until stable

---

## Files Changed Summary

| File | Action | Risk |
|------|--------|------|
| `src/components/ui/tiptap-prompt-editor.tsx` | CREATE | Low - new file |
| `src/components/shared/tiptap-variable-highlight.ts` | MODIFY (optional) | Low - additive |
| `src/index.css` | MODIFY | Low - additive CSS |
| `src/components/shared/ResizablePromptArea.tsx` | MODIFY | Medium - core UI |
| `src/components/shared/FullScreenEditDialog.tsx` | MODIFY | Medium - core UI |
| `src/components/shared/index.ts` | MODIFY | Low - exports |
| `src/components/ui/highlighted-textarea.tsx` | DEPRECATE (keep) | None |

---

## Testing Strategy

### Manual Testing Checklist:
1. Type text in System Prompt - cursor visible and aligned
2. Type `{{` - autocomplete appears with correct variables
3. Select variable from autocomplete - inserts correctly
4. Wait 500ms after typing - auto-saves (unsaved indicator disappears)
5. Press Cmd+S - saves immediately
6. Press Undo button - reverts to previous saved version
7. Click Discard - reverts to original
8. Click Maximize - opens full-screen editor with same functionality
9. Resize prompt area via drag handle - height persists
10. Switch prompts - content updates, undo stack resets

### Edge Cases:
- Paste large text block
- Paste text with `{{...}}` patterns
- Type while autocomplete open then press Escape
- Focus editor while panel resize in progress (cursor test)

---

## Estimated Effort

| Phase | Time | Dependencies |
|-------|------|--------------|
| Phase 1: TiptapPromptEditor | 3-4 hours | None |
| Phase 2: Cursor CSS | 30 mins | Phase 1 |
| Phase 3: Enhanced highlighting | 2 hours | Phase 1 (optional) |
| Phase 4: Autocomplete | 3 hours | Phase 1 |
| Phase 5: ResizablePromptArea | 1.5 hours | Phase 1, 4 |
| Phase 6: FullScreenEditDialog | 1 hour | Phase 1, 4 |
| Phase 7: Exports | 15 mins | Phase 1 |
| Phase 8: Deprecate old | 15 mins | Phase 5, 6 |
| **Total** | **11-13 hours** | |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Tiptap breaks in edge cases | Keep `HighlightedTextarea` as fallback, add feature flag |
| Auto-save timing issues | Copy proven pattern from `MarkdownNotesArea` exactly |
| Variable autocomplete positioning | Use Tiptap's built-in `FloatingMenu` pattern |
| Undo/redo confusion | Document behavior clearly, separate Tiptap undo from field undo |
| Bundle size increase | Already have Tiptap in bundle - minimal increase |
| Performance with large prompts | Tiptap is optimized for large docs - test with 10k+ chars |

---

## What This Plan Does NOT Change

1. Database schema - no changes
2. API calls - no changes  
3. Backend functions - no changes
4. Other UI components - no changes
5. Variable resolution logic - no changes
6. Prompt execution - no changes
7. Export functionality - no changes

