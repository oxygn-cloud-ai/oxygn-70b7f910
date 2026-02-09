

# Adversarial Audit: Build Error Remediation Plan

## Executive Summary

The proposed remediation plan contains **significant flaws and omissions**. The build errors stem from removing the `references` array in `tsconfig.json`, which exposed **pre-existing strict mode violations** across multiple UI primitive components and the `ActionConfigRenderer`. The original plan addresses only 6 files, but **9 additional UI components** have identical typing issues that will cause build failures.

---

## Critical Findings

### 1. ❌ INCOMPLETE SCOPE: Missing 9 Additional Untyped Components

The build errors show `Label`, `Checkbox`, `Switch`, `Input`, `Textarea`, `SelectTrigger`, `SelectContent`, `SelectItem`, `ScrollArea`, and `Badge` all have typing issues. The proposed plan only fixes 6 files.

**Missing from plan:**
| File | Issue |
|------|-------|
| `src/components/ui/select.tsx` | 6 `forwardRef` calls without type parameters (lines 13, 29, 39, 50, 74, 82, 101) |
| `src/components/ui/scroll-area.tsx` | 2 `forwardRef` calls without type parameters (lines 6, 20) |
| `src/components/ui/badge.tsx` | Function component without typed props (line 32-37) |
| `src/components/ui/textarea.tsx` | `forwardRef` without type parameters (line 5) |

### 2. ❌ BUG: ActionConfigRenderer Interfaces are Incomplete

The proposed `ConfigField` interface is missing critical properties used in the code:

**Missing properties:**
- `fallbackType?: string` (line 145)
- `fallbackPattern?: string` (line 235)

### 3. ❌ OMISSION: Return Type for extractSchemaKeys Not Typed

The `extractSchemaKeys` function in `schemaUtils.ts` returns an untyped array. The `schemaKeys` useMemo in ActionConfigRenderer should use the actual return type.

**From schemaUtils.ts line 171-181:**
```typescript
export const extractSchemaKeys = (schema) => {
  // Returns objects with: key, type, description, isArray, hasItems
};
```

### 4. ⚠️ RISK: Existing Database Types Should Be Used

The `usePromptLibrary` hook returns items from `q_prompt_library` table. The Database types already define this at lines 1442-1486 of `types.ts`. The proposed plan creates duplicate `LibraryItem` interface instead of importing from existing types.

**Correct approach:**
```typescript
import { Database } from '@/integrations/supabase/types';
type PromptLibraryRow = Database['public']['Tables']['q_prompt_library']['Row'];
```

### 5. ⚠️ RISK: TreeData Types Exist in useTreeData Hook

The `useTreeData` hook returns `treeData` which should align with existing prompt table types. Creating a separate `TreeNode` interface creates type divergence.

---

## Revised Remediation Plan

### Phase 1: Fix UI Primitive Components (Build Blocking)

#### 1.1 Fix `src/App.tsx`
Remove unused import on line 1:
```typescript
// Remove: import React from "react";
```

#### 1.2 Fix `src/components/ui/label.tsx`
```typescript
import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
```

#### 1.3 Fix `src/components/ui/checkbox.tsx`
```typescript
import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    {...props}>
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
```

#### 1.4 Fix `src/components/ui/input.tsx`
```typescript
import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-tree ring-offset-background file:border-0 file:bg-transparent file:text-tree file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
)
Input.displayName = "Input"

export { Input }
```

#### 1.5 Fix `src/components/ui/switch.tsx`
```typescript
import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    )}
    {...props}
    ref={ref}>
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
```

#### 1.6 Fix `src/components/ui/textarea.tsx`
```typescript
import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
```

#### 1.7 Fix `src/components/ui/badge.tsx`
```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground border-border",
        success: "border-transparent bg-green-500/10 text-green-600 dark:text-green-400",
        warning: "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400",
        info: "border-transparent bg-primary/10 text-primary",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants }
```

#### 1.8 Fix `src/components/ui/select.tsx`
Add TypeScript generics to all 7 forwardRef calls:

```typescript
import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-tree ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 [&>span]:whitespace-nowrap [&>span]:truncate",
      className
    )}
    {...props}>
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}>
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}>
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}>
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn("p-1", position === "popper" &&
          "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]")}>
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-tree font-semibold", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-tree outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}>
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-3.5 w-3.5" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText className="whitespace-nowrap truncate">{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
```

#### 1.9 Fix `src/components/ui/scroll-area.tsx`
```typescript
import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}>
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}>
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
```

---

### Phase 2: Fix ActionConfigRenderer (Build Blocking)

