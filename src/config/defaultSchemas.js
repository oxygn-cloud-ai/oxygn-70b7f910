// Default JSON schema templates for action nodes

export const DEFAULT_SCHEMAS = [
  {
    id: 'create_children',
    name: 'Create Children',
    description: 'Schema for creating child nodes with name and content',
    category: 'action',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Array of items to create as child nodes',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name for the child node' },
              content: { type: 'string', description: 'Content for the child node' }
            },
            required: ['name', 'content'],
            additionalProperties: false
          }
        }
      },
      required: ['items'],
      additionalProperties: false
    }
  },
  {
    id: 'goal_setting',
    name: 'Goal Setting (SMART)',
    description: 'SMART goals with objectives, key results, and milestones',
    category: 'planning',
    schema: {
      type: 'object',
      properties: {
        vision: {
          type: 'string',
          description: 'High-level vision statement'
        },
        goals: {
          type: 'array',
          description: 'SMART goals',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Goal title' },
              description: { type: 'string', description: 'Detailed goal description' },
              specific: { type: 'string', description: 'What exactly will be accomplished?' },
              measurable: { type: 'string', description: 'How will progress be measured?' },
              achievable: { type: 'string', description: 'Is this realistic?' },
              relevant: { type: 'string', description: 'Why does this matter?' },
              time_bound: { type: 'string', description: 'Target completion date' },
              key_results: {
                type: 'array',
                items: { type: 'string' },
                description: 'Measurable key results'
              },
              priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] }
            },
            required: ['title', 'description', 'key_results', 'time_bound'],
            additionalProperties: false
          }
        },
        milestones: {
          type: 'array',
          description: 'Key milestones to track progress',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              target_date: { type: 'string' },
              success_criteria: { type: 'string' }
            },
            required: ['name', 'target_date'],
            additionalProperties: false
          }
        }
      },
      required: ['goals'],
      additionalProperties: false
    }
  },
  {
    id: 'okr',
    name: 'OKRs (Objectives & Key Results)',
    description: 'Objectives with measurable key results',
    category: 'planning',
    schema: {
      type: 'object',
      properties: {
        time_period: { type: 'string', description: 'e.g., Q1 2025' },
        objectives: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              objective: { type: 'string', description: 'Qualitative goal statement' },
              owner: { type: 'string', description: 'Person or team responsible' },
              key_results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    description: { type: 'string' },
                    metric: { type: 'string', description: 'How it will be measured' },
                    target: { type: 'string', description: 'Target value' },
                    current: { type: 'string', description: 'Current baseline' }
                  },
                  required: ['description', 'target'],
                  additionalProperties: false
                }
              }
            },
            required: ['objective', 'key_results'],
            additionalProperties: false
          }
        }
      },
      required: ['objectives'],
      additionalProperties: false
    }
  },
  {
    id: 'swot_analysis',
    name: 'SWOT Analysis',
    description: 'Strengths, Weaknesses, Opportunities, Threats',
    category: 'analysis',
    schema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'What is being analyzed' },
        strengths: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              point: { type: 'string' },
              impact: { type: 'string', enum: ['high', 'medium', 'low'] }
            },
            required: ['point'],
            additionalProperties: false
          }
        },
        weaknesses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              point: { type: 'string' },
              impact: { type: 'string', enum: ['high', 'medium', 'low'] }
            },
            required: ['point'],
            additionalProperties: false
          }
        },
        opportunities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              point: { type: 'string' },
              potential: { type: 'string', enum: ['high', 'medium', 'low'] }
            },
            required: ['point'],
            additionalProperties: false
          }
        },
        threats: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              point: { type: 'string' },
              severity: { type: 'string', enum: ['high', 'medium', 'low'] }
            },
            required: ['point'],
            additionalProperties: false
          }
        },
        recommendations: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['strengths', 'weaknesses', 'opportunities', 'threats'],
      additionalProperties: false
    }
  },
  {
    id: 'company_profile',
    name: 'Company Profile',
    description: 'Structured company information extraction',
    category: 'extraction',
    schema: {
      type: 'object',
      properties: {
        company_name: { type: 'string' },
        industry: { type: 'string' },
        founded: { type: 'string' },
        headquarters: { type: 'string' },
        mission: { type: 'string' },
        vision: { type: 'string' },
        values: { type: 'array', items: { type: 'string' } },
        products_services: { type: 'array', items: { type: 'string' } },
        target_market: { type: 'string' },
        competitive_advantages: { type: 'array', items: { type: 'string' } },
        key_challenges: { type: 'array', items: { type: 'string' } },
        growth_opportunities: { type: 'array', items: { type: 'string' } }
      },
      required: ['company_name'],
      additionalProperties: false
    }
  },
  {
    id: 'person_profile',
    name: 'Person Profile',
    description: 'Structured profile for individuals',
    category: 'extraction',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        role: { type: 'string' },
        organization: { type: 'string' },
        background: { type: 'string', description: 'Brief professional background' },
        expertise: { type: 'array', items: { type: 'string' } },
        achievements: { type: 'array', items: { type: 'string' } },
        goals: { type: 'array', items: { type: 'string' } },
        challenges: { type: 'array', items: { type: 'string' } },
        communication_style: { type: 'string' },
        decision_factors: { type: 'array', items: { type: 'string' }, description: 'What influences their decisions' }
      },
      required: ['name'],
      additionalProperties: false
    }
  },
  {
    id: 'meeting_notes',
    name: 'Meeting Notes',
    description: 'Structured meeting summary with action items',
    category: 'action',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        date: { type: 'string' },
        attendees: { type: 'array', items: { type: 'string' } },
        summary: { type: 'string', description: 'Brief meeting summary' },
        key_discussions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              points: { type: 'array', items: { type: 'string' } },
              decisions: { type: 'array', items: { type: 'string' } }
            },
            required: ['topic'],
            additionalProperties: false
          }
        },
        action_items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              task: { type: 'string' },
              owner: { type: 'string' },
              due_date: { type: 'string' },
              priority: { type: 'string', enum: ['high', 'medium', 'low'] }
            },
            required: ['task', 'owner'],
            additionalProperties: false
          }
        },
        next_steps: { type: 'array', items: { type: 'string' } }
      },
      required: ['summary', 'action_items'],
      additionalProperties: false
    }
  },
  {
    id: 'project_plan',
    name: 'Project Plan',
    description: 'Project structure with phases, tasks, and dependencies',
    category: 'planning',
    schema: {
      type: 'object',
      properties: {
        project_name: { type: 'string' },
        objective: { type: 'string' },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        team: { type: 'array', items: { type: 'string' } },
        phases: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              duration: { type: 'string' },
              tasks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    assignee: { type: 'string' },
                    effort: { type: 'string' },
                    dependencies: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['title'],
                  additionalProperties: false
                }
              },
              deliverables: { type: 'array', items: { type: 'string' } }
            },
            required: ['name', 'tasks'],
            additionalProperties: false
          }
        },
        risks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              risk: { type: 'string' },
              likelihood: { type: 'string', enum: ['high', 'medium', 'low'] },
              mitigation: { type: 'string' }
            },
            required: ['risk'],
            additionalProperties: false
          }
        },
        success_criteria: { type: 'array', items: { type: 'string' } }
      },
      required: ['project_name', 'phases'],
      additionalProperties: false
    }
  },
  {
    id: 'key_value_pairs',
    name: 'Key-Value Pairs',
    description: 'Schema for extracting key-value data',
    category: 'extraction',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          description: 'Array of key-value pairs',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'The key/field name' },
              value: { type: 'string', description: 'The value for this key' }
            },
            required: ['key', 'value'],
            additionalProperties: false
          }
        }
      },
      required: ['data'],
      additionalProperties: false
    }
  },
  {
    id: 'structured_analysis',
    name: 'Structured Analysis',
    description: 'Analysis with summary, findings, and recommendations',
    category: 'analysis',
    schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Brief summary of the analysis' },
        findings: {
          type: 'array',
          description: 'Key findings from the analysis',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              importance: { type: 'string', enum: ['low', 'medium', 'high'] }
            },
            required: ['title', 'description', 'importance'],
            additionalProperties: false
          }
        },
        recommendations: {
          type: 'array',
          description: 'Actionable recommendations',
          items: { type: 'string' }
        }
      },
      required: ['summary', 'findings', 'recommendations'],
      additionalProperties: false
    }
  },
  {
    id: 'task_list',
    name: 'Task List',
    description: 'Schema for generating task lists',
    category: 'action',
    schema: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          description: 'List of tasks',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Task title' },
              description: { type: 'string', description: 'Detailed task description' },
              priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Task priority' },
              estimated_hours: { type: 'number', description: 'Estimated hours to complete' }
            },
            required: ['title', 'description', 'priority'],
            additionalProperties: false
          }
        }
      },
      required: ['tasks'],
      additionalProperties: false
    }
  },
  {
    id: 'decision_matrix',
    name: 'Decision Matrix',
    description: 'Compare options with weighted criteria',
    category: 'analysis',
    schema: {
      type: 'object',
      properties: {
        decision: { type: 'string', description: 'What decision is being made' },
        criteria: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              weight: { type: 'number', description: '1-10 importance' },
              description: { type: 'string' }
            },
            required: ['name', 'weight'],
            additionalProperties: false
          }
        },
        options: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              scores: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    criterion: { type: 'string' },
                    score: { type: 'number', description: '1-10 rating' },
                    rationale: { type: 'string' }
                  },
                  required: ['criterion', 'score'],
                  additionalProperties: false
                }
              },
              total_score: { type: 'number' },
              pros: { type: 'array', items: { type: 'string' } },
              cons: { type: 'array', items: { type: 'string' } }
            },
            required: ['name', 'scores'],
            additionalProperties: false
          }
        },
        recommendation: { type: 'string' }
      },
      required: ['decision', 'criteria', 'options'],
      additionalProperties: false
    }
  },
  {
    id: 'simple_list',
    name: 'Simple List',
    description: 'Schema for a simple string array',
    category: 'extraction',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'List of items',
          items: { type: 'string' }
        }
      },
      required: ['items'],
      additionalProperties: false
    }
  }
];

// Generate schema description for the system prompt
export const formatSchemaForPrompt = (schema) => {
  if (!schema) return '';
  
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
  
  if (schema.properties) {
    formatProperties(schema.properties, schema.required || []);
  }
  
  return lines.join('\n');
};

// Get the default schema for action nodes
export const getDefaultActionSchema = () => DEFAULT_SCHEMAS[0].schema;
