/**
 * ActionNodeSettings
 * 
 * Settings panel for action nodes.
 * Shows JSON schema template picker, post-action selector, configuration, and extracted variables.
 * Supports full template auto-configuration including model settings and action config.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  Settings2,
  ListTree,
} from 'lucide-react';
import { 
  getEnabledActionTypes, 
  getActionType, 
  getDefaultActionConfig,
  ACTION_CATEGORIES,
} from '@/config/actionTypes';
import { DEFAULT_SCHEMAS, getDefaultSchemaById, getFullTemplateSchemas } from '@/config/defaultSchemas';
import { applyTemplateToPrompt, isFullTemplate } from '@/services/templateService';
import ActionConfigRenderer from './ActionConfigRenderer';
import { useJsonSchemaTemplates } from '@/hooks/useJsonSchemaTemplates';

// Icon mapping for action types
const iconMap = {
  GitBranch: GitBranch,
  Braces: Braces,
  LayoutTemplate: LayoutTemplate,
  Play: Play,
  ListTree: ListTree,
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

  // Parse current response_format to get the actual schema object
  const currentSchemaObject = useMemo(() => {
    if (!localData.response_format) return null;
    try {
      const format = typeof localData.response_format === 'string' 
        ? JSON.parse(localData.response_format) 
        : localData.response_format;
      return format?.json_schema?.schema || null;
    } catch {
      return null;
    }
  }, [localData.response_format]);

  // Separate full templates from schema-only templates
  const fullTemplates = useMemo(() => getFullTemplateSchemas(), []);
  const schemaOnlyTemplates = useMemo(() => 
    DEFAULT_SCHEMAS.filter(s => !s.nodeConfig || !s.actionConfig), 
    []
  );

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

    // Check default schemas first (including full templates)
    const defaultSchema = DEFAULT_SCHEMAS.find(d => d.id === templateId);
    
    if (defaultSchema) {
      // Check if this is a full template with auto-configuration
      if (isFullTemplate(defaultSchema)) {
        // Apply full template configuration
        const updates = applyTemplateToPrompt(defaultSchema, localData);
        
        // Apply all updates
        Object.entries(updates).forEach(([key, value]) => {
          handleChange(key, value);
          handleSave(key, value);
        });
        
        setCustomSchema(JSON.stringify(defaultSchema.schema, null, 2));
        return;
      }
      
      // Regular schema-only template
      const responseFormat = {
        type: 'json_schema',
        json_schema: {
          name: defaultSchema.id,
          schema: defaultSchema.schema,
          strict: true,
        },
      };

      handleChange('response_format', JSON.stringify(responseFormat));
      handleSave('response_format', JSON.stringify(responseFormat));
      setCustomSchema(JSON.stringify(defaultSchema.schema, null, 2));
      return;
    }

    // Check saved templates
    const template = templates.find(t => t.row_id === templateId);
    if (template) {
      // Check if saved template has full configuration
      if (template.model_config || template.node_config || template.action_config) {
        const fullTemplate = {
          schema: template.json_schema,
          modelConfig: template.model_config,
          nodeConfig: template.node_config,
          childCreation: template.child_creation,
          actionConfig: template.action_config,
          systemPromptTemplate: template.system_prompt_template,
        };
        
        const updates = applyTemplateToPrompt(fullTemplate, localData);
        Object.entries(updates).forEach(([key, value]) => {
          handleChange(key, value);
          handleSave(key, value);
        });
        
        setCustomSchema(JSON.stringify(template.json_schema, null, 2));
        return;
      }

      // Regular saved schema template
      const schemaName = template.schema_name.toLowerCase().replace(/\s+/g, '_');
      const responseFormat = {
        type: 'json_schema',
        json_schema: {
          name: schemaName,
          schema: template.json_schema,
          strict: true,
        },
      };

      handleChange('response_format', JSON.stringify(responseFormat));
      handleSave('response_format', JSON.stringify(responseFormat));
      setCustomSchema(JSON.stringify(template.json_schema, null, 2));
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
      <Card className="bg-surface-container-low border-outline-variant">
        <Collapsible open={isSchemaOpen} onOpenChange={setIsSchemaOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-surface-container transition-colors">
              <CardTitle className="text-title-sm flex items-center justify-between text-on-surface">
                <div className="flex items-center gap-2">
                  <FileJson className="h-4 w-4 text-on-surface-variant" />
                  JSON Schema
                </div>
                <ChevronDown className={`h-4 w-4 text-on-surface-variant transition-transform ${isSchemaOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
              <CardDescription className="text-[10px] text-on-surface-variant">
                Define the expected JSON structure for the AI response.
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Schema Source Selector */}
              <div className="space-y-2">
                <Label className="text-label-sm text-on-surface-variant">Schema Source</Label>
                <Select
                  value={getCurrentTemplateId()}
                  onValueChange={handleSchemaTemplateChange}
                >
                  <SelectTrigger className="h-8 text-body-sm">
                    <SelectValue placeholder="Select a schema..." />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Full Templates (with auto-config) */}
                    {fullTemplates.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-label-sm font-semibold text-on-surface-variant flex items-center gap-1">
                          <Settings2 className="h-3 w-3" />
                          Full Templates (Auto-Configure)
                        </div>
                        {fullTemplates.map((schema) => (
                          <SelectItem key={schema.id} value={schema.id}>
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-3 w-3 text-primary" />
                              <span>{schema.name}</span>
                              <Badge variant="outline" className="text-[9px] px-1">
                                {schema.nodeConfig?.post_action?.replace('create_children_', '')}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    )}

                    {/* Schema-Only Defaults */}
                    <div className="px-2 py-1.5 text-label-sm font-semibold text-on-surface-variant mt-1">
                      Built-in Schemas
                    </div>
                    {schemaOnlyTemplates.map((schema) => (
                      <SelectItem key={schema.id} value={schema.id}>
                        <div className="flex items-center gap-2">
                          <Braces className="h-3 w-3 text-on-surface-variant" />
                          <span>{schema.name}</span>
                        </div>
                      </SelectItem>
                    ))}

                    {/* Saved Templates */}
                    {templates.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-label-sm font-semibold text-on-surface-variant mt-1">
                          Saved Templates
                        </div>
                        {templates.map((template) => (
                          <SelectItem key={template.row_id} value={template.row_id}>
                            <div className="flex items-center gap-2">
                              <LayoutTemplate className="h-3 w-3" />
                              <span>{template.schema_name}</span>
                              {(template.model_config || template.action_config) && (
                                <Badge variant="outline" className="text-[9px] px-1">full</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    )}

                    {/* Custom Option */}
                    <div className="px-2 py-1.5 text-label-sm font-semibold text-on-surface-variant mt-1">
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
                  <Label className="text-label-sm text-on-surface-variant">Custom JSON Schema</Label>
                  <Textarea
                    value={customSchema}
                    onChange={(e) => handleCustomSchemaChange(e.target.value)}
                    placeholder='{"type": "object", "properties": {...}}'
                    className="font-mono text-body-sm min-h-[120px] bg-surface-container"
                  />
                  {schemaError && (
                    <p className="text-[10px] text-red-500">{schemaError}</p>
                  )}
                </div>
              )}

              {/* Schema Preview */}
              {schemaSource === 'template' && customSchema && (
                <div className="space-y-2">
                  <Label className="text-label-sm text-on-surface-variant">Schema Preview</Label>
                  <pre className="text-[10px] bg-surface-container p-2 rounded-m3-sm overflow-auto max-h-32 font-mono text-on-surface-variant">
                    {customSchema}
                  </pre>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Post-Action Selector */}
      <Card className="bg-surface-container-low border-outline-variant">
        <CardHeader className="pb-3">
          <CardTitle className="text-title-sm flex items-center gap-2 text-on-surface">
            <Play className="h-4 w-4 text-on-surface-variant" />
            Post-Action
          </CardTitle>
          <CardDescription className="text-[10px] text-on-surface-variant">
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
                  <span className="text-on-surface-variant">None</span>
                </div>
              </SelectItem>
              
              {Object.entries(groupedActions).map(([categoryId, actions]) => {
                const category = ACTION_CATEGORIES[categoryId];
                return (
                  <React.Fragment key={categoryId}>
                    <div className="px-2 py-1.5 text-label-sm font-semibold text-on-surface-variant">
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
            <p className="text-[10px] text-on-surface-variant">
              {selectedAction.description}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Action Configuration */}
      {selectedAction && selectedAction.configSchema?.length > 0 && (
        <Card className="bg-surface-container-low border-outline-variant">
          <CardHeader className="pb-3">
            <CardTitle className="text-title-sm flex items-center gap-2 text-on-surface">
              {renderActionIcon(selectedAction.icon)}
              {selectedAction.name} Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionConfigRenderer
              schema={selectedAction.configSchema}
              config={currentConfig}
              onChange={handleConfigChange}
              currentSchema={currentSchemaObject}
            />
          </CardContent>
        </Card>
      )}

      {/* Extracted Variables Display (Read-only) */}
      {localData.extracted_variables && Object.keys(localData.extracted_variables).length > 0 && (
        <Card className="bg-surface-container-low border-outline-variant">
          <CardHeader className="pb-3">
            <CardTitle className="text-title-sm flex items-center gap-2 text-on-surface">
              <Braces className="h-4 w-4 text-on-surface-variant" />
              Extracted Variables
            </CardTitle>
            <CardDescription className="text-[10px] text-on-surface-variant">
              Variables from the last AI response. Access with{' '}
              <code className="bg-surface-container px-1 py-0.5 rounded text-[10px]">
                {'{{q.nodename.key}}'}
              </code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Object.entries(localData.extracted_variables).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2 text-body-sm">
                  <Badge variant="outline" className="font-mono shrink-0 text-[10px]">
                    {key}
                  </Badge>
                  <span className="text-on-surface-variant truncate text-[10px]">
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
      <div className="flex items-start gap-2 p-3 rounded-m3-sm bg-surface-container text-[10px] text-on-surface-variant">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Action nodes use structured outputs to ensure the AI returns valid JSON matching your schema.
          Full templates auto-configure both schema and action settings.
        </p>
      </div>
    </div>
  );
};

export default ActionNodeSettings;