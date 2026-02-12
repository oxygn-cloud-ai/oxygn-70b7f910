// @ts-nocheck
import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Plus, Trash2, ChevronRight, ChevronDown, Save, Loader2, Code, Eye, Sparkles, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { formatSchemaForPrompt } from '@/utils/schemaUtils';
import { validateJsonSchema, validateDataAgainstSchema, formatValidationErrors, parseJson } from '@/utils/jsonSchemaValidator';
import { useAuth } from '@/contexts/AuthContext';

const PROPERTY_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'integer', label: 'Integer' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'array', label: 'Array' },
  { value: 'object', label: 'Object' },
];

const SCHEMA_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'action', label: 'Action' },
  { value: 'extraction', label: 'Extraction' },
  { value: 'analysis', label: 'Analysis' },
];

const PropertyEditor = ({ property, path, onUpdate, onDelete, depth = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = property.type === 'object' || property.type === 'array';
  
  const handleFieldChange = (field, value) => {
    onUpdate(path, { ...property, [field]: value });
  };

  const handleTypeChange = (newType) => {
    const updated = { ...property, type: newType };
    // Reset nested structure when type changes
    if (newType === 'object') {
      updated.properties = updated.properties || {};
      updated.required = updated.required || [];
    } else if (newType === 'array') {
      updated.items = updated.items || { type: 'string' };
    } else {
      delete updated.properties;
      delete updated.required;
      delete updated.items;
    }
    onUpdate(path, updated);
  };

  const addNestedProperty = () => {
    if (property.type === 'object') {
      const newKey = `field_${Object.keys(property.properties || {}).length + 1}`;
      onUpdate(path, {
        ...property,
        properties: {
          ...property.properties,
          [newKey]: { type: 'string', description: '' }
        }
      });
    } else if (property.type === 'array' && property.items?.type === 'object') {
      const newKey = `field_${Object.keys(property.items.properties || {}).length + 1}`;
      onUpdate(path, {
        ...property,
        items: {
          ...property.items,
          properties: {
            ...property.items.properties,
            [newKey]: { type: 'string', description: '' }
          }
        }
      });
    }
  };

  const renderNestedProperties = () => {
    if (property.type === 'object' && property.properties) {
      return Object.entries(property.properties).map(([key, prop]) => (
        <PropertyEditor
          key={key}
          property={{ ...prop, _key: key }}
          path={[...path, 'properties', key]}
          onUpdate={onUpdate}
          onDelete={onDelete}
          depth={depth + 1}
        />
      ));
    } else if (property.type === 'array' && property.items?.type === 'object' && property.items.properties) {
      return Object.entries(property.items.properties).map(([key, prop]) => (
        <PropertyEditor
          key={key}
          property={{ ...prop, _key: key }}
          path={[...path, 'items', 'properties', key]}
          onUpdate={onUpdate}
          onDelete={onDelete}
          depth={depth + 1}
        />
      ));
    }
    return null;
  };

  return (
    <div className={cn("border-l-2 border-border/50 pl-3", depth > 0 && "ml-4 mt-2")}>
      <div className="flex items-center gap-2 py-1">
        {hasChildren && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        )}
        
        <Input
          value={property._key || ''}
          onChange={(e) => {
            // Rename the key - this requires special handling
            const oldKey = property._key;
            const newKey = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
            if (newKey && newKey !== oldKey) {
              // Parent path needs to be updated
              const parentPath = path.slice(0, -1);
              onUpdate([...parentPath, '__rename__'], { oldKey, newKey, property });
            }
          }}
          placeholder="Field name"
          className="h-7 w-28 text-xs"
        />
        
        <Select value={property.type} onValueChange={handleTypeChange}>
          <SelectTrigger className="h-7 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROPERTY_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {property.type === 'array' && (
          <Select 
            value={property.items?.type || 'string'} 
            onValueChange={(v) => {
              const newItems = v === 'object' 
                ? { type: 'object', properties: {}, required: [], additionalProperties: false }
                : { type: v };
              handleFieldChange('items', newItems);
            }}
          >
            <SelectTrigger className="h-7 w-20 text-xs">
              <SelectValue placeholder="Item" />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        <Switch
          checked={property._required || false}
          onCheckedChange={(checked) => handleFieldChange('_required', checked)}
          className="h-4 w-7"
        />
        <span className="text-[10px] text-muted-foreground">Req</span>

        {hasChildren && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={addNestedProperty}>
                <Plus className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add nested field</TooltipContent>
          </Tooltip>
        )}
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onDelete(path)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete field</TooltipContent>
        </Tooltip>
      </div>
      
      <Input
        value={property.description || ''}
        onChange={(e) => handleFieldChange('description', e.target.value)}
        placeholder="Description (optional)"
        className="h-6 text-[10px] mt-1 w-full max-w-xs"
      />

      {property.type === 'string' && property.enum && (
        <Input
          value={property.enum?.join(', ') || ''}
          onChange={(e) => {
            const vals = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
            handleFieldChange('enum', vals.length > 0 ? vals : undefined);
          }}
          placeholder="Enum values (comma separated)"
          className="h-6 text-[10px] mt-1 w-full max-w-xs"
        />
      )}
      
      {isExpanded && hasChildren && (
        <div className="mt-1">
          {renderNestedProperties()}
        </div>
      )}
    </div>
  );
};

