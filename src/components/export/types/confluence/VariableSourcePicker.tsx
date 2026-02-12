// @ts-nocheck
import React, { useMemo, useState } from 'react';
import { FileText, Variable, Search, ChevronDown, Lock, Calendar, User, Briefcase } from 'lucide-react';
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
import { SYSTEM_VARIABLES, SYSTEM_VARIABLE_TYPES } from '@/config/systemVariables';

// System variable groups for display
const SYSTEM_VAR_GROUPS = [
  {
    id: 'datetime',
    label: 'Date & Time',
    icon: Calendar,
    variables: ['q.today', 'q.now', 'q.year', 'q.month'],
  },
  {
    id: 'user',
    label: 'User',
    icon: User,
    variables: ['q.user.name', 'q.user.email'],
  },
  {
    id: 'prompt',
    label: 'Prompt Context',
    icon: FileText,
    variables: ['q.toplevel.prompt.name', 'q.parent.prompt.name'],
  },
  {
    id: 'policy',
    label: 'Policy',
    icon: Briefcase,
    variables: ['q.policy.version', 'q.policy.owner', 'q.policy.effective.date', 'q.policy.review.date', 'q.client.name', 'q.jurisdiction', 'q.topic'],
  },
];

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
  placeholder = 'Select data source...',
  className,
  includeFields = true,
  includeVariables = true,
  includeSystemVariables = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Build system variables as a special group
  const systemVariablesGroup = useMemo(() => {
    if (!includeSystemVariables) return null;
    
    const sources = [];
    SYSTEM_VAR_GROUPS.forEach(group => {
      group.variables.forEach(varName => {
        const def = SYSTEM_VARIABLES[varName];
        if (def) {
          sources.push({
            type: 'system',
            id: varName,
            label: `{{${varName}}}`,
            description: def.description || '',
            isStatic: def.type === SYSTEM_VARIABLE_TYPES.STATIC,
            groupLabel: group.label,
          });
        }
      });
    });
    
    return {
      promptId: '__system__',
      promptName: 'System Variables',
      isSystem: true,
      sources,
    };
  }, [includeSystemVariables]);

  // Build grouped options: { promptId, promptName, isTopLevel, sources: [{ type, id, label }] }
  const groupedOptions = useMemo(() => {
    const groups = [];
    
    // Add system variables group first
    if (systemVariablesGroup && systemVariablesGroup.sources.length > 0) {
      groups.push(systemVariablesGroup);
    }

    if (!promptsData || promptsData.length === 0) return groups;

    // Determine top-level prompts (those without parent or first in list)
    const topLevelIds = new Set(
      promptsData.filter(p => !p.parent_row_id).map(p => p.row_id)
    );

    promptsData.forEach(prompt => {
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

      if (sources.length > 0) {
        groups.push({
          promptId,
          promptName: prompt.prompt_name || 'Untitled Prompt',
          isTopLevel,
          sources,
        });
      }
    });
    
    return groups;
  }, [promptsData, variablesData, selectedFields, selectedVariables, STANDARD_FIELDS, includeFields, includeVariables, systemVariablesGroup]);

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

  // Sort: system first, then top-level, then children
  const sortedGroups = useMemo(() => {
    return [...filteredGroups].sort((a, b) => {
      // System variables always first
      if (a.isSystem && !b.isSystem) return -1;
      if (!a.isSystem && b.isSystem) return 1;
      // Then top-level prompts
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
                  group.isSystem 
                    ? "bg-green-500/10 text-green-600" 
                    : group.isTopLevel 
                      ? "bg-primary/10 text-primary" 
                      : "bg-muted text-muted-foreground"
                )}>
                  {group.isSystem ? 'System' : group.isTopLevel ? 'Root' : 'Child'}
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
                    {source.type === 'system' ? (
                      <Lock className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    ) : source.type === 'field' ? (
                      <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    ) : (
                      <Variable className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-sm">{source.label}</span>
                      {source.isStatic && (
                        <span className="text-[10px] text-green-600">auto-populated</span>
                      )}
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
