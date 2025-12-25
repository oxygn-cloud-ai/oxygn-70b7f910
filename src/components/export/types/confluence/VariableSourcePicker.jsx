import React, { useMemo, useState } from 'react';
import { FileText, Variable, Search, ChevronDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
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
  const [searchQuery, setSearchQuery] = useState('');

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
            description: field.description,
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
              description: variable.variable_description || 'Custom variable',
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

  // Filter groups by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedOptions;
    
    const query = searchQuery.toLowerCase();
    return groupedOptions
      .map(group => ({
        ...group,
        sources: group.sources.filter(s => 
          s.label.toLowerCase().includes(query) ||
          group.promptName.toLowerCase().includes(query)
        )
      }))
      .filter(group => group.sources.length > 0 || group.promptName.toLowerCase().includes(query));
  }, [groupedOptions, searchQuery]);

  // Sort: top-level first, then children
  const sortedGroups = useMemo(() => {
    return [...filteredGroups].sort((a, b) => {
      if (a.isTopLevel && !b.isTopLevel) return -1;
      if (!a.isTopLevel && b.isTopLevel) return 1;
      return 0;
    });
  }, [filteredGroups]);

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
    const group = groupedOptions.find(g => g.promptId === value.promptId);
    if (!group) return null;
    const source = group.sources.find(s => s.type === value.sourceType && s.id === value.sourceId);
    if (!source) return null;
    
    // Shorten prompt name for display
    const shortPromptName = group.promptName.length > 20 
      ? group.promptName.substring(0, 20) + '...' 
      : group.promptName;
    return `${shortPromptName} → ${source.label}`;
  };

  if (groupedOptions.length === 0) {
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
      <SelectContent className="max-h-[350px] w-[320px]">
        {/* Search input */}
        {groupedOptions.length > 3 && (
          <div className="px-2 pb-2 sticky top-0 bg-popover z-10">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search prompts & fields..."
                className="pl-7 h-8 text-xs"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
        
        {sortedGroups.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            No matching sources
          </div>
        ) : (
          sortedGroups.map(group => (
            <SelectGroup key={group.promptId}>
              <SelectLabel className="flex items-center gap-1.5 text-xs text-muted-foreground py-2 px-2 bg-muted/30">
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0",
                  group.isTopLevel ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {group.isTopLevel ? 'Root' : 'Child'}
                </span>
                <span className="truncate font-medium text-foreground">{group.promptName}</span>
              </SelectLabel>
              {group.sources.map(source => (
                <SelectItem
                  key={`${group.promptId}|${source.type}|${source.id}`}
                  value={`${group.promptId}|${source.type}|${source.id}`}
                  className="pl-4"
                >
                  <div className="flex items-center gap-2">
                    {source.type === 'field' ? (
                      <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    ) : (
                      <Variable className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-sm">{source.label}</span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          ))
        )}
      </SelectContent>
    </Select>
  );
};
