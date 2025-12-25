import React from 'react';
import { useOpenAIModels } from '../../hooks/useOpenAIModels';
import { useProjectData } from '../../hooks/useProjectData';
import SettingsPanel from '../SettingsPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SkipForward, Upload, Zap, MessageSquare } from 'lucide-react';
import ActionNodeSettings from '../ActionNodeSettings';

const SettingsTab = ({ selectedItemData, projectRowId }) => {
  const { models } = useOpenAIModels();
  
  const {
    localData,
    handleChange,
    handleSave,
    handleReset,
    hasUnsavedChanges
  } = useProjectData(selectedItemData, projectRowId);

  const handleExcludeFromCascadeChange = (checked) => {
    handleChange('exclude_from_cascade', checked);
    handleSave('exclude_from_cascade', checked);
  };

  const handleExcludeFromExportChange = (checked) => {
    handleChange('exclude_from_export', checked);
    handleSave('exclude_from_export', checked);
  };

  const handleNodeTypeChange = (value) => {
    handleChange('node_type', value);
    handleSave('node_type', value);
    
    // Auto-enable JSON mode for action nodes
    if (value === 'action') {
      handleChange('response_format', 'json_object');
      handleChange('response_format_on', true);
      handleSave('response_format', 'json_object');
      handleSave('response_format_on', true);
    }
  };

  const isActionNode = localData.node_type === 'action';

  return (
    <div className="space-y-4">
      {/* Node Type Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Node Type
          </CardTitle>
          <CardDescription className="text-xs">
            Choose how this node behaves during execution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select 
            value={localData.node_type || 'standard'}
            onValueChange={handleNodeTypeChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select node type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Standard
                </div>
              </SelectItem>
              <SelectItem value="action">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Action
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          {isActionNode && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              Action nodes automatically request JSON responses from the AI.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Action Node Settings (only shown for action nodes) */}
      {isActionNode && (
        <ActionNodeSettings
          localData={localData}
          handleChange={handleChange}
          handleSave={handleSave}
        />
      )}

      {/* Cascade Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <SkipForward className="h-4 w-4" />
            Cascade Settings
          </CardTitle>
          <CardDescription className="text-xs">
            Control how this prompt behaves during cascade runs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="exclude-cascade" className="text-sm font-medium">
                Exclude from cascade
              </Label>
              <p className="text-xs text-muted-foreground">
                Skip this prompt when running a cascade
              </p>
            </div>
            <Switch
              id="exclude-cascade"
              checked={localData.exclude_from_cascade || false}
              onCheckedChange={handleExcludeFromCascadeChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Export Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Export Settings
          </CardTitle>
          <CardDescription className="text-xs">
            Control how this prompt behaves during exports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="exclude-export" className="text-sm font-medium">
                Exclude from export
              </Label>
              <p className="text-xs text-muted-foreground">
                Skip this prompt when exporting to Confluence or other destinations
              </p>
            </div>
            <Switch
              id="exclude-export"
              checked={localData.exclude_from_export || false}
              onCheckedChange={handleExcludeFromExportChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* AI Model Settings */}
      <div className="mb-4">
        <h3 className="text-lg font-medium">AI Model Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure the AI model and parameters for this prompt.
        </p>
      </div>
      
      <SettingsPanel
        localData={localData}
        selectedItemData={selectedItemData}
        models={models}
        handleChange={handleChange}
        handleSave={handleSave}
        handleReset={handleReset}
        hasUnsavedChanges={hasUnsavedChanges}
      />
    </div>
  );
};

export default SettingsTab;
