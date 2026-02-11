
# Fix Pre-existing TypeScript Strict Mode Errors

## Completed ✅
- `src/components/PromptReferencePicker.tsx` - typed
- `src/components/QuestionPopup.tsx` - typed
- `src/components/ReasoningStreamPopup.tsx` - typed
- `src/components/QuestionNodeSettings.tsx` - typed
- `src/components/SaveAsTemplateDialog.tsx` - typed
- `src/components/SearchFilter.tsx` - typed
- `src/components/PromptField.tsx` - fixed unused vars, useFieldUndo call, event cast
- `src/components/SettingField.tsx` - typed
- `src/components/SettingsAccordion.tsx` - typed
- `src/components/SettingsPanel.tsx` - typed
- `src/components/TemplatePickerDialog.tsx` - typed with eslint-disable for any
- `src/components/VariablePicker.tsx` - typed with proper interfaces
- `src/components/ThreadHistory.tsx` - typed
- `src/components/ThreadSelector.tsx` - typed
- `src/components/ToastHistoryPopover.tsx` - typed
- `src/components/UndoHistoryPopover.tsx` - typed
- `src/contexts/ToastHistoryContext.tsx` - typed
- `src/contexts/UndoContext.tsx` - typed
- `src/config/contextVariables.ts` - typed
- `src/components/admin/KnowledgeEditor.tsx` - typed
- `src/components/admin/KnowledgeImportExport.tsx` - typed
- `src/components/admin/KnowledgeManager.tsx` - typed (with `as any` for useKnowledge)
- `src/components/ui/dropdown-menu.tsx` - added forwardRef generics
- `src/components/ui/setting-card.tsx` - added forwardRef generics
- `src/components/ui/setting-row.tsx` - added forwardRef generics
- `src/components/ui/setting-divider.tsx` - added forwardRef generics
- `src/components/ui/setting-input.tsx` - added forwardRef generics
- `src/components/ui/table.tsx` - added forwardRef generics
- `src/hooks/useFieldUndo.ts` - added type annotations

## Remaining (cascading strict mode errors) 🔲

### chat/ components
- `src/components/chat/EmptyChat.tsx` - props interface
- `src/components/chat/MessageItem.tsx` - remove unused `isStreaming`
- `src/components/chat/ModelReasoningSelector.tsx` - props interface, type models
- `src/components/chat/ThinkingIndicator.tsx` - props interface
- `src/components/chat/ThreadSidebar.tsx` - type thread params, fix `preview` prop
- `src/components/chat/ToolActivityIndicator.tsx` - remove unused `isExecuting`

### content/ components
- `src/components/content/AuthContent.tsx` - remove unused SettingInput
- `src/components/content/DashboardTabContent.tsx` - massive: props interfaces, type context, remove unused imports
- `src/components/content/DeletedItemsContent.tsx` - likely needs typing
- `src/components/content/HealthContent.tsx` - likely needs typing
- `src/components/content/PromptsContent.tsx` - likely needs typing
- `src/components/content/SettingsContent.tsx` - likely needs typing
- `src/components/content/TemplatesContent.tsx` - likely needs typing
- `src/components/content/VariablesTabContent.tsx` - likely needs typing

### contexts/
- `src/contexts/CascadeRunContext.tsx` - missing `skipPreviews`/`setSkipPreviews` in type
- `src/contexts/LiveApiDashboardContext.tsx` - likely needs typing

### hooks/
- `src/hooks/useKnowledge.ts` - needs return type annotation

### Approach
- Only add types and remove unused imports
- No functional, layout, or styling changes
- Use `as any` or `eslint-disable` pragmatically for deeply untyped hooks/contexts

---

# IAM Framework Implementation

## Phase A (Foundation) - In Progress
- A1: Database migration ✅ (tenants, memberships, permissions, credentials tables)
- A2: Edge helpers ✅ (tenant.ts, tables.ts constants, ToolContext update)
- A3: AuthContext tenant integration 🔲 (blocked by TS errors above)
- A4: Tenant admin UI 🔲

## Phase B-E: Deferred until Phase A completes
