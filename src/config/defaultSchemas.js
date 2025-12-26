// Default JSON schema templates for action nodes

export const DEFAULT_SCHEMAS = [
  {
    name: 'Create Children',
    description: 'Schema for creating child nodes with name and content',
    category: 'action',
    schema: {
      type: 'json_schema',
      json_schema: {
        name: 'create_children_response',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              description: 'Array of items to create as child nodes',
              items: {
                type: 'object',
                properties: {
                  name: { 
                    type: 'string', 
                    description: 'Name for the child node' 
                  },
                  content: { 
                    type: 'string', 
                    description: 'Content for the child node' 
                  }
                },
                required: ['name', 'content'],
                additionalProperties: false
              }
            }
          },
          required: ['items'],
          additionalProperties: false
        }
      }
    }
  },
  {
    name: 'Key-Value Pairs',
    description: 'Schema for extracting key-value data',
    category: 'extraction',
    schema: {
      type: 'json_schema',
      json_schema: {
        name: 'key_value_response',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              description: 'Array of key-value pairs',
              items: {
                type: 'object',
                properties: {
                  key: { 
                    type: 'string', 
                    description: 'The key/field name' 
                  },
                  value: { 
                    type: 'string', 
                    description: 'The value for this key' 
                  }
                },
                required: ['key', 'value'],
                additionalProperties: false
              }
            }
          },
          required: ['data'],
          additionalProperties: false
        }
      }
    }
  },
  {
    name: 'Structured Analysis',
    description: 'Schema for structured analysis with summary, findings, and recommendations',
    category: 'analysis',
    schema: {
      type: 'json_schema',
      json_schema: {
        name: 'analysis_response',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            summary: {
              type: 'string',
              description: 'Brief summary of the analysis'
            },
            findings: {
              type: 'array',
              description: 'Key findings from the analysis',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  importance: { 
                    type: 'string',
                    enum: ['low', 'medium', 'high']
                  }
                },
                required: ['title', 'description', 'importance'],
                additionalProperties: false
              }
            },
            recommendations: {
              type: 'array',
              description: 'Actionable recommendations',
              items: {
                type: 'string'
              }
            }
          },
          required: ['summary', 'findings', 'recommendations'],
          additionalProperties: false
        }
      }
    }
  },
  {
    name: 'Task List',
    description: 'Schema for generating task lists',
    category: 'action',
    schema: {
      type: 'json_schema',
      json_schema: {
        name: 'task_list_response',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              description: 'List of tasks',
              items: {
                type: 'object',
                properties: {
                  title: { 
                    type: 'string', 
                    description: 'Task title' 
                  },
                  description: { 
                    type: 'string', 
                    description: 'Detailed task description' 
                  },
                  priority: { 
                    type: 'string',
                    enum: ['low', 'medium', 'high'],
                    description: 'Task priority'
                  },
                  estimated_hours: {
                    type: 'number',
                    description: 'Estimated hours to complete'
                  }
                },
                required: ['title', 'description', 'priority'],
                additionalProperties: false
              }
            }
          },
          required: ['tasks'],
          additionalProperties: false
        }
      }
    }
  },
  {
    name: 'Simple List',
    description: 'Schema for a simple string array',
    category: 'extraction',
    schema: {
      type: 'json_schema',
      json_schema: {
        name: 'simple_list_response',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              description: 'List of items',
              items: {
                type: 'string'
              }
            }
          },
          required: ['items'],
          additionalProperties: false
        }
      }
    }
  }
];

// Generate schema description for the system prompt
export const formatSchemaForPrompt = (schema) => {
  if (!schema?.json_schema?.schema) return '';
  
  const schemaObj = schema.json_schema.schema;
  const lines = ['The response must match this JSON structure:'];
  
  const formatProperties = (props, required = [], indent = 0) => {
    const pad = '  '.repeat(indent);
    for (const [key, value] of Object.entries(props)) {
      const isRequired = required.includes(key);
      const reqLabel = isRequired ? ' (required)' : ' (optional)';
      
      if (value.type === 'array') {
        if (value.items?.type === 'object') {
          lines.push(`${pad}- ${key}${reqLabel}: array of objects with:`);
          formatProperties(value.items.properties, value.items.required || [], indent + 1);
        } else {
          lines.push(`${pad}- ${key}${reqLabel}: array of ${value.items?.type || 'any'}`);
        }
      } else if (value.type === 'object' && value.properties) {
        lines.push(`${pad}- ${key}${reqLabel}: object with:`);
        formatProperties(value.properties, value.required || [], indent + 1);
      } else {
        const enumStr = value.enum ? ` [${value.enum.join(', ')}]` : '';
        const desc = value.description ? ` - ${value.description}` : '';
        lines.push(`${pad}- ${key} (${value.type}${enumStr})${reqLabel}${desc}`);
      }
    }
  };
  
  if (schemaObj.properties) {
    formatProperties(schemaObj.properties, schemaObj.required || []);
  }
  
  return lines.join('\n');
};

// Get the default schema for action nodes
export const getDefaultActionSchema = () => DEFAULT_SCHEMAS[0].schema;
