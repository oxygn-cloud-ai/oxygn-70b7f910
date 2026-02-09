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
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ResizablePromptArea } from '@/components/shared';
import { 
  Play, 
  Info,
  Zap,
  ChevronDown,
  FileJson,
  Sparkles,
  Settings2,
  AlertTriangle,
  Bug,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { 
  getEnabledActionTypes, 
  getActionType, 
  getDefaultActionConfig,
  ACTION_CATEGORIES,
} from '@/config/actionTypes';
import { applyTemplateToPrompt } from '@/services/templateService';
import { 
  isFullTemplate, 
  ensureStrictCompliance, 
  schemaWasModified,
  validateSchemaForAction,
  getArrayPathStrings,
} from '@/utils/schemaUtils';
import { parseJson } from '@/utils/jsonSchemaValidator';
import ActionConfigRenderer from './ActionConfigRenderer';
import { useJsonSchemaTemplates } from '@/hooks/useJsonSchemaTemplates';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { SupabaseClient } from '@supabase/supabase-js';

// Database types
type JsonSchemaTemplateRow = Database['public']['Tables']['q_json_schema_templates']['Row'];

// Type definitions

// Type definitions
interface VariableAssignmentsConfig {
  enabled?: boolean;
  json_path?: string;
  auto_create_variables?: boolean;
}

interface LastActionResult {
  status: 'success' | 'error';
  executed_at: string;
  created_count?: number;
  message?: string;
  error?: string;
  available_arrays?: string[];
}

interface LocalData {
  post_action?: string | null;
  post_action_config?: Record<string, unknown> | null;
  response_format?: string | Record<string, unknown> | null;
  json_schema_template_id?: string | null;
  auto_run_children?: boolean;
  variable_assignments_config?: VariableAssignmentsConfig | null;
  extracted_variables?: Record<string, unknown> | null;
  last_action_result?: LastActionResult | null;
  [key: string]: unknown;
}

interface ActionType {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category?: string;
  configSchema?: Array<{
    key: string;
    label: string;
    type: string;
    required?: boolean;
    helpText?: string;
    placeholder?: string;
    defaultValue?: unknown;
    options?: (string | { value: string; label: string })[];
    min?: number;
    max?: number;
  }>;
}

interface ActionCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

interface ActionNodeSettingsProps {
  localData: LocalData;
  handleChange: (key: string, value: unknown) => void;
  handleSave: (key: string, value: unknown) => void;
  supabase?: SupabaseClient;
}

const ActionNodeSettings: React.FC<ActionNodeSettingsProps> = ({ 
  localData, 
  handleChange, 
  handleSave,
}) => {
  const enabledActions = getEnabledActionTypes() as ActionType[];
  const selectedAction = getActionType(localData.post_action) as ActionType | undefined;
  const currentConfig = (localData.post_action_config || {}) as Record<string, unknown>;
  const [schemaSource, setSchemaSource] = useState<'template' | 'custom'>('template');
  const [customSchema, setCustomSchema] = useState('');
  const [schemaError, setSchemaError] = useState('');
  const [isSchemaOpen, setIsSchemaOpen] = useState(true);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  
  const { templates, isLoading: templatesLoading } = useJsonSchemaTemplates();

  // Parse current response_format to get the actual schema object
  const currentSchemaObject = useMemo(() => {
    if (!localData.response_format) return null;
    let format = localData.response_format;
    if (typeof format === 'string') {
      const result = parseJson(format);
      if (!result.isValid) return null;
      format = result.data as Record<string, unknown>;
    }
    const formatObj = format as Record<string, unknown>;
    const jsonSchema = formatObj?.json_schema as Record<string, unknown> | undefined;
    return (jsonSchema?.schema as Record<string, unknown>) || null;
  }, [localData.response_format]);

  // Validate schema against selected action type
  const schemaValidation = useMemo(() => {
    if (!currentSchemaObject || !localData.post_action) {
      return { isValid: true, warnings: [] as string[], suggestions: [] as string[], arrayPaths: [] as string[] };
    }
    return validateSchemaForAction(currentSchemaObject, localData.post_action, currentConfig);
  }, [currentSchemaObject, localData.post_action, currentConfig]);

  // Validate create_children_json has required config fields
  const configValidation = useMemo(() => {
    if (localData.post_action === 'create_children_json') {
      const config = (localData.post_action_config || {}) as Record<string, unknown>;
      const issues: string[] = [];
      
      if (!config.json_path) {
        issues.push('Missing json_path - specify which array contains children');
      }
      if (!config.name_field) {
        issues.push('Missing name_field - child names will use default');
      }
      if (!config.content_field) {
        issues.push('Missing content_field - child content will use default');
      }
      
      return { hasIssues: issues.length > 0, issues };
    }
    return { hasIssues: false, issues: [] as string[] };
  }, [localData.post_action, localData.post_action_config]);

  // Find array paths in current schema for suggestions (as strings)
  const availableArrayPaths = useMemo(() => {
    if (!currentSchemaObject) return [] as string[];
    return getArrayPathStrings(currentSchemaObject);
  }, [currentSchemaObject]);

  // Auto-populate json_path when there's exactly one array in the schema
  useEffect(() => {
    const needsJsonPath = localData.post_action === 'create_children_json';
    if (!needsJsonPath) return;

    const isTemplateComplete = currentConfig?.name_field || currentConfig?.content_field;
    if (isTemplateComplete) return;

    const currentJsonPath = currentConfig?.json_path as string | undefined;
    const hasValidPath = currentJsonPath && typeof currentJsonPath === 'string' && availableArrayPaths.includes(currentJsonPath);

    if (availableArrayPaths.length === 1 && !hasValidPath) {
      const autoPath = availableArrayPaths[0];
      if (typeof autoPath === 'string') {
        const newConfig = { ...currentConfig, json_path: autoPath };
        handleChange('post_action_config', newConfig);
        handleSave('post_action_config', newConfig);
      }
    }
  }, [availableArrayPaths, localData.post_action, currentConfig, handleChange, handleSave]);

  // Separate full templates from schema-only templates
  const fullTemplates = useMemo(() => 
    (templates as JsonSchemaTemplateRow[]).filter(t => t.node_config && t.action_config), 
    [templates]
  );
  const schemaOnlyTemplates = useMemo(() => 
    (templates as JsonSchemaTemplateRow[]).filter(t => !t.node_config || !t.action_config), 
    [templates]
  );

  // Parse current response_format to determine source
  useEffect(() => {
    if (localData.response_format) {
      let format = localData.response_format;
      if (typeof format === 'string') {
        const result = parseJson(format);
        if (!result.isValid) {
          setCustomSchema('');
          return;
        }
        format = result.data as Record<string, unknown>;
      }
      
      const formatObj = format as Record<string, unknown>;
      const jsonSchema = formatObj?.json_schema as Record<string, unknown> | undefined;
      
      if (jsonSchema?.schema) {
        const schemaStr = JSON.stringify(jsonSchema.schema, null, 2);
        setCustomSchema(schemaStr);
        
        const matchingTemplate = (templates as JsonSchemaTemplateRow[]).find(t => 
          JSON.stringify(t.json_schema) === JSON.stringify(jsonSchema.schema)
        );
        
        if (matchingTemplate) {
          setSchemaSource('template');
        } else {
          setSchemaSource('custom');
        }
      }
    }
  }, [localData.response_format, templates]);

  // Group actions by category
  const groupedActions = useMemo(() => {
    return enabledActions.reduce<Record<string, ActionType[]>>((acc, action) => {
      const categoryId = action.category || 'other';
      if (!acc[categoryId]) {
        acc[categoryId] = [];
      }
      acc[categoryId].push(action);
      return acc;
    }, {});
  }, [enabledActions]);

  const handleActionChange = (actionId: string): void => {
    const newActionId = actionId === '_none' ? null : actionId;
    const actionChanged = newActionId !== localData.post_action;
    
    handleChange('post_action', newActionId);
    
    if (newActionId && actionChanged) {
      const defaultConfig = getDefaultActionConfig(newActionId);
      console.log('ActionNodeSettings: Switching to action', newActionId, 'with fresh config:', defaultConfig);
      handleChange('post_action_config', defaultConfig);
      handleSave('post_action', newActionId);
      handleSave('post_action_config', defaultConfig);
    } else if (!newActionId) {
      console.log('ActionNodeSettings: Clearing action and config');
      handleChange('post_action_config', null);
      handleSave('post_action', null);
      handleSave('post_action_config', null);
    } else {
      console.log('ActionNodeSettings: Same action selected, preserving config');
      handleSave('post_action', newActionId);
    }
  };

  const handleConfigChange = (newConfig: Record<string, unknown>): void => {
    handleChange('post_action_config', newConfig);
    handleSave('post_action_config', newConfig);
  };

  const handleSchemaTemplateChange = (templateId: string): void => {
    if (templateId === '_custom') {
      setSchemaSource('custom');
      handleChange('json_schema_template_id', null);
      handleSave('json_schema_template_id', null);
      return;
    }

    setSchemaSource('template');
    setSchemaError('');

    const template = (templates as JsonSchemaTemplateRow[]).find(t => t.row_id === templateId);
    if (template) {
      if (isFullTemplate(template)) {
        const fullTemplate = {
          id: template.row_id,
          schema: template.json_schema,
          modelConfig: template.model_config,
          nodeConfig: template.node_config,
          childCreation: template.child_creation,
          actionConfig: template.action_config,
          systemPromptTemplate: template.system_prompt_template,
        };
        
        const updates = applyTemplateToPrompt(fullTemplate, localData);
        console.log('ActionNodeSettings: Template applied, updates:', updates);
        
        Object.entries(updates).forEach(([key, value]) => {
          handleChange(key, value);
          handleSave(key, value);
        });
        
        handleChange('json_schema_template_id', templateId);
        handleSave('json_schema_template_id', templateId);
        
        setCustomSchema(JSON.stringify(template.json_schema, null, 2));
        return;
      }
      
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
      
      handleChange('json_schema_template_id', templateId);
      handleSave('json_schema_template_id', templateId);
      
      setCustomSchema(JSON.stringify(template.json_schema, null, 2));
    }
  };

  const handleCustomSchemaChange = (value: string): void => {
    setCustomSchema(value);
    setSchemaError('');

    try {
      let schema = JSON.parse(value);
      
      const fixedSchema = ensureStrictCompliance(schema);
      const wasModified = schemaWasModified(schema, fixedSchema);
      
      if (wasModified) {
        toast.info('Schema auto-fixed for strict mode compliance', {
          description: 'Added required fields and additionalProperties: false'
        });
        schema = fixedSchema;
        setCustomSchema(JSON.stringify(fixedSchema, null, 2));
      }
      
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
    } catch {
      setSchemaError('Invalid JSON');
    }
  };

  const getCurrentTemplateId = (): string => {
    if (schemaSource === 'custom') return '_custom';
    
    let format = localData.response_format;
    if (typeof format === 'string') {
      const result = parseJson(format);
      if (!result.isValid) return '_custom';
      format = result.data as Record<string, unknown>;
    }
    
    const formatObj = format as Record<string, unknown>;
    const jsonSchema = formatObj?.json_schema as Record<string, unknown> | undefined;
    
    if (jsonSchema?.schema) {
      const matchingTemplate = (templates as JsonSchemaTemplateRow[]).find(t =>
        JSON.stringify(t.json_schema) === JSON.stringify(jsonSchema.schema)
      );
      if (matchingTemplate) return matchingTemplate.row_id;
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
                  disabled={templatesLoading}
                >
                  <SelectTrigger className="h-8 text-body-sm">
                    <SelectValue placeholder={templatesLoading ? "Loading..." : "Select a schema..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 && !templatesLoading && (
                      <div className="px-2 py-4 text-center text-on-surface-variant text-body-sm">
                        No schemas available
                      </div>
                    )}

                    {/* Full Templates (with auto-config) */}
                    {fullTemplates.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-label-sm font-semibold text-on-surface-variant flex items-center gap-1">
                          <Settings2 className="h-3 w-3" />
                          Full Templates (Auto-Configure)
                        </div>
                        {fullTemplates.map((template) => (
                          <SelectItem key={template.row_id} value={template.row_id} textValue={template.schema_name}>
                            <span>{template.schema_name}</span>
                          </SelectItem>
                        ))}
                      </>
                    )}

                    {/* Schema-Only Templates */}
                    {schemaOnlyTemplates.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-label-sm font-semibold text-on-surface-variant mt-1">
                          Schema Templates
                        </div>
                        {schemaOnlyTemplates.map((template) => (
                          <SelectItem key={template.row_id} value={template.row_id} textValue={template.schema_name}>
                            <span>{template.schema_name}</span>
                          </SelectItem>
                        ))}
                      </>
                    )}

                    {/* Custom Option */}
                    <div className="px-2 py-1.5 text-label-sm font-semibold text-on-surface-variant mt-1">
                      Other
                    </div>
                    <SelectItem value="_custom" textValue="Custom Schema">
                      <span>Custom Schema</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Schema Editor */}
              {schemaSource === 'custom' && (
                <div className="space-y-2">
                  <ResizablePromptArea
                    label="Custom JSON Schema"
                    value={customSchema}
                    placeholder='{"type": "object", "properties": {...}}'
                    defaultHeight={120}
                    onSave={(value) => handleCustomSchemaChange(value)}
                    storageKey={`action-node-${localData.post_action || 'default'}-custom-schema`}
                  />
                  {schemaError && (
                    <p className="text-[10px] text-destructive">{schemaError}</p>
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
              <SelectItem value="_none" textValue="None">
                <span className="text-on-surface-variant">None</span>
              </SelectItem>
              
              {Object.entries(groupedActions).map(([categoryId, actions]) => {
                const category = (ACTION_CATEGORIES as Record<string, ActionCategory>)[categoryId];
                return (
                  <React.Fragment key={categoryId}>
                    <div className="px-2 py-1.5 text-label-sm font-semibold text-on-surface-variant">
                      {category?.name || categoryId}
                    </div>
                    {actions.map((action) => (
                      <SelectItem key={action.id} value={action.id} textValue={action.name}>
                        <span>{action.name}</span>
                      </SelectItem>
                    ))}
                  </React.Fragment>
                );
              })}
            </SelectContent>
          </Select>

          {selectedAction && (
            <div className="p-2 bg-surface-container rounded-m3-sm">
              <p className="text-[10px] text-on-surface-variant">
                {selectedAction.description}
              </p>
            </div>
          )}

          {/* Schema-Action Alignment Warning */}
          {schemaValidation.warnings.length > 0 && (
            <Alert variant="destructive" className="bg-amber-500/10 border-amber-500/30">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-[10px] text-on-surface space-y-1">
                {schemaValidation.warnings.map((warning, i) => (
                  <p key={i}>{warning}</p>
                ))}
                {schemaValidation.suggestions.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-on-surface-variant">
                    {schemaValidation.suggestions.map((suggestion, i) => (
                      <li key={i}>• {suggestion}</li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Auto-Run Created Children */}
      {['create_children_text', 'create_children_json', 'create_children_sections'].includes(localData.post_action || '') && (
        <Card className="bg-surface-container-low border-outline-variant">
          <CardContent className="py-3 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-body-sm text-on-surface flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Auto-Run Created Children
                </div>
                <div className="text-[10px] text-on-surface-variant">
                  Immediately execute created child prompts as a cascade
                </div>
              </div>
              <Switch
                checked={localData.auto_run_children || false}
                onCheckedChange={(checked) => {
                  handleChange('auto_run_children', checked);
                  handleSave('auto_run_children', checked);
                }}
              />
            </div>
            
            {localData.auto_run_children && (
              <Alert className="bg-amber-500/10 border-amber-500/30">
                <Zap className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-[10px] text-on-surface">
                  Created children will run automatically after this action completes.
                  Supports up to 99 levels of recursion.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Configuration */}
      {selectedAction?.configSchema && (
        <Card className="bg-surface-container-low border-outline-variant">
          <CardHeader className="pb-3">
            <CardTitle className="text-title-sm flex items-center gap-2 text-on-surface">
              <Settings2 className="h-4 w-4 text-on-surface-variant" />
              Action Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ActionConfigRenderer
              schema={selectedAction.configSchema}
              config={currentConfig}
              onChange={handleConfigChange}
              currentSchema={currentSchemaObject}
            />
            
            {/* Config Validation Warning */}
            {configValidation.hasIssues && (
              <Alert className="mt-3 bg-amber-500/10 border-amber-500/30">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-[10px] text-on-surface">
                  Config may be incomplete: {configValidation.issues.join('; ')}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Skip Preview Toggle */}
      {selectedAction && selectedAction.id === 'create_children_json' && (
        <Card className="bg-surface-container-low border-outline-variant">
          <CardContent className="py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-body-sm text-on-surface">Skip Preview</div>
                <div className="text-[10px] text-on-surface-variant">
                  Auto-confirm child creation without showing preview dialog
                </div>
              </div>
              <Switch
                checked={(currentConfig?.skip_preview as boolean) ?? false}
                onCheckedChange={(v) => handleConfigChange({ ...currentConfig, skip_preview: v })}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Variable Assignments Configuration */}
      <Card className="bg-surface-container-low border-outline-variant">
          <Collapsible defaultOpen={localData.variable_assignments_config?.enabled || false}>
            <CollapsibleTrigger asChild>
              <CardHeader className="py-2 px-3 cursor-pointer hover:bg-surface-container transition-colors">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-on-surface-variant" />
                  <CardTitle className="text-body-sm font-medium text-on-surface">Variable Assignments</CardTitle>
                  <ChevronDown className="h-4 w-4 ml-auto text-on-surface-variant" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-body-sm text-on-surface">Enable Variable Assignments</div>
                    <div className="text-[10px] text-on-surface-variant">
                      Allow AI response to update prompt variables
                    </div>
                  </div>
                  <Switch
                    checked={localData.variable_assignments_config?.enabled || false}
                    onCheckedChange={(checked) => {
                      const newConfig: VariableAssignmentsConfig = {
                        ...localData.variable_assignments_config,
                        enabled: checked,
                        json_path: localData.variable_assignments_config?.json_path || 'variable_assignments',
                      };
                      handleChange('variable_assignments_config', newConfig);
                      handleSave('variable_assignments_config', newConfig);
                    }}
                  />
                </div>

                {localData.variable_assignments_config?.enabled && (
                  <>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-body-sm text-on-surface">JSON Path</div>
                        <div className="text-[10px] text-on-surface-variant">
                          Path to assignments array in response
                        </div>
                      </div>
                      <input
                        type="text"
                        className="w-40 bg-surface-container rounded-m3-sm px-2 py-1 text-body-sm border border-outline-variant text-on-surface"
                        value={localData.variable_assignments_config?.json_path || 'variable_assignments'}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const newConfig: VariableAssignmentsConfig = {
                            ...localData.variable_assignments_config,
                            json_path: e.target.value,
                          };
                          handleChange('variable_assignments_config', newConfig);
                          handleSave('variable_assignments_config', newConfig);
                        }}
                        placeholder="variable_assignments"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-body-sm text-on-surface">Auto-Create Variables</div>
                        <div className="text-[10px] text-on-surface-variant">
                          Create new variables if they don't exist
                        </div>
                      </div>
                      <Switch
                        checked={localData.variable_assignments_config?.auto_create_variables || false}
                        onCheckedChange={(checked) => {
                          const newConfig: VariableAssignmentsConfig = {
                            ...localData.variable_assignments_config,
                            auto_create_variables: checked,
                          };
                          handleChange('variable_assignments_config', newConfig);
                          handleSave('variable_assignments_config', newConfig);
                        }}
                      />
                    </div>

                    <Alert className="bg-surface-container border-outline-variant">
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-[10px] text-on-surface-variant">
                        AI response should include an array at "{localData.variable_assignments_config?.json_path || 'variable_assignments'}" 
                        with objects containing "name" and "value" fields.
                      </AlertDescription>
                    </Alert>
                  </>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

      {/* Extracted Variables Display */}
      {localData.extracted_variables && Object.keys(localData.extracted_variables).length > 0 && (
        <Card className="bg-surface-container-low border-outline-variant">
          <CardHeader className="pb-3">
            <CardTitle className="text-title-sm flex items-center gap-2 text-on-surface">
              <Info className="h-4 w-4 text-on-surface-variant" />
              Extracted Variables
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 text-on-surface-variant" />
                </TooltipTrigger>
                <TooltipContent className="text-[10px] max-w-xs">
                  Variables extracted from the last AI response that can be used by child prompts.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {Object.entries(localData.extracted_variables).map(([key, value]) => (
                <Badge key={key} variant="outline" className="text-[10px]">
                  {key}: {typeof value === 'object' ? JSON.stringify(value).slice(0, 30) : String(value).slice(0, 30)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Action Result */}
      {localData.last_action_result && (
        <Card className={`border ${
          localData.last_action_result.status === 'success' 
            ? 'bg-green-500/5 border-green-500/30' 
            : 'bg-destructive/5 border-destructive/30'
        }`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-title-sm flex items-center gap-2 text-on-surface">
              {localData.last_action_result.status === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              Last Execution
              <span className="text-[10px] text-on-surface-variant font-normal ml-auto flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(localData.last_action_result.executed_at).toLocaleString()}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {localData.last_action_result.status === 'success' ? (
              <p className="text-body-sm text-on-surface">
                Created <strong>{localData.last_action_result.created_count || 0}</strong> child prompts
                {localData.last_action_result.message && `: ${localData.last_action_result.message}`}
              </p>
            ) : (
              <p className="text-body-sm text-destructive">
                {localData.last_action_result.error}
              </p>
            )}
            {localData.last_action_result.available_arrays && (
              <p className="text-[10px] text-on-surface-variant">
                Available arrays: {localData.last_action_result.available_arrays.join(', ') || 'none'}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Debug Info Panel */}
      <Card className="bg-surface-container-low border-outline-variant">
        <Collapsible open={isDebugOpen} onOpenChange={setIsDebugOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 cursor-pointer hover:bg-surface-container transition-colors">
              <CardTitle className="text-title-sm flex items-center justify-between text-on-surface">
                <div className="flex items-center gap-2">
                  <Bug className="h-4 w-4 text-on-surface-variant" />
                  Debug Info
                </div>
                <ChevronDown className={`h-4 w-4 text-on-surface-variant transition-transform ${isDebugOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-3">
              {/* Schema Validation Status */}
              <div className="space-y-1">
                <Label className="text-label-sm text-on-surface-variant">Schema Validation</Label>
                <div className="flex items-center gap-2">
                  {schemaValidation.isValid ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Valid
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                      <XCircle className="h-3 w-3 mr-1" />
                      Issues Found
                    </Badge>
                  )}
                </div>
              </div>

              {/* Available Array Paths */}
              <div className="space-y-1">
                <Label className="text-label-sm text-on-surface-variant">
                  Array Paths in Schema ({schemaValidation.arrayPaths?.length || availableArrayPaths.length})
                </Label>
                <div className="flex flex-wrap gap-1">
                  {(schemaValidation.arrayPaths || availableArrayPaths).map((path, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] font-mono">
                      {path}
                    </Badge>
                  ))}
                  {(schemaValidation.arrayPaths || availableArrayPaths).length === 0 && (
                    <span className="text-[10px] text-on-surface-variant italic">No arrays found</span>
                  )}
                </div>
              </div>

              {/* Current Config */}
              <div className="space-y-1">
                <Label className="text-label-sm text-on-surface-variant">Current Action Config</Label>
                <pre className="text-[10px] bg-surface-container p-2 rounded-m3-sm overflow-auto max-h-24 font-mono text-on-surface-variant">
                  {JSON.stringify(currentConfig, null, 2) || 'null'}
                </pre>
              </div>

              {/* Schema Object */}
              <div className="space-y-1">
                <Label className="text-label-sm text-on-surface-variant">Parsed Schema Object</Label>
                <pre className="text-[10px] bg-surface-container p-2 rounded-m3-sm overflow-auto max-h-24 font-mono text-on-surface-variant">
                  {currentSchemaObject ? JSON.stringify(currentSchemaObject, null, 2).slice(0, 500) + '...' : 'null'}
                </pre>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
};

export default ActionNodeSettings;
