import React, { useState, useMemo } from 'react';
import { Play, ChevronRight, ChevronDown, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/**
 * Preview tab showing what the template will create
 */
const TemplatePreviewTab = ({ template }) => {
  const [variableValues, setVariableValues] = useState({});
  const [showResolved, setShowResolved] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState(new Set(['root']));

  const variableDefinitions = template.variable_definitions || [];
  const structure = template.structure || {};

  // Initialize variable values from defaults
  useMemo(() => {
    const defaults = {};
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
  const resolveVariables = (text) => {
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
  const toggleExpanded = (nodeId) => {
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
  const renderNode = (node, depth = 0) => {
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
      <div key={nodeId} className="border-l-2 border-border ml-2 pl-4" style={{ marginLeft: depth > 0 ? '12px' : '0' }}>
        <div className="py-2">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
            onClick={() => toggleExpanded(nodeId)}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : (
              <FileText className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-medium">{node.prompt_name || 'Untitled'}</span>
            {node.model && (
              <Badge variant="outline" className="text-[10px]">{node.model}</Badge>
            )}
          </div>
          
          {isExpanded && (
            <div className="mt-2 space-y-2 text-sm">
              {systemPrompt && (
                <div className="rounded bg-muted/50 p-2">
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">System</p>
                  <pre className="whitespace-pre-wrap text-xs font-mono">{systemPrompt}</pre>
                </div>
              )}
              {userPrompt && (
                <div className="rounded bg-muted/50 p-2">
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">User</p>
                  <pre className="whitespace-pre-wrap text-xs font-mono">{userPrompt}</pre>
                </div>
              )}
            </div>
          )}
          
          {isExpanded && hasChildren && (
            <div className="mt-2">
              {node.children.map((child, i) => renderNode(child, depth + 1))}
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
          <CardTitle className="text-base">Test Variables</CardTitle>
          <CardDescription>Fill in values to preview resolved prompts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {variableDefinitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No variables defined in this template.</p>
          ) : (
            variableDefinitions.map(variable => (
              <div key={variable.name} className="space-y-1">
                <Label className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{`{{${variable.name}}}`}</span>
                  {variable.description && (
                    <span className="text-muted-foreground font-normal">— {variable.description}</span>
                  )}
                </Label>
                {variable.type === 'textarea' ? (
                  <Textarea
                    value={variableValues[variable.name] || ''}
                    onChange={(e) => setVariableValues(prev => ({ ...prev, [variable.name]: e.target.value }))}
                    placeholder={variable.default || `Enter ${variable.name}...`}
                    rows={3}
                  />
                ) : (
                  <Input
                    type={variable.type === 'number' ? 'number' : 'text'}
                    value={variableValues[variable.name] || ''}
                    onChange={(e) => setVariableValues(prev => ({ ...prev, [variable.name]: e.target.value }))}
                    placeholder={variable.default || `Enter ${variable.name}...`}
                  />
                )}
              </div>
            ))
          )}
          
          <Separator />
          
          <div className="flex items-center gap-4">
            <Button 
              variant={showResolved ? "default" : "outline"}
              onClick={() => setShowResolved(!showResolved)}
              size="sm"
            >
              <Play className="h-4 w-4 mr-2" />
              {showResolved ? 'Showing Resolved' : 'Show Resolved'}
            </Button>
            {showResolved && (
              <span className="text-xs text-muted-foreground">
                Variables are replaced with values
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Structure Preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Structure Preview</CardTitle>
          <CardDescription>
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
