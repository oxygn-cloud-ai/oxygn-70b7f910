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
import { Plus, Trash2, ChevronRight, ChevronDown, Save, Loader2, Code, Eye, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { formatSchemaForPrompt } from '@/utils/schemaUtils';

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
  const [editedTemplate, setEditedTemplate] = useState(template);
  const [activeView, setActiveView] = useState('visual');
  const [rawJson, setRawJson] = useState('');
  const [jsonError, setJsonError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize raw JSON view
  React.useEffect(() => {
    setEditedTemplate(template);
    setRawJson(JSON.stringify(template.json_schema, null, 2));
    setHasChanges(false);
    setJsonError(null);
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
    try {
      const parsed = JSON.parse(value);
      setJsonError(null);
      setEditedTemplate(prev => ({ ...prev, json_schema: parsed }));
    } catch (err) {
      setJsonError(err.message);
    }
  };

  const applyPreset = (preset) => {
    setEditedTemplate(prev => ({
      ...prev,
      json_schema: preset.schema,
      schema_description: preset.description
    }));
    setRawJson(JSON.stringify(preset.schema, null, 2));
    setHasChanges(true);
    toast.success(`Applied "${preset.name}" preset`);
  };

  const handleSave = async () => {
    if (jsonError) {
      toast.error('Fix JSON errors before saving');
      return;
    }
    
    setIsSaving(true);
    try {
      await onUpdate(template.row_id, {
        schema_name: editedTemplate.schema_name,
        schema_description: editedTemplate.schema_description,
        category: editedTemplate.category,
        json_schema: editedTemplate.json_schema
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
              <Button 
                onClick={handleSave} 
                disabled={!hasChanges || isSaving || !!jsonError}
                size="sm"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Save
              </Button>
            </div>
          </div>

          {/* View Tabs & Presets */}
          <div className="flex items-center justify-between">
            <Tabs value={activeView} onValueChange={setActiveView}>
              <TabsList className="h-8">
                <TabsTrigger value="visual" className="text-xs gap-1">
                  <Sparkles className="h-3 w-3" />
                  Visual
                </TabsTrigger>
                <TabsTrigger value="json" className="text-xs gap-1">
                  <Code className="h-3 w-3" />
                  JSON
                </TabsTrigger>
                <TabsTrigger value="preview" className="text-xs gap-1">
                  <Eye className="h-3 w-3" />
                  Preview
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Presets removed - use template picker instead */}
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
              <div className="space-y-2">
                {jsonError && (
                  <div className="flex items-center gap-2 p-2 bg-destructive/10 text-destructive rounded text-xs">
                    <AlertCircle className="h-4 w-4" />
                    {jsonError}
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
                <div>
                  <Label className="text-sm font-medium mb-2 block">Sample Output</Label>
                  <pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-auto">
                    {previewOutput}
                  </pre>
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
