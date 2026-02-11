
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
- `src/components/ui/dropdown-menu.tsx` - added forwardRef generics
- `src/components/ui/setting-card.tsx` - added forwardRef generics
- `src/components/ui/setting-row.tsx` - added forwardRef generics
- `src/components/ui/setting-divider.tsx` - added forwardRef generics
- `src/components/ui/setting-input.tsx` - added forwardRef generics
- `src/components/ui/table.tsx` - added forwardRef generics
- `src/hooks/useFieldUndo.ts` - added type annotations

## Remaining (cascading strict mode errors) 🔲

### Components needing props interfaces + unused import removal
- `src/components/VariablePicker.tsx` - props interface, type params, remove unused React/getSystemVariableNames
- `src/components/ThreadHistory.tsx` - props interface, type message/content params
- `src/components/ThreadSelector.tsx` - props interface, type thread params
- `src/components/ToastHistoryPopover.tsx` - props interfaces for sub-components, type all params
- `src/components/UndoHistoryPopover.tsx` - props interface, type action/timestamp params

### Approach
- Only add types and remove unused imports
- No functional, layout, or styling changes
- No changes to component behavior

---

# IAM Framework Implementation

## Phase A (Foundation) - In Progress
- A1: Database migration ✅ (tenants, memberships, permissions, credentials tables)
- A2: Edge helpers ✅ (tenant.ts, tables.ts constants, ToolContext update)
- A3: AuthContext tenant integration 🔲 (blocked by TS errors above)
- A4: Tenant admin UI 🔲

## Phase B-E: Deferred until Phase A completes
