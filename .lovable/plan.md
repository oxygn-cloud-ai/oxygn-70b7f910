
# Adversarial Implementation Audit Report

## Files Changed

1. `src/components/ui/tiptap-prompt-editor.tsx` - **CREATED**
2. `src/index.css` - **MODIFIED** (lines 390-394 added)
3. `src/components/shared/index.ts` - **MODIFIED**
4. `src/components/shared/ResizablePromptArea.tsx` - **MODIFIED**
5. `src/components/shared/FullScreenEditDialog.tsx` - **MODIFIED**
6. `src/components/ui/highlighted-textarea.tsx` - **MODIFIED** (deprecation comment added)

---

## Per-File Analysis

### 1. `src/components/ui/tiptap-prompt-editor.tsx`

**Description of changes**: New Tiptap-based editor component with variable highlighting and autocomplete.

**Verification status**: ⚠️ Warning

**Detailed issues identified**:

| Issue # | Severity | Description |
|---------|----------|-------------|
| 1 | **HIGH** | **Stale closure bug in handleKeyDown**: The `handleKeyDown` handler inside `editorProps` (line 250) references `showAutocomplete`, `filteredVariables`, and `selectedIndex` state. These are captured at editor initialization time and will become stale. Tiptap's `useEditor` does not re-create the editor when props change. |
| 2 | **MEDIUM** | **HTML conversion edge case**: The pattern `value.replace(/\n/g, '</p><p>')` at line 211 creates `<p></p>` for consecutive newlines. While `.replace('<p></p>', '')` attempts to fix this, it only replaces the **first** occurrence. Multiple consecutive blank lines will leave empty `<p></p>` tags. |
| 3 | **MEDIUM** | **Cursor positioning mismatch**: In `insertVariableAtTrigger` (lines 300-308), `setTextSelection(newCursorPos)` uses plain text position but Tiptap expects document position (including paragraph nodes). This will position the cursor incorrectly after inserting variables. |
| 4 | **MEDIUM** | **Unused import**: `usePromptNameLookup` is imported (line 16) and called (line 118), but `promptNameMap` is never used in the component. This is dead code. |
| 5 | **LOW** | **Missing dependency in useCallback**: `insertVariableAtTrigger` callback (line 282) depends on `filteredVariables` and `selectedIndex` but they're not in the dependency array. However, since it's called synchronously, this is not a runtime issue. |
| 6 | **LOW** | **Inconsistent auto-save sources**: Auto-save is triggered in `onUpdate`, `onBlur`, AND `insertVariableAtTrigger`. The `onSave` prop is also passed, causing potential double-save scenarios. |

**Risk level**: Medium

---

### 2. `src/index.css`

**Description of changes**: Added cursor protection CSS for Tiptap editor inside resizable panels.

**Verification status**: ✅ Correct

**Detailed issues identified**: None detected.

**Risk level**: Low

---

### 3. `src/components/shared/index.ts`

**Description of changes**: Export of TiptapPromptEditor component and types.

**Verification status**: ✅ Correct

**Detailed issues identified**: None detected.

**Risk level**: Low

---

### 4. `src/components/shared/ResizablePromptArea.tsx`

**Description of changes**: Replaced HighlightedTextarea with TiptapPromptEditor, simplified event handling.

**Verification status**: ⚠️ Warning

**Detailed issues identified**:

| Issue # | Severity | Description |
|---------|----------|-------------|
| 7 | **HIGH** | **Double auto-save execution**: The component sets up its own auto-save timer in `handleEditorChange` (lines 318-327), AND passes `onSave` to `TiptapPromptEditor`. The editor also has internal auto-save on `onUpdate` and `onBlur`. This creates a race condition where the same value may be saved twice. |
| 8 | **MEDIUM** | **Resize handle no longer functional**: The container div (line 497) has `style={{ resize: 'vertical' }}` but the Tiptap `EditorContent` inside it doesn't inherit this resize behavior. Users cannot drag to resize the editor area as they could before. |
| 9 | **LOW** | **Cmd+Z conflict**: The `handleKeyDown` (lines 295-306) intercepts Cmd+Z and calls `handleUndo()` (which uses `useFieldUndo`). However, Tiptap's History extension also listens for Cmd+Z. The `e.stopPropagation()` prevents this from reaching Tiptap, breaking native undo for typing. |

**Risk level**: Medium

