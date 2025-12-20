import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save, FileText, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TEMPLATE_CODES, DATE_FORMAT_EXAMPLES, processNamingTemplate } from '@/utils/namingTemplates';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TemplateCodesHelp = () => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="sm" className="h-6 px-2 text-muted-foreground">
        <HelpCircle className="h-4 w-4 mr-1" />
        Template Codes
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-96" align="start">
      <div className="space-y-3">
        <h4 className="font-semibold text-sm">Available Template Codes</h4>
        <div className="space-y-2">
          {TEMPLATE_CODES.map(({ code, description, example }) => (
            <div key={code} className="text-xs">
              <code className="bg-muted px-1 py-0.5 rounded font-mono">{code}</code>
              <span className="text-muted-foreground ml-2">{description}</span>
            </div>
          ))}
        </div>
        <div className="pt-2 border-t">
          <h5 className="font-medium text-xs mb-2">Date Format Examples</h5>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {DATE_FORMAT_EXAMPLES.map(({ format, example }) => (
              <div key={format}>
                <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px]">{'{{date:' + format + '}}'}</code>
                <span className="text-muted-foreground ml-1">→ {example}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
);

const DEFAULT_NAMING_CONFIG = {
  levels: [
    { level: 0, name: 'Prompt', prefix: '', suffix: '' },
    { level: 1, name: 'Sub-prompt', prefix: '', suffix: '' },
    { level: 2, name: 'Task', prefix: '', suffix: '' },
  ],
  topLevelSets: {}
};

export const PromptNamingSettings = ({ settings, updateSetting }) => {
  const [config, setConfig] = useState(DEFAULT_NAMING_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [expandedSets, setExpandedSets] = useState({});

  useEffect(() => {
    if (settings['prompt_naming_defaults']?.value) {
      try {
        const parsed = JSON.parse(settings['prompt_naming_defaults'].value);
        setConfig({ ...DEFAULT_NAMING_CONFIG, ...parsed });
      } catch (e) {
        console.error('Failed to parse naming config:', e);
      }
    }
  }, [settings]);

  const handleLevelChange = (levelIndex, field, value) => {
    setConfig(prev => {
      const newLevels = [...prev.levels];
      newLevels[levelIndex] = { ...newLevels[levelIndex], [field]: value };
      return { ...prev, levels: newLevels };
    });
    setHasChanges(true);
  };

  const handleAddLevel = () => {
    setConfig(prev => ({
      ...prev,
      levels: [...prev.levels, { 
        level: prev.levels.length, 
        name: `Level ${prev.levels.length}`, 
        prefix: '', 
        suffix: '' 
      }]
    }));
    setHasChanges(true);
  };

  const handleRemoveLevel = (levelIndex) => {
    if (config.levels.length <= 1) {
      toast.error('Must have at least one level');
      return;
    }
    setConfig(prev => ({
      ...prev,
      levels: prev.levels.filter((_, i) => i !== levelIndex).map((l, i) => ({ ...l, level: i }))
    }));
    setHasChanges(true);
  };

  const handleAddTopLevelSet = () => {
    if (!newSetName.trim()) {
      toast.error('Set name is required');
      return;
    }
    if (config.topLevelSets[newSetName.trim()]) {
      toast.error('Set name already exists');
      return;
    }
    setConfig(prev => ({
      ...prev,
      topLevelSets: {
        ...prev.topLevelSets,
        [newSetName.trim()]: {
          levels: [
            { level: 0, name: 'Prompt', prefix: '', suffix: '' },
            { level: 1, name: 'Sub-prompt', prefix: '', suffix: '' },
          ]
        }
      }
    }));
    setNewSetName('');
    setHasChanges(true);
  };

  const handleRemoveTopLevelSet = (setName) => {
    setConfig(prev => {
      const newSets = { ...prev.topLevelSets };
      delete newSets[setName];
      return { ...prev, topLevelSets: newSets };
    });
    setHasChanges(true);
  };

  const handleSetLevelChange = (setName, levelIndex, field, value) => {
    setConfig(prev => {
      const newSets = { ...prev.topLevelSets };
      const newLevels = [...newSets[setName].levels];
      newLevels[levelIndex] = { ...newLevels[levelIndex], [field]: value };
      newSets[setName] = { ...newSets[setName], levels: newLevels };
      return { ...prev, topLevelSets: newSets };
    });
    setHasChanges(true);
  };

  const handleAddSetLevel = (setName) => {
    setConfig(prev => {
      const newSets = { ...prev.topLevelSets };
      const currentLevels = newSets[setName].levels;
      newSets[setName] = {
        ...newSets[setName],
        levels: [...currentLevels, { 
          level: currentLevels.length, 
          name: `Level ${currentLevels.length}`, 
          prefix: '', 
          suffix: '' 
        }]
      };
      return { ...prev, topLevelSets: newSets };
    });
    setHasChanges(true);
  };

  const handleRemoveSetLevel = (setName, levelIndex) => {
    const currentLevels = config.topLevelSets[setName]?.levels || [];
    if (currentLevels.length <= 1) {
      toast.error('Must have at least one level');
      return;
    }
    setConfig(prev => {
      const newSets = { ...prev.topLevelSets };
      newSets[setName] = {
        ...newSets[setName],
        levels: newSets[setName].levels
          .filter((_, i) => i !== levelIndex)
          .map((l, i) => ({ ...l, level: i }))
      };
      return { ...prev, topLevelSets: newSets };
    });
    setHasChanges(true);
  };

  const toggleSetExpanded = (setName) => {
    setExpandedSets(prev => ({ ...prev, [setName]: !prev[setName] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSetting('prompt_naming_defaults', JSON.stringify(config));
      setHasChanges(false);
      toast.success('Prompt naming defaults saved');
    } catch (err) {
      toast.error('Failed to save naming defaults');
    } finally {
      setIsSaving(false);
    }
  };

  const renderLevelTable = (levels, onLevelChange, onRemoveLevel, onAddLevel) => (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">Level</TableHead>
            <TableHead>Default Name</TableHead>
            <TableHead>Prefix</TableHead>
            <TableHead>Suffix</TableHead>
            <TableHead>Preview (1st, 2nd, 3rd)</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {levels.map((level, index) => {
            const previews = [0, 1, 2].map(seq => {
              const prefix = processNamingTemplate(level.prefix || '', seq);
              const name = processNamingTemplate(level.name || '', seq);
              const suffix = processNamingTemplate(level.suffix || '', seq);
              return `${prefix}${name}${suffix}`;
            });
            
            return (
              <TableRow key={index}>
                <TableCell className="text-muted-foreground">{index}</TableCell>
                <TableCell>
                  <Input
                    value={level.name}
                    onChange={(e) => onLevelChange(index, 'name', e.target.value)}
                    placeholder="Default name"
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={level.prefix}
                    onChange={(e) => onLevelChange(index, 'prefix', e.target.value)}
                    placeholder="Prefix"
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={level.suffix}
                    onChange={(e) => onLevelChange(index, 'suffix', e.target.value)}
                    placeholder="Suffix"
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {previews.map((preview, i) => (
                      <div key={i} className="truncate max-w-[150px]" title={preview}>
                        {preview || <span className="italic">empty</span>}
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onRemoveLevel(index)}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Button variant="outline" size="sm" onClick={onAddLevel}>
        <Plus className="h-4 w-4 mr-2" />
        Add Level
      </Button>
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Prompt Naming Defaults
          </CardTitle>
          <CardDescription>Configure default names, prefixes, and suffixes for new prompts at each level</CardDescription>
        </div>
        {hasChanges && (
          <Button size="icon" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Template codes help */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Use template codes in prefix/suffix fields for dynamic naming.
          </p>
          <TemplateCodesHelp />
        </div>

        {/* Default Levels */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Default Naming (All Prompts)</Label>
          <p className="text-sm text-muted-foreground">
            These defaults apply to all prompts unless overridden by a top-level set below.
          </p>
          {renderLevelTable(
            config.levels,
            handleLevelChange,
            handleRemoveLevel,
            handleAddLevel
          )}
        </div>

        {/* Top-Level Sets */}
        <div className="space-y-3 pt-4 border-t">
          <Label className="text-base font-semibold">Top-Level Set Overrides</Label>
          <p className="text-sm text-muted-foreground">
            Create custom naming patterns for specific top-level prompt sets. Match by the top-level prompt's name.
          </p>
          
          {/* Add new set */}
          <div className="flex gap-2">
            <Input
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              placeholder="Top-level prompt name to match..."
              className="max-w-xs"
            />
            <Button variant="outline" size="sm" onClick={handleAddTopLevelSet}>
              <Plus className="h-4 w-4 mr-2" />
              Add Set
            </Button>
          </div>

          {/* Existing sets */}
          {Object.entries(config.topLevelSets).map(([setName, setConfig]) => (
            <Collapsible
              key={setName}
              open={expandedSets[setName]}
              onOpenChange={() => toggleSetExpanded(setName)}
              className="border rounded-lg"
            >
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    {expandedSets[setName] ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    <span className="font-medium">{setName}</span>
                    <span className="text-sm text-muted-foreground">
                      ({setConfig.levels?.length || 0} levels)
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTopLevelSet(setName);
                    }}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-3 pt-0">
                {renderLevelTable(
                  setConfig.levels || [],
                  (levelIndex, field, value) => handleSetLevelChange(setName, levelIndex, field, value),
                  (levelIndex) => handleRemoveSetLevel(setName, levelIndex),
                  () => handleAddSetLevel(setName)
                )}
              </CollapsibleContent>
            </Collapsible>
          ))}

          {Object.keys(config.topLevelSets).length === 0 && (
            <p className="text-sm text-muted-foreground italic py-2">
              No custom sets configured. Add a set above to override naming for specific top-level prompts.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
