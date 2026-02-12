

# Remediation Plan: Non-TypeScript Audit Fixes

Fixing the functional bugs, architectural violations, and missing error handling identified in the audit -- excluding all TypeScript-related items per your instruction.

---

## Fix 1: HealthContent.tsx -- Replace Hardcoded Table Names

The project universally uses `import.meta.env.VITE_*_TBL` for table references (confirmed in 35+ files). HealthContent.tsx hardcodes 5 table names, violating this pattern.

**Change:** Replace the `DATABASE_TABLES` array (lines 26-32) with env-var references:
```
const DATABASE_TABLES = [
  { key: import.meta.env.VITE_PROMPTS_TBL || 'q_prompts', label: 'Prompts' },
  { key: import.meta.env.VITE_TEMPLATES_TBL || 'q_templates', label: 'Templates' },
  { key: import.meta.env.VITE_THREADS_TBL || 'q_threads', label: 'Threads' },
  { key: import.meta.env.VITE_AI_COSTS_TBL || 'q_ai_costs', label: 'AI Costs' },
  { key: import.meta.env.VITE_PROFILES_TBL || 'profiles', label: 'Profiles' },
];
```

Also fix the hardcoded `'q_prompts'` on line 447 to use `import.meta.env.VITE_PROMPTS_TBL`.

Update DatabaseSection and checkHealth to use `.key` and `.label` from the new structure.

---

## Fix 2: HealthContent.tsx -- Parallelize DB Queries

Replace the sequential `for...await` loop (lines 455-461) with `Promise.all`:

```js
const tableResults = {};
await Promise.all(DATABASE_TABLES.map(async (table) => {
  try {
    const { count } = await supabase.from(table.key).select('*', { count: 'exact', head: true });
    tableResults[table.key] = { status: 'success', count: count || 0 };
  } catch {
    tableResults[table.key] = { status: 'error', count: 0 };
  }
}));
```

---

## Fix 3: HealthContent.tsx -- Remove Unused Imports

Remove `Server` and `Key` from the lucide-react import on line 4. They are referenced in the HEALTH_SECTIONS map (lines 512, 516) so `Server` is used for Database section and `Key` for API Health. After checking -- they ARE used. No change needed here. (Audit finding was incorrect on this point.)

---

## Fix 4: HealthContent.tsx -- Fix useEffect Missing Dependency

In ResourcesSection (line 298-300), add `checkAll` to the dependency array:

```js
useEffect(() => { checkAll(); }, [checkAll]);
```

---

## Fix 5: DashboardTabContent.tsx -- Fix Auto-Scroll State

Rename `_autoScroll` back to `autoScroll` and `_setAutoScroll` back to `setAutoScroll` so the auto-scroll feature actually works. The state is already used on line 166 to control scrolling behavior.

---

## Fix 6: DashboardTabContent.tsx -- Wrap Clipboard in Try/Catch

Add error handling to `handleCopyReasoning` (line 172-176):

```js
const handleCopyReasoning = async () => {
  if (primaryCall?.thinkingSummary) {
    try {
      await navigator.clipboard.writeText(primaryCall.thinkingSummary);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  }
};
```

---

## Fix 7: DeletedItemsContent.tsx -- Add Error Handling

Wrap `handleRestore` and `handleConfirmDelete` in try/catch with user feedback:

```js
const handleRestore = async (type, rowId) => {
  try {
    await restoreItem(type, rowId);
  } catch (err) {
    toast.error('Failed to restore item');
  }
};

const handleConfirmDelete = async () => {
  try {
    if (deleteDialog.type && deleteDialog.rowId) {
      await permanentlyDeleteItem(deleteDialog.type, deleteDialog.rowId);
    }
  } catch (err) {
    toast.error('Failed to delete item');
  }
  setDeleteDialog({ open: false, type: null, rowId: null, name: '' });
};
```

---

## Fix 8: MessageItem.tsx -- Fix isStreaming Inconsistency

Either use `isStreaming` in the render (e.g., show a cursor indicator) or remove it from the memo comparator. The simplest correct fix: keep the prop name as `isStreaming` (remove the underscore rename) and add a subtle streaming indicator:

```jsx
export const MessageItem = memo<MessageItemProps>(({ msg, isStreaming }) => (
  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
    <div ...>
      {msg.role === 'assistant' ? (
        <Suspense ...>
          <div className="prose ...">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
            {isStreaming && <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5" />}
          </div>
        </Suspense>
      ) : (
        <p ...>{msg.content}</p>
      )}
    </div>
  </div>
));
```

---

## Summary of Files Modified

| File | Changes |
|------|---------|
| `src/components/content/HealthContent.tsx` | Env-var table refs, parallel queries, useEffect dep fix |
| `src/components/content/DashboardTabContent.tsx` | Restore autoScroll state, clipboard error handling |
| `src/components/content/DeletedItemsContent.tsx` | Error handling on restore/delete |
| `src/components/chat/MessageItem.tsx` | Fix isStreaming prop usage, add cursor indicator |

