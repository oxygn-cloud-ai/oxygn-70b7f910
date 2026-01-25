

# Fix: Execute Parent Prompt in Cascade Runs

## Problem Analysis

When a cascade run is initiated from a parent prompt, the parent prompt itself is **skipped** and only its children are executed. This is caused by explicit skip logic in `useCascadeExecutor.ts` at lines 765-770:

```typescript
// Skip top-level prompt (level 0) if it's an assistant - it's the parent, not a child
if (levelIdx === 0 && prompt.is_assistant) {
  console.log(`Skipping assistant prompt at level 0: ${prompt.prompt_name} (provides conversation context)`);
  continue;
}
```

### Root Cause
This logic was added under the assumption that the `conversation-run` edge function cannot handle running a prompt that is itself an assistant. However, analysis of the edge function shows this assumption is **incorrect**:

The edge function at lines 1966-1977 explicitly checks if the current prompt has an assistant and uses it directly:
```typescript
if (selfAssistant) {
  assistantData = selfAssistant;
  topLevelPromptId = child_prompt_row_id;
  // ...
}
```

### Architectural Clarification
The memory note `architecture/cascade-run-top-level-execution` states:
> "Top-level prompt must be executed first in cascade runs unless explicitly excluded via exclude_from_cascade flag."

The note also mentions that "top-level assistant itself is architecture-internal" but this refers to the **assistant record** in the `q_assistants` table, not the **prompt** in the `q_prompts` table. The prompt should still be executed; its assistant record provides configuration.

---

## Solution

Remove the skip logic that prevents top-level assistant prompts from being executed.

---

## Technical Implementation

### File: `src/hooks/useCascadeExecutor.ts`

**Current Code (Lines 765-770):**
```typescript
          // Skip top-level prompt (level 0) if it's an assistant - it's the parent, not a child
          // The conversation-run function expects child prompts with a parent
          if (levelIdx === 0 && prompt.is_assistant) {
            console.log(`Skipping assistant prompt at level 0: ${prompt.prompt_name} (provides conversation context)`);
            continue;
          }
```

**Change:** Remove these lines entirely.

The existing check for `exclude_from_cascade` at lines 760-763 remains, which correctly handles user-specified exclusions:
```typescript
// Skip if excluded from cascade
if (prompt.exclude_from_cascade) {
  console.log(`Skipping excluded prompt: ${prompt.prompt_name}`);
  continue;
}
```

---

## Memory Update

After implementation, update the memory note `architecture/cascade-run-top-level-execution` to clarify:
- Top-level prompts are always executed regardless of `is_assistant` status
- Only `exclude_from_cascade` flag prevents execution
- The assistant record provides configuration context but does not prevent prompt execution

---

## Testing Requirements

1. **Basic Cascade Run**
   - Create parent prompt with `is_assistant = true`
   - Add 2-3 child prompts
   - Run cascade from parent
   - Verify: Parent prompt executes FIRST, then children in order

2. **Excluded Parent**
   - Set `exclude_from_cascade = true` on parent
   - Run cascade
   - Verify: Parent is skipped, children execute

3. **Non-Assistant Parent**
   - Create parent with `is_assistant = false`
   - Run cascade
   - Verify: Works same as before (no behavior change)

4. **Edge Case: Empty Parent Prompt**
   - Parent has no `input_admin_prompt` or `input_user_prompt`
   - Run cascade
   - Verify: Uses fallback message, doesn't error

---

## Files Modified

1. `src/hooks/useCascadeExecutor.ts` - Remove 6 lines (765-770)

## Estimated Complexity

- Lines removed: 6
- Risk: Low (removing incorrect skip logic)
- Impact: Cascade runs will now include the parent prompt in execution