#### 2.1 Fix `src/components/ActionConfigRenderer.tsx`

```typescript
/**
 * ActionConfigRenderer
 * 
 * Dynamically renders configuration fields based on action type schema.
 * Supports text, number, select, textarea, boolean, json_path, schema_keys, and prompt_picker field types.
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CONFIG_FIELD_TYPES } from '@/config/actionTypes';
import { usePromptLibrary } from '@/hooks/usePromptLibrary';
import { extractSchemaKeys } from '@/utils/schemaUtils';
import useTreeData from '@/hooks/useTreeData';
import { useSupabase } from '@/hooks/useSupabase';
import { Database } from '@/integrations/supabase/types';

// Type definitions
type PromptLibraryRow = Database['public']['Tables']['q_prompt_library']['Row'];

interface SchemaKey {
  key: string;
  type: string;
  description: string;
  isArray: boolean;
  hasItems: boolean;
}

interface ConfigFieldOption {
  value: string;
  label: string;
}

interface ConfigFieldDependency {
  key: string;
  value: unknown;
}

interface ConfigField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  helpText?: string;
  placeholder?: string;
  defaultValue?: unknown;
  options?: (string | ConfigFieldOption)[];
  min?: number;
  max?: number;
  dependsOn?: ConfigFieldDependency;
  fallbackType?: string;
  fallbackPattern?: string;
}

interface TreeNode {
  row_id: string;
  prompt_name: string;
  children?: TreeNode[];
}

interface FlattenedTreeNode extends TreeNode {
  fullName: string;
}

interface ActionConfigRendererProps {
  schema?: ConfigField[];
  config?: Record<string, unknown>;
  onChange?: (newConfig: Record<string, unknown>) => void;
  disabled?: boolean;
  currentSchema?: Record<string, unknown> | null;
}

const ActionConfigRenderer: React.FC<ActionConfigRendererProps> = ({ 
  schema = [], 
  config = {}, 
  onChange,
  disabled = false,
  currentSchema = null,
}) => {
  const supabase = useSupabase();
  const { items: libraryItems, isLoading: libraryLoading } = usePromptLibrary();
  const { treeData, isLoading: treeLoading } = useTreeData(supabase);

  const handleFieldChange = (key: string, value: unknown): void => {
    onChange?.({
      ...config,
      [key]: value,
    });
  };

  // Extract keys from currentSchema for SCHEMA_KEYS field type
  const schemaKeys = React.useMemo((): SchemaKey[] => {
    if (!currentSchema) return [];
    return extractSchemaKeys(currentSchema) as SchemaKey[];
  }, [currentSchema]);

  // Multi-select schema keys (for selecting multiple keys)
  const renderSchemaKeysField = (field: ConfigField): React.ReactNode => {
    const selectedKeys = (config[field.key] as string[]) || [];
    const fieldId = `action-config-${field.key}`;

    return (
      <div key={field.key} className="space-y-2">
        <Label htmlFor={fieldId} className="text-label-sm text-on-surface-variant">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {field.helpText && (
          <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
        )}
        
        {schemaKeys.length === 0 ? (
          <p className="text-[10px] text-on-surface-variant italic">
            No schema keys available. Define a JSON schema first.
          </p>
        ) : (
          <div className="space-y-1 p-2 bg-surface-container rounded-m3-sm">
            {schemaKeys.map((schemaKey) => (
              <label 
                key={schemaKey.key} 
                className="flex items-center gap-2 cursor-pointer hover:bg-surface-container-high p-1 rounded"
              >
                <Checkbox
                  checked={selectedKeys.includes(schemaKey.key)}
                  onCheckedChange={(checked: boolean) => {
                    const newKeys = checked
                      ? [...selectedKeys, schemaKey.key]
                      : selectedKeys.filter((k: string) => k !== schemaKey.key);
                    handleFieldChange(field.key, newKeys);
                  }}
                  disabled={disabled}
                />
                <span className="text-body-sm text-on-surface">{schemaKey.key}</span>
                <Badge variant="outline" className="text-[9px]">{schemaKey.type}</Badge>
                {schemaKey.isArray && (
                  <Badge variant="secondary" className="text-[9px]">array</Badge>
                )}
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Single-select schema key (for picking ONE key like json_path)
  const renderSingleSchemaKeyField = (field: ConfigField): React.ReactNode => {
    const rawValue = config[field.key];
    const selectedKey = Array.isArray(rawValue) ? rawValue[0] : ((rawValue as string) || '');
    const fieldId = `action-config-${field.key}`;
    
    const arrayKeys = schemaKeys.filter((k) => k.isArray);
    const displayKeys = arrayKeys.length > 0 ? arrayKeys : schemaKeys;

    if (schemaKeys.length === 0) {
      return (
        <div key={field.key} className="space-y-2">
          <Label htmlFor={fieldId} className="text-label-sm text-on-surface-variant">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          {field.helpText && (
            <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
          )}
          <Input
            id={fieldId}
            value={selectedKey}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder || "e.g., sections or items"}
            disabled={disabled}
            className="h-8 text-body-sm font-mono"
          />
          <p className="text-[10px] text-on-surface-variant italic">
            No schema defined. Enter the array path manually.
          </p>
        </div>
      );
    }

    return (
      <div key={field.key} className="space-y-2">
        <Label htmlFor={fieldId} className="text-label-sm text-on-surface-variant">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {field.helpText && (
          <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
        )}
        
        <Select
          value={selectedKey}
          onValueChange={(value: string) => handleFieldChange(field.key, value)}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 text-body-sm">
            <SelectValue placeholder="Select array field..." />
          </SelectTrigger>
          <SelectContent>
            {displayKeys.map((schemaKey) => (
              <SelectItem key={schemaKey.key} value={schemaKey.key}>
                {schemaKey.key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderPromptPickerField = (field: ConfigField): React.ReactNode => {
    const selectedValue = (config[field.key] as string) || '';
    const fieldId = `action-config-${field.key}`;

    const flattenTree = (nodes: TreeNode[], parentName = ''): FlattenedTreeNode[] => {
      return nodes.reduce<FlattenedTreeNode[]>((acc, node) => {
        const fullName = parentName ? `${parentName} / ${node.prompt_name}` : node.prompt_name;
        acc.push({ ...node, fullName });
        if (node.children && node.children.length > 0) {
          acc.push(...flattenTree(node.children, fullName));
        }
        return acc;
      }, []);
    };

    const allPrompts = flattenTree(treeData as TreeNode[]);

    return (
      <div key={field.key} className="space-y-2">
        <Label htmlFor={fieldId} className="text-label-sm text-on-surface-variant">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {field.helpText && (
          <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
        )}
        
        <Select
          value={selectedValue}
          onValueChange={(value: string) => handleFieldChange(field.key, value)}
          disabled={disabled || treeLoading}
        >
          <SelectTrigger className="h-8 text-body-sm">
            <SelectValue placeholder={treeLoading ? "Loading..." : "Select a prompt..."} />
          </SelectTrigger>
          <SelectContent>
            <ScrollArea className="max-h-[200px]">
              {allPrompts.map((prompt) => (
                <SelectItem key={prompt.row_id} value={prompt.row_id}>
                  {prompt.fullName}
                </SelectItem>
              ))}
            </ScrollArea>
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderLibraryPickerField = (field: ConfigField): React.ReactNode => {
    const selectedValue = (config[field.key] as string) || '';
    const fieldId = `action-config-${field.key}`;

    return (
      <div key={field.key} className="space-y-2">
        <Label htmlFor={fieldId} className="text-label-sm text-on-surface-variant">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {field.helpText && (
          <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
        )}
        
        <Select
          value={selectedValue}
          onValueChange={(value: string) => handleFieldChange(field.key, value === '_none' ? null : value)}
          disabled={disabled || libraryLoading}
        >
          <SelectTrigger className="h-8 text-body-sm">
            <SelectValue placeholder={libraryLoading ? "Loading..." : "Select from library..."} />
          </SelectTrigger>
          <SelectContent>
            <ScrollArea className="max-h-[200px]">
              <SelectItem value="_none">
                <span className="text-on-surface-variant">None</span>
              </SelectItem>
              {(libraryItems as PromptLibraryRow[]).map((item) => (
                <SelectItem key={item.row_id} value={item.row_id}>
                  {item.name}
                </SelectItem>
              ))}
            </ScrollArea>
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderField = (field: ConfigField): React.ReactNode => {
    const fieldId = `action-config-${field.key}`;
    const value = config[field.key] ?? field.defaultValue ?? '';
    
    if (field.dependsOn) {
      const dependencyValue = config[field.dependsOn.key];
      if (dependencyValue !== field.dependsOn.value) {
        return null;
      }
    }

    switch (field.type) {
      case CONFIG_FIELD_TYPES.SCHEMA_KEYS:
        return renderSchemaKeysField(field);

      case CONFIG_FIELD_TYPES.SCHEMA_KEY:
        return renderSingleSchemaKeyField(field);

      case CONFIG_FIELD_TYPES.PROMPT_PICKER:
        return renderPromptPickerField(field);

      case CONFIG_FIELD_TYPES.LIBRARY_PICKER:
        return renderLibraryPickerField(field);

      case CONFIG_FIELD_TYPES.SELECT: {
        const normalizedOptions: ConfigFieldOption[] = (field.options || []).map((opt) => 
          typeof opt === 'string' ? { value: opt, label: opt } : opt
        );

        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={fieldId} className="text-label-sm text-on-surface-variant">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {field.helpText && (
              <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
            )}
            <Select
              value={value as string}
              onValueChange={(v: string) => handleFieldChange(field.key, v)}
              disabled={disabled}
            >
              <SelectTrigger className="h-8 text-body-sm">
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}...`} />
              </SelectTrigger>
              <SelectContent>
                {normalizedOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      }

      case CONFIG_FIELD_TYPES.BOOLEAN:
        return (
          <div key={field.key} className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor={fieldId} className="text-body-sm text-on-surface">
                {field.label}
              </Label>
              {field.helpText && (
                <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
              )}
            </div>
            <Switch
              id={fieldId}
              checked={!!value}
              onCheckedChange={(checked: boolean) => handleFieldChange(field.key, checked)}
              disabled={disabled}
            />
          </div>
        );

      case CONFIG_FIELD_TYPES.NUMBER:
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={fieldId} className="text-label-sm text-on-surface-variant">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {field.helpText && (
              <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
            )}
            <Input
              id={fieldId}
              type="number"
              value={value as string | number}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange(field.key, parseInt(e.target.value, 10) || 0)}
              min={field.min}
              max={field.max}
              disabled={disabled}
              className="h-8 text-body-sm"
            />
          </div>
        );

      case CONFIG_FIELD_TYPES.TEXTAREA:
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={fieldId} className="text-label-sm text-on-surface-variant">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {field.helpText && (
              <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
            )}
            <Textarea
              id={fieldId}
              value={value as string}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              disabled={disabled}
              className="text-body-sm min-h-[80px]"
            />
          </div>
        );

      case CONFIG_FIELD_TYPES.JSON_PATH:
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={fieldId} className="text-label-sm text-on-surface-variant">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {field.helpText && (
              <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
            )}
            <Input
              id={fieldId}
              value={value as string}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder || "e.g., sections or items"}
              disabled={disabled}
              className="h-8 text-body-sm font-mono"
            />
            <p className="text-[10px] text-on-surface-variant">
              Use dot notation for nested paths (e.g., <code>response.sections</code>)
            </p>
          </div>
        );

      case CONFIG_FIELD_TYPES.TEXT:
      default:
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={fieldId} className="text-label-sm text-on-surface-variant">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {field.helpText && (
              <p className="text-[10px] text-on-surface-variant">{field.helpText}</p>
            )}
            <Input
              id={fieldId}
              value={value as string}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              disabled={disabled}
              className="h-8 text-body-sm"
            />
          </div>
        );
    }
  };

  if (!schema || schema.length === 0) {
    return (
      <p className="text-[10px] text-on-surface-variant italic">
        No configuration options for this action.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {schema.map(renderField)}
    </div>
  );
};

