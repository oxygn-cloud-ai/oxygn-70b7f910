

# Remediation Plan: Build Error TS6310 Resolution

## Executive Summary
The build is blocked due to TypeScript error TS6310. The approved remediation plan specified modifying `tsconfig.node.json`, but this file appears to be platform-managed. This plan provides an alternative solution.

---

## Root Cause Analysis

The error occurs because:
1. `tsconfig.json` (line 31-34) references `./tsconfig.node.json`
2. `tsconfig.json` has `"noEmit": true` (line 13)
3. `tsconfig.node.json` has `"composite": true` but no explicit `noEmit` setting
4. TypeScript requires referenced composite projects to be able to emit declarations

The conflict: main config says "don't emit" but the referenced project needs to emit for composite to work.

---

## Solution: Remove Project References

Since `tsconfig.node.json` is platform-managed and cannot be modified, we will remove the project references from `tsconfig.json`. This is safe because:

1. `vite.config.ts` is already handled by the `esbuild.tsconfigRaw` workaround in `vite.config.ts`
2. Vite doesn't require TypeScript project references to function
3. This matches the documented workaround pattern in memory note

---

## Technical Implementation

### File: `tsconfig.json`

**Current (lines 28-35):**
```json
  "include": [
    "src"
  ],
  "references": [
    {
      "path": "./tsconfig.node.json"
    }
  ]
}
```

**Change to:**
```json
  "include": [
    "src"
  ]
}
```

**Rationale:** Removing the `references` array eliminates the TS6310 conflict while preserving all source file type checking. The `vite.config.ts` is already bypassed via `esbuild.tsconfigRaw`.

---

## Files Modified

1. `tsconfig.json` - Remove lines 31-35 (references array)

## Estimated Complexity

- Lines removed: 5
- Risk: Low (references not required for Vite builds)
- Build should pass after this change

---

## Testing Requirements

1. **Build passes**: No TS6310 error
2. **Type checking works**: Run `tsc --noEmit` on src files
3. **Preview loads**: Application renders without errors
4. **Hot reload works**: Vite HMR functions correctly

---

## Rollback Plan

If build issues arise, restore the references array and investigate alternative solutions with platform support.

