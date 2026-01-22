import React, { useState, useEffect } from 'react';
import { Play, ChevronRight, ChevronDown, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface VariableDefinition {
  name: string;
  type?: string;
  default?: string;
  description?: string;
}

interface TemplateStructure {
  _id?: string;
  prompt_name?: string;
  input_admin_prompt?: string;
  input_user_prompt?: string;
  model?: string | null;
  children?: TemplateStructure[];
  [key: string]: unknown;
}

interface Template {
  row_id: string;
  template_name: string;
  structure?: TemplateStructure;
  variable_definitions?: VariableDefinition[];
}

interface TemplatePreviewTabProps {
  template: Template;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const TemplatePreviewTab: React.FC<TemplatePreviewTabProps> = ({ template }) => {
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [showResolved, setShowResolved] = useState<boolean>(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));

  const variableDefinitions = template.variable_definitions || [];
  const structure = template.structure || {};

  // Initialize variable values from defaults
  useEffect(() => {
    const defaults: Record<string, string> = {};
    variableDefinitions.forEach(v => {
      if (v.default && !variableValues[v.name]) {
        defaults[v.name] = v.default;
      }
    });
    if (Object.keys(defaults).length > 0) {
      setVariableValues(prev => ({ ...defaults, ...prev }));
    }
  }, [variableDefinitions]);

  // Resolve variables in text
  const resolveVariables = (text: string | undefined): string | undefined => {
    if (!text) return text;
    return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const trimmedName = varName.trim();
      if (variableValues[trimmedName]) {
        return variableValues[trimmedName];
      }
      return match; // Keep original if not resolved
    });
  };

  // Toggle node expansion
  const toggleExpanded = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Render structure preview
  const renderNode = (node: TemplateStructure, depth: number = 0): React.ReactNode => {
    if (!node) return null;
    const nodeId = node._id || `node-${depth}`;
    const isExpanded = expandedNodes.has(nodeId);
    const hasChildren = node.children && node.children.length > 0;

    const systemPrompt = showResolved 
      ? resolveVariables(node.input_admin_prompt) 
      : node.input_admin_prompt;
    const userPrompt = showResolved 
      ? resolveVariables(node.input_user_prompt) 
      : node.input_user_prompt;

    return (
      <div key={nodeId} className="border-l-2 border-outline-variant ml-2 pl-4" style={{ marginLeft: depth > 0 ? '12px' : '0' }}>
        <div className="py-2">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
            onClick={() => toggleExpanded(nodeId)}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : (
              <FileText className="h-4 w-4 text-on-surface-variant" />
            )}
            <span className="font-medium text-on-surface">{node.prompt_name || 'Untitled'}</span>
            {node.model && (
              <Badge variant="outline" className="text-[10px]">{node.model}</Badge>
            )}
          </div>
          
          {isExpanded && (
            <div className="mt-2 space-y-2 text-body-sm">
              {systemPrompt && (
                <div className="rounded-m3-sm bg-surface-container p-2">
                  <p className="text-label-sm text-on-surface-variant mb-1">System</p>
                  <pre className="whitespace-pre-wrap text-[11px] font-mono text-on-surface">{systemPrompt}</pre>
                </div>
              )}
              {userPrompt && (
                <div className="rounded-m3-sm bg-surface-container p-2">
                  <p className="text-label-sm text-on-surface-variant mb-1">User</p>
                  <pre className="whitespace-pre-wrap text-[11px] font-mono text-on-surface">{userPrompt}</pre>
                </div>
              )}
            </div>
          )}
          
          {isExpanded && hasChildren && (
            <div className="mt-2">
              {node.children!.map((child, i) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Variable Inputs */}
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-title-sm">Test Variables</CardTitle>
          <CardDescription className="text-body-sm">Fill in values to preview resolved prompts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {variableDefinitions.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">No variables defined in this template.</p>
          ) : (
            variableDefinitions.map(variable => (
              <div key={variable.name} className="space-y-1">
                <Label className="flex items-center gap-2 text-body-sm">
                  <span className="font-mono text-[10px] text-on-surface-variant">{`{{${variable.name}}}`}</span>
                  {variable.description && (
                    <span className="text-on-surface-variant font-normal">— {variable.description}</span>
                  )}
                </Label>
                {variable.type === 'textarea' ? (
                  <Textarea
                    value={variableValues[variable.name] || ''}
                    onChange={(e) => setVariableValues(prev => ({ ...prev, [variable.name]: e.target.value }))}
                    placeholder={variable.default || `Enter ${variable.name}...`}
                    rows={3}
                    className="bg-surface-container"
                  />
                ) : (
                  <Input
                    type={variable.type === 'number' ? 'number' : 'text'}
                    value={variableValues[variable.name] || ''}
                    onChange={(e) => setVariableValues(prev => ({ ...prev, [variable.name]: e.target.value }))}
                    placeholder={variable.default || `Enter ${variable.name}...`}
                    className="bg-surface-container"
                  />
                )}
              </div>
            ))
          )}
          
          <Separator />
          
          <div className="flex items-center gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={() => setShowResolved(!showResolved)}
                    className={`w-8 h-8 flex items-center justify-center rounded-m3-full transition-colors ${
                      showResolved 
                        ? 'text-primary hover:bg-surface-container' 
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <Play className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{showResolved ? 'Showing resolved values' : 'Show resolved values'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {showResolved && (
              <span className="text-[10px] text-on-surface-variant">
                Variables are replaced with values
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Structure Preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-title-sm">Structure Preview</CardTitle>
          <CardDescription className="text-body-sm">
            {showResolved 
              ? 'Prompts with variables resolved' 
              : 'Template structure as it will be created'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {renderNode({ ...structure, _id: 'root' })}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default TemplatePreviewTab;