export default ActionConfigRenderer;
```

---

## Files to Modify (Complete List)

| File | Priority | Change Summary |
|------|----------|----------------|
| `src/App.tsx` | HIGH | Remove unused React import |
| `src/components/ui/label.tsx` | HIGH | Add forwardRef type generics |
| `src/components/ui/checkbox.tsx` | HIGH | Add forwardRef type generics |
| `src/components/ui/input.tsx` | HIGH | Add forwardRef type generics + InputProps interface |
| `src/components/ui/switch.tsx` | HIGH | Add forwardRef type generics |
| `src/components/ui/textarea.tsx` | HIGH | Add forwardRef type generics + TextareaProps interface |
| `src/components/ui/badge.tsx` | HIGH | Add BadgeProps interface |
| `src/components/ui/select.tsx` | HIGH | Add forwardRef type generics to all 7 components |
| `src/components/ui/scroll-area.tsx` | HIGH | Add forwardRef type generics to both components |
| `src/components/ActionConfigRenderer.tsx` | HIGH | Full TypeScript conversion with interfaces |

---

## Verification Checklist

After implementation:
1. `npm run build` completes with zero TypeScript errors
2. All UI primitive components render correctly
3. ActionConfigRenderer functions without runtime errors
4. No type regressions in consuming components

---

## Scope Confirmation

- All changes strictly address build errors caused by tsconfig change
- No functional behavior is modified
- No new features are added
- Uses existing Database types where applicable
- Follows existing codebase patterns

