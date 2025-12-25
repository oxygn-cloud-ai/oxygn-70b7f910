/**
 * ActionNodeSettings
 * 
 * Settings panel for action nodes.
 * Shows post-action selector, configuration, library prompt picker, and extracted variables.
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Braces, 
  GitBranch, 
  LayoutTemplate,
  Info,
  Zap,
} from 'lucide-react';
import { 
  getEnabledActionTypes, 
  getActionType, 
  getDefaultActionConfig,
  ACTION_CATEGORIES,
} from '@/config/actionTypes';
import ActionConfigRenderer from './ActionConfigRenderer';

// Icon mapping for action types
const iconMap = {
  GitBranch: GitBranch,
  Braces: Braces,
  LayoutTemplate: LayoutTemplate,
  Play: Play,
};

const ActionNodeSettings = ({ 
  localData, 
  handleChange, 
  handleSave,
}) => {
  const enabledActions = getEnabledActionTypes();
  const selectedAction = getActionType(localData.post_action);
  const currentConfig = localData.post_action_config || {};

  // Group actions by category
  const groupedActions = enabledActions.reduce((acc, action) => {
    const categoryId = action.category || 'other';
    if (!acc[categoryId]) {
      acc[categoryId] = [];
    }
    acc[categoryId].push(action);
    return acc;
  }, {});

  const handleActionChange = (actionId) => {
    const newActionId = actionId === '_none' ? null : actionId;
    handleChange('post_action', newActionId);
    
    // Reset config to defaults for new action
    if (newActionId) {
      const defaultConfig = getDefaultActionConfig(newActionId);
      handleChange('post_action_config', defaultConfig);
      handleSave('post_action', newActionId);
      handleSave('post_action_config', defaultConfig);
    } else {
      handleChange('post_action_config', null);
      handleSave('post_action', null);
      handleSave('post_action_config', null);
    }
  };

  const handleConfigChange = (newConfig) => {
    handleChange('post_action_config', newConfig);
    handleSave('post_action_config', newConfig);
  };

  const renderActionIcon = (iconName) => {
    const IconComponent = iconMap[iconName] || Zap;
    return <IconComponent className="h-4 w-4" />;
  };

  return (
    <div className="space-y-4">
      {/* Post-Action Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Play className="h-4 w-4" />
            Post-Action
          </CardTitle>
          <CardDescription className="text-xs">
            Choose what happens after the AI responds with JSON.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={localData.post_action || '_none'}
            onValueChange={handleActionChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an action..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">None</span>
                </div>
              </SelectItem>
              
              {Object.entries(groupedActions).map(([categoryId, actions]) => {
                const category = ACTION_CATEGORIES[categoryId];
                return (
                  <React.Fragment key={categoryId}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {category?.name || categoryId}
                    </div>
                    {actions.map((action) => (
                      <SelectItem key={action.id} value={action.id}>
                        <div className="flex items-center gap-2">
                          {renderActionIcon(action.icon)}
                          <span>{action.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </React.Fragment>
                );
              })}
            </SelectContent>
          </Select>

          {selectedAction && (
            <p className="text-xs text-muted-foreground">
              {selectedAction.description}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Action Configuration */}
      {selectedAction && selectedAction.configSchema?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              {renderActionIcon(selectedAction.icon)}
              {selectedAction.name} Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionConfigRenderer
              schema={selectedAction.configSchema}
              config={currentConfig}
              onChange={handleConfigChange}
            />
          </CardContent>
        </Card>
      )}

      {/* Extracted Variables Display (Read-only) */}
      {localData.extracted_variables && Object.keys(localData.extracted_variables).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Braces className="h-4 w-4" />
              Extracted Variables
            </CardTitle>
            <CardDescription className="text-xs">
              Variables from the last AI response. Access with{' '}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">
                {'{{q.nodename.key}}'}
              </code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Object.entries(localData.extracted_variables).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2 text-xs">
                  <Badge variant="outline" className="font-mono shrink-0">
                    {key}
                  </Badge>
                  <span className="text-muted-foreground truncate">
                    {typeof value === 'object' 
                      ? JSON.stringify(value).substring(0, 50) + '...' 
                      : String(value).substring(0, 50)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info about JSON mode */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Action nodes automatically request JSON responses from the AI. 
          Make sure your prompts instruct the AI to return valid JSON.
        </p>
      </div>
    </div>
  );
};

export default ActionNodeSettings;
