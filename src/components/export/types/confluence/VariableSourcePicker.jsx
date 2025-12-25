import React, { useMemo } from 'react';
import { FileText, Variable, ChevronRight } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * Unified dropdown for selecting a data source (field or variable) from any prompt.
 * Groups options by prompt, showing prompt name as group header.
 * Returns: { promptId, sourceType: 'field' | 'variable', sourceId: string }
 */
export const VariableSourcePicker = ({
  value, // { promptId, sourceType, sourceId } or null
  onChange, // (source: { promptId, sourceType, sourceId } | null) => void
  promptsData = [],
  variablesData = {},
  selectedFields = [],
  selectedVariables = {},
  STANDARD_FIELDS = [],
  placeholder = 'Select source...',
  className,
  includeFields = true,
  includeVariables = true,
}) => {
  // Build grouped options: { promptId, promptName, isTopLevel, sources: [{ type, id, label }] }
  const groupedOptions = useMemo(() => {
    if (!promptsData || promptsData.length === 0) return [];

    // Determine top-level prompts (those without parent or first in list)
    const topLevelIds = new Set(
      promptsData.filter(p => !p.parent_row_id).map(p => p.row_id)
    );

    return promptsData.map(prompt => {
      const sources = [];
      const promptId = prompt.row_id;
      const isTopLevel = topLevelIds.has(promptId);

      // Add selected fields for this prompt
      if (includeFields) {
        const availableFields = STANDARD_FIELDS.filter(f => selectedFields.includes(f.id));
        availableFields.forEach(field => {
          sources.push({
            type: 'field',
            id: field.id,
            label: field.label,
          });
        });
      }

      // Add selected variables for this prompt
      if (includeVariables) {
        const promptVarNames = selectedVariables[promptId] || [];
        const promptVars = variablesData[promptId] || [];
        
        promptVarNames.forEach(varName => {
          const variable = promptVars.find(v => v.variable_name === varName);
          if (variable) {
            sources.push({
              type: 'variable',
              id: varName,
              label: `{{${varName}}}`,
            });
          }
        });
      }

      return {
        promptId,
        promptName: prompt.prompt_name || 'Untitled Prompt',
        isTopLevel,
        sources,
      };
    }).filter(group => group.sources.length > 0);
  }, [promptsData, variablesData, selectedFields, selectedVariables, STANDARD_FIELDS, includeFields, includeVariables]);

  // Sort: top-level first, then children
  const sortedGroups = useMemo(() => {
    return [...groupedOptions].sort((a, b) => {
      if (a.isTopLevel && !b.isTopLevel) return -1;
      if (!a.isTopLevel && b.isTopLevel) return 1;
      return 0;
    });
  }, [groupedOptions]);

  // Encode/decode value for Select component
  const encodeValue = (source) => {
    if (!source) return '';
    return `${source.promptId}|${source.sourceType}|${source.sourceId}`;
  };

  const decodeValue = (encoded) => {
    if (!encoded) return null;
    const [promptId, sourceType, sourceId] = encoded.split('|');
    return { promptId, sourceType, sourceId };
  };

  const handleChange = (encoded) => {
    const decoded = decodeValue(encoded);
    onChange(decoded);
  };

  // Get display text for current value
  const getDisplayText = () => {
    if (!value) return null;
    const group = sortedGroups.find(g => g.promptId === value.promptId);
    if (!group) return null;
    const source = group.sources.find(s => s.type === value.sourceType && s.id === value.sourceId);
    if (!source) return null;
    return `${group.promptName} → ${source.label}`;
  };

  if (sortedGroups.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger className={cn("bg-background text-sm", className)}>
          <SelectValue placeholder="No sources available" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={encodeValue(value)} onValueChange={handleChange}>
      <SelectTrigger className={cn("bg-background text-sm", className)}>
        <SelectValue placeholder={placeholder}>
          {getDisplayText()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {sortedGroups.map(group => (
          <SelectGroup key={group.promptId}>
            <SelectLabel className="flex items-center gap-1.5 text-xs text-muted-foreground py-1.5">
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-medium",
                group.isTopLevel ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {group.isTopLevel ? 'Top' : 'Child'}
              </span>
              <span className="truncate">{group.promptName}</span>
            </SelectLabel>
            {group.sources.map(source => (
              <SelectItem
                key={`${group.promptId}|${source.type}|${source.id}`}
                value={`${group.promptId}|${source.type}|${source.id}`}
                className="pl-6"
              >
                <div className="flex items-center gap-2">
                  {source.type === 'field' ? (
                    <FileText className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <Variable className="h-3 w-3 text-primary" />
                  )}
                  <span className="truncate">{source.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
};
