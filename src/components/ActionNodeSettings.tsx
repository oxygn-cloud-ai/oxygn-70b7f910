import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  ChevronDown, ChevronRight, Info, Settings2, Zap, Variable, 
  FileJson, List, SplitSquareHorizontal, LayoutTemplate, AlertCircle,
  CheckCircle2, Code, X, Plus, HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACTION_TYPES, ActionType, ActionConfig, validateActionConfig } from '@/config/actionTypes';
import ActionConfigRenderer from './ActionConfigRenderer';

interface ActionNodeSettingsProps {
  config: ActionConfig | null;
  actionId: string | null;
  onChange: (actionId: string | null, config: ActionConfig | null) => void;
  promptRowId?: string;
  nodeType?: string;
}

const ActionNodeSettings: React.FC<ActionNodeSettingsProps> = ({
  config,
  actionId,
  onChange,
  promptRowId,
  nodeType = 'standard'
}) => {
  const [isOpen, setIsOpen] = useState(!!actionId);
  const [localConfig, setLocalConfig] = useState<ActionConfig | null>(config);
  const [localActionId, setLocalActionId] = useState<string | null>(actionId);

  // Sync local state with props
  useEffect(() => {
    setLocalConfig(config);
    setLocalActionId(actionId);
  }, [config, actionId]);

  // Get available action types based on node type
  const availableActions = useMemo(() => {
    return Object.entries(ACTION_TYPES).filter(([_, action]) => {
      // All actions available for standard nodes
      if (nodeType === 'standard') return true;
      // Question nodes might have limited actions
      if (nodeType === 'question') return action.category === 'output';
      return true;
    });
  }, [nodeType]);

  // Get the selected action type info
  const selectedAction = useMemo(() => {
    if (!localActionId) return null;
    return ACTION_TYPES[localActionId] || null;
  }, [localActionId]);

  // Validate current configuration
  const validationResult = useMemo(() => {
    if (!localActionId || !localConfig) {
      return { valid: true, errors: [] };
    }
    return validateActionConfig(localActionId, localConfig);
  }, [localActionId, localConfig]);

  const handleActionChange = useCallback((newActionId: string | null) => {
    if (newActionId === '__none__' || !newActionId) {
      setLocalActionId(null);
      setLocalConfig(null);
      onChange(null, null);
      return;
    }

    const action = ACTION_TYPES[newActionId];
    if (!action) return;

    // Initialize with default config
    const defaultConfig: ActionConfig = {};
    if (action.configFields) {
      action.configFields.forEach(field => {
        if (field.defaultValue !== undefined) {
          defaultConfig[field.key] = field.defaultValue;
        }
      });
    }

    setLocalActionId(newActionId);
    setLocalConfig(defaultConfig);
    onChange(newActionId, defaultConfig);
  }, [onChange]);

  const handleConfigChange = useCallback((key: string, value: unknown) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    onChange(localActionId, newConfig);
  }, [localConfig, localActionId, onChange]);

  const getActionIcon = (actionType: ActionType) => {
    switch (actionType.icon) {
      case 'file-json': return FileJson;
      case 'list': return List;
      case 'split': return SplitSquareHorizontal;
      case 'template': return LayoutTemplate;
      default: return Zap;
    }
  };

  return (
    <TooltipProvider>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="border-border/50">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-2 px-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Zap className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-medium">Post-Actions</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {localActionId && selectedAction && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      {React.createElement(getActionIcon(selectedAction), { className: "h-3 w-3" })}
                      {selectedAction.label}
                    </Badge>
                  )}
                  {!validationResult.valid && (
                    <Tooltip>
                      <TooltipTrigger>
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Configuration has errors</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0 pb-3 px-3 space-y-3">
              {/* Action Type Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Action Type</Label>
                <Select
                  value={localActionId || '__none__'}
                  onValueChange={handleActionChange}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select an action..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-xs">
                      <span className="text-muted-foreground">No action</span>
                    </SelectItem>
                    {availableActions.map(([id, action]) => {
                      const Icon = getActionIcon(action);
                      return (
                        <SelectItem key={id} value={id} className="text-xs">
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{action.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Description */}
              {selectedAction && (
                <div className="flex items-start gap-2 p-2 bg-muted/30 rounded-md">
                  <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    {selectedAction.description}
                  </p>
                </div>
              )}

              {/* Action Configuration */}
              {selectedAction && selectedAction.configFields && (
                <div className="space-y-3 pt-2 border-t border-border/50">
                  <ActionConfigRenderer
                    action={selectedAction}
                    config={localConfig || {}}
                    onChange={handleConfigChange}
                    promptRowId={promptRowId}
                  />
                </div>
              )}

              {/* Validation Errors */}
              {!validationResult.valid && validationResult.errors.length > 0 && (
                <div className="space-y-1 pt-2">
                  {validationResult.errors.map((error, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-destructive">
                      <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span className="text-[10px]">{error}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Help Text */}
              {!localActionId && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span className="text-[10px]">
                    Post-actions run automatically after this prompt completes.
                  </span>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </TooltipProvider>
  );
};

export default ActionNodeSettings;
