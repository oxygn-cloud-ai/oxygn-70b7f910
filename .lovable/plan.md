

# Fixed Plan: Enhanced Editable Text Boxes with Notes Variable Support

## Issue Identified

The original plan correctly identified that **MarkdownNotesArea lacks variable highlighting and insertion** (Phase 5), but it **did not include the required prop changes** in `PromptsContent.tsx` to pass variable context to the Notes component.

### Current State (Gap Analysis)

| Component | `variables` prop | `familyRootPromptRowId` prop | Variable Highlighting | Variable Picker |
|-----------|------------------|------------------------------|----------------------|-----------------|
| `ResizablePromptArea` (System Prompt) | ✅ Yes | ✅ Yes | ✅ Yes (via HighlightedTextarea) | ✅ Yes |
| `ResizablePromptArea` (User Prompt) | ✅ Yes | ✅ Yes | ✅ Yes (via HighlightedTextarea) | ✅ Yes |
| `MarkdownNotesArea` (Notes) | ❌ **Missing** | ❌ **Missing** | ❌ **Missing** | ❌ **Missing** |

---

## Corrected Implementation Plan

### Phase 1: Add Variable Props to MarkdownNotesArea (Priority: Critical)

**File: `src/components/shared/MarkdownNotesArea.tsx`**

Add new props to accept variable context:

```typescript
const MarkdownNotesArea = ({
  value = '',
  onChange,
  onSave,
  placeholder = 'Add notes...',
  label = 'Notes',
  defaultHeight = 80,
  readOnly = false,
  storageKey,
  // NEW: Variable support props
  variables = [],                    // User-defined variables
  familyRootPromptRowId = null,     // For prompt reference filtering
}) => {
```

---

### Phase 2: Add Variable Picker to Notes Toolbar (Priority: Critical)

**File: `src/components/shared/MarkdownNotesArea.tsx`**

Import and add `VariablePicker` to the toolbar (after the existing formatting buttons):

**Changes required:**
1. Import `VariablePicker` component
2. Import `Braces` icon from lucide-react
3. Add insertion handler for Tiptap editor
4. Add `VariablePicker` to toolbar UI

**Insertion Handler:**
```typescript
const handleInsertVariable = useCallback((varName) => {
  if (!editor || readOnly) return;
  
  // Insert variable at current cursor position
  editor.chain().focus().insertContent(`{{${varName}}}`).run();
}, [editor, readOnly]);
```

**Toolbar Addition (after the Code button, around line 520):**
```typescript
<div className="w-px h-4 bg-outline-variant mx-1" />

<VariablePicker
  onInsert={handleInsertVariable}
  userVariables={variables}
  familyRootPromptRowId={familyRootPromptRowId}
  side="bottom"
  align="end"
/>
```

---

### Phase 3: Add Variable Highlighting to Notes (Priority: Critical)

**File: `src/components/shared/MarkdownNotesArea.tsx`**

Create a Tiptap decoration plugin to highlight `{{...}}` patterns in the WYSIWYG editor.

**Option A: CSS-based highlighting (Simpler)**

Add CSS to highlight variables within prose content:

```typescript
// In editorProps.attributes.class, append:
'[&_*]:before:content-none [&_.variable-highlight]:text-primary [&_.variable-highlight]:bg-primary/10 [&_.variable-highlight]:px-0.5 [&_.variable-highlight]:rounded'
```

Create a Tiptap extension to detect and wrap `{{...}}` patterns:

**New file: `src/components/shared/tiptap-variable-highlight.ts`**

```typescript
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const VARIABLE_PATTERN = /\{\{[^}]+\}\}/g;

export const VariableHighlight = Extension.create({
  name: 'variableHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('variableHighlight'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const { doc } = state;

            doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;

              let match;
              while ((match = VARIABLE_PATTERN.exec(node.text)) !== null) {
                const from = pos + match.index;
                const to = from + match[0].length;
                decorations.push(
                  Decoration.inline(from, to, {
                    class: 'variable-highlight',
                  })
                );
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});
```