---

### 5. `src/components/shared/FullScreenEditDialog.tsx`

**Description of changes**: Updated to use TiptapPromptEditor instead of HighlightedTextarea.

**Verification status**: ⚠️ Warning

**Detailed issues identified**:

| Issue # | Severity | Description |
|---------|----------|-------------|
| 10 | **HIGH** | **Same double auto-save issue as ResizablePromptArea**: Component has its own auto-save timer (lines 171-177) AND passes `onSave` to the editor, which has internal auto-save. |
| 11 | **MEDIUM** | **Same Cmd+Z conflict**: Lines 190-193 intercept Cmd+Z and call `handleUndo()`, preventing Tiptap's native undo from working. |

**Risk level**: Medium

---

### 6. `src/components/ui/highlighted-textarea.tsx`

**Description of changes**: Added deprecation comment at top, no functional changes.

**Verification status**: ✅ Correct

**Detailed issues identified**: None detected.

**Risk level**: Low

---

## Bugs Found

1. **[HIGH] tiptap-prompt-editor.tsx:250-277** - Stale closure in `handleKeyDown`. The `showAutocomplete`, `filteredVariables`, and `selectedIndex` state values are captured at editor initialization and become stale, causing autocomplete navigation to malfunction.

2. **[HIGH] ResizablePromptArea.tsx:318-327 + tiptap-prompt-editor.tsx:226-231** - Double auto-save race condition. Both parent and child components trigger auto-save with 500ms delay, potentially saving the same value twice.

3. **[HIGH] FullScreenEditDialog.tsx:171-177 + tiptap-prompt-editor.tsx:226-231** - Same double auto-save race condition as above.

4. **[MEDIUM] tiptap-prompt-editor.tsx:211** - Multiple consecutive newlines create empty `<p></p>` tags that aren't fully removed (only first occurrence is replaced).

5. **[MEDIUM] tiptap-prompt-editor.tsx:305** - Cursor position after variable insertion uses plain text offset but Tiptap expects document position, causing incorrect cursor placement.

6. **[MEDIUM] ResizablePromptArea.tsx:497** - Native resize-y CSS on container doesn't allow resizing the editor content.

7. **[MEDIUM] ResizablePromptArea.tsx:301-304** - Cmd+Z is intercepted and calls `handleUndo()` instead of allowing Tiptap's native undo, breaking typing undo.

8. **[MEDIUM] FullScreenEditDialog.tsx:190-193** - Same Cmd+Z issue as ResizablePromptArea.

---

## Critical Risks

1. **[HIGH] Data Integrity Risk - Double Save**: The auto-save race condition can cause the `pushPreviousValue()` to be called twice for the same edit, polluting the undo stack with duplicate entries. This degrades user experience when using the Undo button.

2. **[HIGH] Functional Regression - Autocomplete Navigation**: Due to stale closures in `handleKeyDown`, arrow key navigation in the autocomplete dropdown may not work correctly after the first render.

3. **[MEDIUM] UX Regression - Undo Behavior Change**: Users expecting Cmd+Z to undo their last keystroke will instead get the last saved version restored, which is a significant behavioral change.

4. **[MEDIUM] UX Regression - Resize Broken**: Users can no longer drag-resize the prompt text areas, losing functionality they had before.

---

## Unintended Changes

None detected - all changes are within scope of the approved plan.

---

## Omissions

1. **Plan Phase 3 not implemented**: The plan specified enhancing `VariableHighlight` for `q.ref[UUID]` patterns. This was not done (marked as optional in plan, but `usePromptNameLookup` was imported and called without using the result).

2. **Plan Phase 4 partially implemented**: Autocomplete was implemented inline rather than as a separate Tiptap extension using the `Suggestion` API as recommended.

3. **Error boundary not added**: Plan Omission 6 identified the need for error handling if Tiptap fails to initialize. This was not addressed.

4. **Accessibility attributes missing**: Plan Omission 7 identified the need for ARIA attributes. The new editor lacks `id` prop support and accessibility markup.

---

## Architectural Deviations

1. **Deviation from auto-save pattern**: The plan specified copying the auto-save pattern "exactly" from `MarkdownNotesArea`. However, the implementation has the parent component AND the editor component both implementing auto-save, whereas `MarkdownNotesArea` handles it only internally.

