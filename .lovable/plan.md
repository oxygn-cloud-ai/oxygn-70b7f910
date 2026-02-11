

# Fix Pre-existing TypeScript Strict Mode Errors

These build errors are pre-existing and unrelated to the IAM framework, but they block the build. Each file needs explicit TypeScript interfaces for its props and proper type annotations.

## Files to Fix

### 1. `src/components/PromptReferencePicker.tsx`
- Remove unused `React` import
- Add `PromptTreeNode` interface for the tree node shape (`row_id`, `prompt_name`, `is_assistant`, `children`, `parent_row_id`, `position`)
- Add `PromptTreeNodeProps` interface for the component props
- Add `PromptReferencePickerProps` interface
- Type `buildTree` parameter and return, `findFamilyRoot`, `sortChildren` internals
- Type `selectedPrompt` state as `PromptTreeNode | null`

### 2. `src/components/QuestionPopup.tsx`
- Remove unused `React` import
- Add `QuestionPopupProps` interface with all destructured props typed
- Type `textareaRef` as `useRef<HTMLTextAreaElement>(null)`
- Type `timeoutId` with `ReturnType<typeof setTimeout>`
- Type event handler parameters (`e: React.KeyboardEvent<HTMLTextAreaElement>`)
- Type `collectedVariables` map callback parameters

### 3. `src/components/ReasoningStreamPopup.tsx`
- Add `ReasoningStreamPopupProps` interface
- Type `scrollRef` as `useRef<HTMLDivElement>(null)`
- Type `scrollTimeoutRef` as `useRef<ReturnType<typeof setTimeout> | null>(null)`

### 4. `src/components/QuestionNodeSettings.tsx`
- Remove unused `React` import
- Add `QuestionConfig` interface and `QuestionNodeSettingsProps` interface
- Type `handleChange` parameters

### 5. `src/components/SaveAsTemplateDialog.tsx`
- Remove unused `React` import (keep `useState`, `useEffect`)
- Add `SaveAsTemplateDialogProps` interface
- Fix `onCheckedChange` handlers: wrap `setIncludeChildren` and `setIsShared` with `(checked: boolean) => void` cast using `(v: boolean | "indeterminate") => setX(v === true)`

### 6. `src/components/SearchFilter.tsx`
- Remove unused `React` import (keep as namespace for `React.Fragment` usage -- actually switch to `<>` fragments)
- Add `SearchFilterProps` interface

### 7. `src/components/PromptField.tsx`
- Remove unused `setIsLinking` (line 63) -- remove the state entirely since `_isLinking` is also unused
- Fix line 79: `useFieldUndo` expects `string | null | undefined` but gets `string | undefined` -- change `promptId ?? undefined` to `promptId ?? null`  
- Fix line 549: same pattern -- `familyRootPromptRowId` type mismatch, cast appropriately
- Fix line 607: the synthetic event cast -- use `unknown` intermediate cast: `as unknown as React.SyntheticEvent<HTMLTextAreaElement>`

### Approach
- Only add types and remove unused imports
- No functional, layout, or styling changes
- No changes to component behavior