**Integration in MarkdownNotesArea:**
```typescript
import { VariableHighlight } from './tiptap-variable-highlight';

// In useEditor extensions array:
extensions: [
  StarterKit.configure({ ... }),
  Link.configure({ ... }),
  Placeholder.configure({ ... }),
  VariableHighlight,  // NEW
],
```

**CSS for variable highlighting (add to editorProps):**
```css
.variable-highlight {
  color: var(--primary);
  background-color: rgba(var(--primary-rgb), 0.1);
  padding: 0 2px;
  border-radius: 2px;
  font-family: monospace;
}
```

---

### Phase 4: Update PromptsContent to Pass Variables (Priority: Critical)

**File: `src/components/content/PromptsContent.tsx`**

Update the `MarkdownNotesArea` usage at line 251-258 to pass variable props:

```typescript
{/* Notes */}
<MarkdownNotesArea 
  label="Notes"
  value={promptData?.note || ''}
  placeholder="Add notes about this prompt..."
  defaultHeight={80}
  onSave={isLocked ? undefined : (value) => onUpdateField('note', value)}
  readOnly={isLocked}
  variables={variables}  // NEW
  familyRootPromptRowId={promptData?.root_prompt_row_id || promptData?.row_id}  // NEW
/>
```

---

### Phase 5: Update TemplateStructureEditor (Priority: Medium)

**File: `src/components/templates/TemplateStructureEditor.tsx`**

Similar update at line 835-842 to pass variables to the Notes area:

```typescript
<MarkdownNotesArea 
  label="Notes"
  value={node.note || ''}
  placeholder="Internal notes about this prompt..."
  defaultHeight={80}
  onSave={(value) => onUpdate({ note: value })}
  storageKey={notesStorageKey}
  variables={templateVariables || []}  // NEW - if available in scope
  familyRootPromptRowId={node?.root_prompt_row_id || node?.row_id}  // NEW
/>
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/shared/tiptap-variable-highlight.ts` | Tiptap extension for `{{...}}` highlighting |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/shared/MarkdownNotesArea.tsx` | Add `variables` and `familyRootPromptRowId` props, import `VariablePicker`, add toolbar button, add `VariableHighlight` extension |
| `src/components/content/PromptsContent.tsx` | Pass `variables` and `familyRootPromptRowId` to `MarkdownNotesArea` |
| `src/components/templates/TemplateStructureEditor.tsx` | Pass variable props to `MarkdownNotesArea` |

---

## Technical Specifications

### Props Interface Update for MarkdownNotesArea

```typescript
interface MarkdownNotesAreaProps {
  value?: string;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void | Promise<void>;
  placeholder?: string;
  label?: string;
  defaultHeight?: number;
  readOnly?: boolean;
  storageKey?: string;
  // NEW: Variable support
  variables?: Array<{ name: string; value?: string; description?: string }> | string[];
  familyRootPromptRowId?: string | null;
}
```

### Variable Highlighting CSS (M3 Design System)

```css
.variable-highlight {
  @apply text-primary bg-primary/10 px-0.5 rounded font-mono text-[0.95em];
}
```

---

## Implementation Order

1. **Create** `tiptap-variable-highlight.ts` extension
2. **Modify** `MarkdownNotesArea.tsx`:
   - Add new props
   - Import `VariablePicker` and `VariableHighlight`
   - Add insertion handler
   - Add toolbar button
   - Register extension
3. **Modify** `PromptsContent.tsx` - pass variable props
4. **Modify** `TemplateStructureEditor.tsx` - pass variable props

---

## Testing Checklist

- [ ] Variables typed in Notes area display with pink highlighting
- [ ] Braces icon appears in Notes toolbar
- [ ] Clicking Braces icon opens variable picker popover
- [ ] Selecting a variable inserts `{{varName}}` at cursor
- [ ] Prompt References option opens picker modal
- [ ] Inserted variables are highlighted immediately
- [ ] Auto-save still works after variable insertion
- [ ] Undo/discard works with variable content
- [ ] Variables work in both PromptsContent and TemplateStructureEditor