2. **CSS placed in component instead of index.css**: The plan specified adding cursor protection to `src/index.css`. This was done, but the component ALSO includes the same CSS inline via a `<style>` tag (lines 369-402), creating duplication.

---

## Summary

**Overall Assessment**: The implementation contains **3 HIGH severity bugs**, **5 MEDIUM severity issues**, and several architectural deviations from the approved plan. The most critical issue is the double auto-save race condition which affects data integrity, and the stale closure bug which breaks autocomplete functionality.

**Recommendation**: ⛔ **PROGRESSION BLOCKED** - The HIGH severity bugs must be fixed before this implementation can be considered stable.

---

## Remediation Plan

### Priority 1: Fix Stale Closure Bug (Critical)

**File**: `src/components/ui/tiptap-prompt-editor.tsx`

**Problem**: `handleKeyDown` captures stale state values.

**Solution**: Extract the keyboard handler outside of `editorProps` and use refs for state access:

```typescript
// Add refs
const showAutocompleteRef = useRef(showAutocomplete);
const filteredVariablesRef = useRef(filteredVariables);
const selectedIndexRef = useRef(selectedIndex);

// Sync refs
useEffect(() => { showAutocompleteRef.current = showAutocomplete; }, [showAutocomplete]);
useEffect(() => { filteredVariablesRef.current = filteredVariables; }, [filteredVariables]);
useEffect(() => { selectedIndexRef.current = selectedIndex; }, [selectedIndex]);

// In editorProps.handleKeyDown, use refs:
if (showAutocompleteRef.current) { ... }
```

### Priority 2: Fix Double Auto-Save (Critical)

**Files**: `ResizablePromptArea.tsx`, `FullScreenEditDialog.tsx`

**Problem**: Both parent and child implement auto-save.

**Solution**: Remove auto-save from parent components. Let `TiptapPromptEditor` handle it internally. In parent:
- Remove `saveTimeoutRef` and related timer logic
- Keep `handleEditorChange` but only update `editValue` state
- Remove the auto-save timeout in `handleEditorChange`
- Trust the editor's `onSave` callback for persistence

### Priority 3: Fix HTML Conversion Edge Cases

**File**: `src/components/ui/tiptap-prompt-editor.tsx`

**Problem**: `.replace('<p></p>', '')` only removes first empty paragraph.

**Solution**: Use a global regex:
```typescript
.replace(/<p><\/p>/g, '')
```

### Priority 4: Fix Cursor Positioning

**File**: `src/components/ui/tiptap-prompt-editor.tsx`

**Problem**: Plain text position != document position.

**Solution**: After setting content, calculate document position:
```typescript
// After setContent, find the text position in the new doc
const doc = editor.state.doc;
let docPos = 0;
let textPos = 0;
doc.descendants((node, pos) => {
  if (node.isText && textPos < newCursorPos) {
    const remaining = newCursorPos - textPos;
    if (remaining <= node.text.length) {
      docPos = pos + remaining;
      return false;
    }
    textPos += node.text.length;
  }
  return true;
});
editor.commands.setTextSelection(docPos);
```

### Priority 5: Fix Cmd+Z Conflict

**Files**: `ResizablePromptArea.tsx`, `FullScreenEditDialog.tsx`

**Problem**: Cmd+Z intercepted by parent, blocking Tiptap undo.

**Solution**: Remove the Cmd+Z handler from parent components entirely. Let Tiptap's History extension handle native undo. The Undo button should still call `handleUndo()` for field-level undo.

### Priority 6: Remove Duplicate CSS

**File**: `src/components/ui/tiptap-prompt-editor.tsx`

**Problem**: Cursor protection CSS is in both index.css and inline.

**Solution**: Remove the inline `<style>` block for cursor protection (lines 397-401). Keep only the global CSS in `index.css`.

### Priority 7: Remove Dead Code

**File**: `src/components/ui/tiptap-prompt-editor.tsx`

**Problem**: `usePromptNameLookup` is called but result is unused.

**Solution**: Either remove the import and call (line 16, 118), OR implement the q.ref friendly name display as specified in Plan Phase 3.

### Priority 8: Fix Resize Behavior (Lower Priority)

**File**: `src/components/shared/ResizablePromptArea.tsx`

**Problem**: Native resize-y CSS doesn't work with Tiptap.

**Solution**: Use `react-resizable` component from the codebase, or implement a custom drag handle at the bottom of the editor container.

