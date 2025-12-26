/**
 * ActionNodeSettings
 * 
 * Settings panel for action nodes.
 * Shows JSON schema template picker, post-action selector, configuration, and extracted variables.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Play, 
  Braces, 
  GitBranch, 
  LayoutTemplate,
  Info,
  Zap,
  ChevronDown,
  FileJson,
  Sparkles,
} from 'lucide-react';
import { 
  getEnabledActionTypes, 
  getActionType, 
  getDefaultActionConfig,
  ACTION_CATEGORIES,
} from '@/config/actionTypes';
import { DEFAULT_SCHEMAS } from '@/config/defaultSchemas';
import ActionConfigRenderer from './ActionConfigRenderer';
import { useJsonSchemaTemplates } from '@/hooks/useJsonSchemaTemplates';

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
  supabase,
}) => {
  const enabledActions = getEnabledActionTypes();
  const selectedAction = getActionType(localData.post_action);
  const currentConfig = localData.post_action_config || {};
  const [schemaSource, setSchemaSource] = useState('template'); // 'template' | 'custom'
  const [customSchema, setCustomSchema] = useState('');
  const [schemaError, setSchemaError] = useState('');
  const [isSchemaOpen, setIsSchemaOpen] = useState(true);
  
  const { templates, isLoading: templatesLoading } = useJsonSchemaTemplates(supabase);

  // Parse current response_format to determine source
  useEffect(() => {
    if (localData.response_format) {
      try {
        const format = typeof localData.response_format === 'string' 
          ? JSON.parse(localData.response_format) 
          : localData.response_format;
        
        // Check if it matches a template
        if (format.json_schema?.schema) {
          const schemaStr = JSON.stringify(format.json_schema.schema, null, 2);
          setCustomSchema(schemaStr);
          
          // Check if matches a saved template
          const matchingTemplate = templates.find(t => 
            JSON.stringify(t.json_schema) === JSON.stringify(format.json_schema.schema)
          );
          
          if (matchingTemplate) {
            setSchemaSource('template');
          } else {
            // Check default schemas
            const matchingDefault = DEFAULT_SCHEMAS.find(d =>
              JSON.stringify(d.schema) === JSON.stringify(format.json_schema.schema)
            );
            if (!matchingDefault) {
              setSchemaSource('custom');
            }
          }
        }
      } catch {
        setCustomSchema('');
      }
    }
  }, [localData.response_format, templates]);

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

  const handleSchemaTemplateChange = (templateId) => {
    if (templateId === '_custom') {
      setSchemaSource('custom');
      return;
    }

    setSchemaSource('template');
    setSchemaError('');

    // Find schema from templates or defaults
    let schema = null;
    let schemaName = 'action_response';

    // Check default schemas first
    const defaultSchema = DEFAULT_SCHEMAS.find(d => d.id === templateId);
    if (defaultSchema) {
      schema = defaultSchema.schema;
      schemaName = defaultSchema.id;
    } else {
      // Check saved templates
      const template = templates.find(t => t.row_id === templateId);
      if (template) {
        schema = template.json_schema;
        schemaName = template.schema_name.toLowerCase().replace(/\s+/g, '_');
      }
    }

    if (schema) {
      const responseFormat = {
        type: 'json_schema',
        json_schema: {
          name: schemaName,
          schema: schema,
          strict: true,
        },
      };

      handleChange('response_format', JSON.stringify(responseFormat));
      handleSave('response_format', JSON.stringify(responseFormat));
      setCustomSchema(JSON.stringify(schema, null, 2));
    }
  };

  const handleCustomSchemaChange = (value) => {
    setCustomSchema(value);
    setSchemaError('');

    try {
      const schema = JSON.parse(value);
      const responseFormat = {
        type: 'json_schema',
        json_schema: {
          name: 'custom_response',
          schema: schema,
          strict: true,
        },
      };

      handleChange('response_format', JSON.stringify(responseFormat));
      handleSave('response_format', JSON.stringify(responseFormat));
    } catch (err) {
      setSchemaError('Invalid JSON');
    }
  };

  const renderActionIcon = (iconName) => {
    const IconComponent = iconMap[iconName] || Zap;
    return <IconComponent className="h-4 w-4" />;
  };

  // Get current template ID from response_format
  const getCurrentTemplateId = () => {
    if (schemaSource === 'custom') return '_custom';
    
    try {
      const format = typeof localData.response_format === 'string'
        ? JSON.parse(localData.response_format)
        : localData.response_format;
      
      if (format?.json_schema?.schema) {
        // Check default schemas
        const matchingDefault = DEFAULT_SCHEMAS.find(d =>
          JSON.stringify(d.schema) === JSON.stringify(format.json_schema.schema)
        );
        if (matchingDefault) return matchingDefault.id;

        // Check saved templates
        const matchingTemplate = templates.find(t =>
          JSON.stringify(t.json_schema) === JSON.stringify(format.json_schema.schema)
        );
        if (matchingTemplate) return matchingTemplate.row_id;
      }
    } catch {
      // ignore
    }
    
    return '_custom';
  };

  return (
    <div className="space-y-4">
      {/* JSON Schema Configuration */}
      <Card>
        <Collapsible open={isSchemaOpen} onOpenChange={setIsSchemaOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="text-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileJson className="h-4 w-4" />
                  JSON Schema
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${isSchemaOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
              <CardDescription className="text-xs">
                Define the expected JSON structure for the AI response.
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Schema Source Selector */}
              <div className="space-y-2">
                <Label className="text-xs">Schema Source</Label>
                <Select
                  value={getCurrentTemplateId()}
                  onValueChange={handleSchemaTemplateChange}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select a schema..." />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Default Schemas */}
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Built-in Schemas
                    </div>
                    {DEFAULT_SCHEMAS.map((schema) => (
                      <SelectItem key={schema.id} value={schema.id}>
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-3 w-3 text-primary" />
                          <span>{schema.name}</span>
                        </div>
                      </SelectItem>
                    ))}

                    {/* Saved Templates */}
                    {templates.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-1">
                          Saved Templates
                        </div>
                        {templates.map((template) => (
                          <SelectItem key={template.row_id} value={template.row_id}>
                            <div className="flex items-center gap-2">
                              <LayoutTemplate className="h-3 w-3" />
                              <span>{template.schema_name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    )}

                    {/* Custom Option */}
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-1">
                      Other
                    </div>
                    <SelectItem value="_custom">
                      <div className="flex items-center gap-2">
                        <Braces className="h-3 w-3" />
                        <span>Custom Schema</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Schema Editor */}
              {schemaSource === 'custom' && (
                <div className="space-y-2">
                  <Label className="text-xs">Custom JSON Schema</Label>
                  <Textarea
                    value={customSchema}
                    onChange={(e) => handleCustomSchemaChange(e.target.value)}
                    placeholder='{"type": "object", "properties": {...}}'
                    className="font-mono text-xs min-h-[120px]"
                  />
                  {schemaError && (
                    <p className="text-xs text-destructive">{schemaError}</p>
                  )}
                </div>
              )}

              {/* Schema Preview */}
              {schemaSource === 'template' && customSchema && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Schema Preview</Label>
                  <pre className="text-xs bg-muted/50 p-2 rounded-md overflow-auto max-h-32 font-mono">
                    {customSchema}
                  </pre>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

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
          Action nodes use structured outputs to ensure the AI returns valid JSON matching your schema.
        </p>
      </div>
    </div>
  );
};

export default ActionNodeSettings;