const JsonSchemaEditor = ({ template, onUpdate }) => {
  const { isAdmin } = useAuth();
  const [editedTemplate, setEditedTemplate] = useState(template);
  const [activeView, setActiveView] = useState('visual');
  const [rawJson, setRawJson] = useState('');
  const [jsonError, setJsonError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // New state for validation
  const [schemaValidation, setSchemaValidation] = useState({ isValid: true, errors: [], warnings: [] });
  const [sampleValidation, setSampleValidation] = useState({ isValid: true, errors: [] });
  const [customSampleOutput, setCustomSampleOutput] = useState('');
  const [useCustomSample, setUseCustomSample] = useState(false);
  const [sampleJsonError, setSampleJsonError] = useState(null);

  // Initialize raw JSON view and custom sample
  React.useEffect(() => {
    setEditedTemplate(template);
    setRawJson(JSON.stringify(template.json_schema, null, 2));
    setHasChanges(false);
    setJsonError(null);
    
    // Initialize custom sample from template
    if (template.sample_output) {
      setCustomSampleOutput(JSON.stringify(template.sample_output, null, 2));
      setUseCustomSample(true);
      // Validate the saved sample against the schema
      const result = validateDataAgainstSchema(template.sample_output, template.json_schema);
      setSampleValidation(result);
    } else {
      setCustomSampleOutput('');
      setUseCustomSample(false);
      setSampleValidation({ isValid: true, errors: [] });
    }
    setSampleJsonError(null);
    
    // Validate the schema structure
    const schemaResult = validateJsonSchema(template.json_schema);
    setSchemaValidation(schemaResult);
  }, [template.row_id]);

  // Parse schema for visual editor - handle multiple nesting levels
  const schemaData = useMemo(() => {
    try {
      const jsonSchema = editedTemplate.json_schema;
      if (!jsonSchema) return { type: 'object', properties: {}, required: [] };
      
      // Handle OpenAI format: { json_schema: { name, schema: {...} } }
      if (jsonSchema.json_schema?.schema) {
        return jsonSchema.json_schema.schema;
      }
      // Handle wrapped format: { schema: {...} }
      if (jsonSchema.schema?.properties) {
        return jsonSchema.schema;
      }
      // Handle direct schema: { type, properties: {...} }
      if (jsonSchema.properties) {
        return jsonSchema;
      }
      // Handle deeply nested: { json_schema: { json_schema: { schema: {...} } } }
      if (jsonSchema.json_schema?.json_schema?.schema) {
        return jsonSchema.json_schema.json_schema.schema;
      }
      
      return { type: 'object', properties: {}, required: [] };
    } catch {
      return { type: 'object', properties: {}, required: [] };
    }
  }, [editedTemplate.json_schema]);

  const handleFieldChange = (field, value) => {
    setEditedTemplate(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handlePropertyUpdate = useCallback((path, value) => {
    setEditedTemplate(prev => {
      const newSchema = JSON.parse(JSON.stringify(prev.json_schema));
      const innerSchema = newSchema.json_schema?.schema || newSchema.schema || newSchema;
      
      // Handle rename operation
      if (path[path.length - 1] === '__rename__') {
        const { oldKey, newKey, property } = value;
        const parentPath = path.slice(0, -1);
        let target = innerSchema;
        for (const key of parentPath) {
          target = target[key];
        }
        if (target && target[oldKey]) {
          target[newKey] = target[oldKey];
          delete target[oldKey];
        }
      } else {
        // Normal update
        let target = innerSchema;
        for (let i = 0; i < path.length - 1; i++) {
          target = target[path[i]];
        }
        target[path[path.length - 1]] = value;
      }
      
      return { ...prev, json_schema: newSchema };
    });
    setRawJson(JSON.stringify(editedTemplate.json_schema, null, 2));
    setHasChanges(true);
  }, []);

  const handlePropertyDelete = useCallback((path) => {
    setEditedTemplate(prev => {
      const newSchema = JSON.parse(JSON.stringify(prev.json_schema));
      const innerSchema = newSchema.json_schema?.schema || newSchema.schema || newSchema;
      
      let target = innerSchema;
      for (let i = 0; i < path.length - 1; i++) {
        target = target[path[i]];
      }
      delete target[path[path.length - 1]];
      
      return { ...prev, json_schema: newSchema };
    });
    setHasChanges(true);
  }, []);

  const addRootProperty = () => {
    const newKey = `field_${Object.keys(schemaData.properties || {}).length + 1}`;
    setEditedTemplate(prev => {
      const newSchema = JSON.parse(JSON.stringify(prev.json_schema));
      const innerSchema = newSchema.json_schema?.schema || newSchema.schema;
      if (!innerSchema.properties) innerSchema.properties = {};
      innerSchema.properties[newKey] = { type: 'string', description: '' };
      return { ...prev, json_schema: newSchema };
    });
    setHasChanges(true);
  };

  const handleRawJsonChange = (value) => {
    setRawJson(value);
    setHasChanges(true);
    
    // First check JSON syntax
    const parseResult = parseJson(value);
    if (!parseResult.isValid) {
      setJsonError(parseResult.error);
      setSchemaValidation({ isValid: false, errors: [{ path: '', message: 'Invalid JSON syntax' }], warnings: [] });
      return;
    }
    
    setJsonError(null);
    setEditedTemplate(prev => ({ ...prev, json_schema: parseResult.data }));
    
    // Then validate schema structure
    const schemaResult = validateJsonSchema(parseResult.data);
    setSchemaValidation(schemaResult);
    
    // Re-validate sample if custom sample is in use
    if (useCustomSample && customSampleOutput) {
      const sampleParse = parseJson(customSampleOutput);
      if (sampleParse.isValid) {
        const sampleResult = validateDataAgainstSchema(sampleParse.data, parseResult.data);
        setSampleValidation(sampleResult);
      }
    }
  };

  // Handle custom sample output changes
  const handleCustomSampleChange = (value) => {
    setCustomSampleOutput(value);
    setHasChanges(true);
    
    // First check JSON syntax
    const parseResult = parseJson(value);
    if (!parseResult.isValid) {
      setSampleJsonError(parseResult.error);
      setSampleValidation({ isValid: false, errors: [{ path: '', message: 'Invalid JSON syntax' }] });
      return;
    }
    
    setSampleJsonError(null);
    
    // Validate against schema
    const sampleResult = validateDataAgainstSchema(parseResult.data, editedTemplate.json_schema);
    setSampleValidation(sampleResult);
  };

  // Toggle custom sample mode
  const handleToggleCustomSample = (enabled) => {
    setUseCustomSample(enabled);
    setHasChanges(true);
    
    if (enabled && !customSampleOutput) {
      // Initialize with auto-generated preview
      setCustomSampleOutput(previewOutput);
      // Validate the auto-generated preview
      const parseResult = parseJson(previewOutput);
      if (parseResult.isValid) {
        const result = validateDataAgainstSchema(parseResult.data, editedTemplate.json_schema);
        setSampleValidation(result);
      }
    } else if (!enabled) {
      setSampleValidation({ isValid: true, errors: [] });
      setSampleJsonError(null);
    }
  };

  const handleSave = async () => {
    if (jsonError) {
      toast.error('Fix JSON errors before saving');
      return;
    }
    
    if (!schemaValidation.isValid) {
      toast.error('Fix schema validation errors before saving');
      return;
    }
    
    if (useCustomSample && (sampleJsonError || !sampleValidation.isValid)) {
      toast.error('Fix sample output errors before saving');
      return;
    }
    
    setIsSaving(true);
    try {
      // Prepare sample_output for save
      let sampleOutput = null;
      if (useCustomSample && customSampleOutput) {
        const parseResult = parseJson(customSampleOutput);
        if (parseResult.isValid) {
          sampleOutput = parseResult.data;
        }
      }
      
      await onUpdate(template.row_id, {
        schema_name: editedTemplate.schema_name,
        schema_description: editedTemplate.schema_description,
        category: editedTemplate.category,
        json_schema: editedTemplate.json_schema,
        sample_output: sampleOutput,
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Generate preview output
  const previewOutput = useMemo(() => {
    try {
      const generateSample = (prop) => {
        if (prop.type === 'string') return prop.enum ? prop.enum[0] : 'example';
        if (prop.type === 'number' || prop.type === 'integer') return 0;
        if (prop.type === 'boolean') return true;
        if (prop.type === 'array') {
          if (prop.items?.type === 'object') {
            return [generateSample(prop.items)];
          }
          return [generateSample(prop.items || { type: 'string' })];
        }
        if (prop.type === 'object' && prop.properties) {
          const obj = {};
          for (const [key, val] of Object.entries(prop.properties)) {
            obj[key] = generateSample(val);
          }
          return obj;
        }
        return null;
      };
      
      if (schemaData.properties) {
        const sample = {};
        for (const [key, prop] of Object.entries(schemaData.properties)) {
          sample[key] = generateSample(prop);
        }
        return JSON.stringify(sample, null, 2);
      }
      return '{}';
    } catch {
      return '{}';
    }
  }, [schemaData]);

  // Check if save should be disabled
  const isSaveDisabled = !hasChanges || isSaving || !!jsonError || !schemaValidation.isValid || 
    (useCustomSample && (!!sampleJsonError || !sampleValidation.isValid));

  // Get validation indicator for tabs
  const getJsonTabIndicator = () => {
    if (jsonError) return <span className="w-1.5 h-1.5 rounded-full bg-destructive" />;
    if (!schemaValidation.isValid) return <span className="w-1.5 h-1.5 rounded-full bg-destructive" />;
    if (schemaValidation.warnings.length > 0) return <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />;
    return <span className="w-1.5 h-1.5 rounded-full bg-green-500" />;
  };

  const getPreviewTabIndicator = () => {
    if (!useCustomSample) return null;
    if (sampleJsonError || !sampleValidation.isValid) return <span className="w-1.5 h-1.5 rounded-full bg-destructive" />;
    return <span className="w-1.5 h-1.5 rounded-full bg-green-500" />;
  };

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 space-y-2">
              <Input
                value={editedTemplate.schema_name || ''}
                onChange={(e) => handleFieldChange('schema_name', e.target.value)}
                placeholder="Schema name"
                className="text-lg font-semibold h-9 border-0 px-0 focus-visible:ring-0"
              />
              <Input
                value={editedTemplate.schema_description || ''}
                onChange={(e) => handleFieldChange('schema_description', e.target.value)}
                placeholder="Description"
                className="text-sm text-muted-foreground h-7 border-0 px-0 focus-visible:ring-0"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={editedTemplate.category || 'general'}
                onValueChange={(v) => handleFieldChange('category', v)}
              >
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEMA_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={handleSave} 
                    disabled={isSaveDisabled}
                    size="sm"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Save
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isSaveDisabled && !hasChanges ? 'No changes to save' : 
                   isSaveDisabled ? 'Fix validation errors first' : 'Save changes'}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* View Tabs */}
          <div className="flex items-center justify-between">
            <Tabs value={activeView} onValueChange={setActiveView}>
              <TabsList className="h-8">
                <TabsTrigger value="visual" className="text-xs gap-1">
                  <Sparkles className="h-3 w-3" />
                  Visual
                </TabsTrigger>
                <TabsTrigger value="json" className="text-xs gap-1.5">
                  <Code className="h-3 w-3" />
                  JSON
                  {getJsonTabIndicator()}
                </TabsTrigger>
                <TabsTrigger value="preview" className="text-xs gap-1.5">
                  <Eye className="h-3 w-3" />
                  Preview
                  {getPreviewTabIndicator()}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {activeView === 'visual' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Properties</Label>
                  <Button size="sm" variant="outline" onClick={addRootProperty} className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Field
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {schemaData.properties && Object.entries(schemaData.properties).map(([key, prop]) => (
                    <PropertyEditor
                      key={key}
                      property={{ ...prop, _key: key, _required: schemaData.required?.includes(key) }}
                      path={['properties', key]}
                      onUpdate={handlePropertyUpdate}
                      onDelete={handlePropertyDelete}
                    />
                  ))}
                  
                  {(!schemaData.properties || Object.keys(schemaData.properties).length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No properties defined yet.</p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={addRootProperty}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add First Field
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeView === 'json' && (
              <div className="space-y-3">
                {/* Syntax Error */}
                {jsonError && (
                  <div className="flex items-center gap-2 p-2 bg-destructive/10 text-destructive rounded text-xs">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>Syntax Error: {jsonError}</span>
                  </div>
                )}
                
                {/* Schema Validation Errors */}
                {!jsonError && schemaValidation.errors.length > 0 && (
                  <div className="flex items-start gap-2 p-2 bg-destructive/10 text-destructive rounded text-xs">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-medium">Schema Validation Errors:</span>
                      {schemaValidation.errors.map((err, i) => (
                        <div key={i}>{err.path ? `${err.path}: ` : ''}{err.message}</div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Schema Warnings */}
                {!jsonError && schemaValidation.isValid && schemaValidation.warnings.length > 0 && (
                  <div className="flex items-start gap-2 p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded text-xs">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-medium">Warnings:</span>
                      {schemaValidation.warnings.map((warn, i) => (
                        <div key={i}>{warn}</div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Valid Schema Indicator */}
                {!jsonError && schemaValidation.isValid && schemaValidation.warnings.length === 0 && (
                  <div className="flex items-center gap-2 p-2 bg-green-500/10 text-green-600 dark:text-green-400 rounded text-xs">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Schema is valid</span>
                  </div>
                )}
                
                <Textarea
                  value={rawJson}
                  onChange={(e) => handleRawJsonChange(e.target.value)}
                  className="font-mono text-xs min-h-[400px]"
                  placeholder="Enter JSON schema..."
                />
              </div>
            )}

            {activeView === 'preview' && (
              <div className="space-y-4">
                {/* Custom Sample Toggle - only for admins */}
                {isAdmin && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <Label className="text-sm font-medium">Custom Sample Output</Label>
                      <p className="text-xs text-muted-foreground">Define a custom sample instead of auto-generated</p>
                    </div>
                    <Switch 
                      checked={useCustomSample} 
                      onCheckedChange={handleToggleCustomSample} 
                    />
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Sample Output {useCustomSample ? '(Custom)' : '(Auto-generated)'}
                  </Label>
                  
                  {useCustomSample ? (
                    <div className="space-y-2">
                      {/* Sample Validation Errors */}
                      {sampleJsonError && (
                        <div className="flex items-center gap-2 p-2 bg-destructive/10 text-destructive rounded text-xs">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          <span>Syntax Error: {sampleJsonError}</span>
                        </div>
                      )}
                      
                      {!sampleJsonError && !sampleValidation.isValid && (
                        <div className="flex items-start gap-2 p-2 bg-destructive/10 text-destructive rounded text-xs">
                          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <span className="font-medium">Validation Errors:</span>
                            {sampleValidation.errors.map((err, i) => (
                              <div key={i}>{err.path ? `${err.path}: ` : ''}{err.message}</div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {!sampleJsonError && sampleValidation.isValid && (
                        <div className="flex items-center gap-2 p-2 bg-green-500/10 text-green-600 dark:text-green-400 rounded text-xs">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Sample validates against schema</span>
                        </div>
                      )}
                      
                      <Textarea
                        value={customSampleOutput}
                        onChange={(e) => handleCustomSampleChange(e.target.value)}
                        className="font-mono text-xs min-h-[300px]"
                        placeholder="Enter custom sample output JSON..."
                      />
                    </div>
                  ) : (
                    <pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-auto">
                      {previewOutput}
                    </pre>
                  )}
                </div>
                
                <div>
                  <Label className="text-sm font-medium mb-2 block">Prompt Description</Label>
                  <pre className="bg-muted p-4 rounded-lg text-xs whitespace-pre-wrap">
                    {formatSchemaForPrompt(editedTemplate.json_schema)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
};

export default JsonSchemaEditor;
