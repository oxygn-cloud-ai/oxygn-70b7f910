import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, Globe, Calendar, Hash, Braces, GitBranch } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

const CATEGORIES = [
  { value: 'general', label: 'General', color: 'bg-muted text-muted-foreground' },
  { value: 'marketing', label: 'Marketing', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  { value: 'technical', label: 'Technical', color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  { value: 'creative', label: 'Creative', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  { value: 'business', label: 'Business', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
];

/**
 * Overview tab for template metadata
 */
const TemplateOverviewTab = ({ template, onChange }) => {
  const categoryInfo = CATEGORIES.find(c => c.value === template.category) || CATEGORIES[0];

  // Count nodes in structure
  const countNodes = (node) => {
    if (!node) return 0;
    let count = 1;
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => {
        count += countNodes(child);
      });
    }
    return count;
  };

  const nodeCount = countNodes(template.structure);
  const variableCount = template.variable_definitions?.length || 0;

  return (
    <TooltipProvider>
    <div className="space-y-4 max-w-2xl">
      {/* Basic Info */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={template.template_name || ''}
              onChange={(e) => onChange('template_name', e.target.value)}
              placeholder="Template name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              value={template.template_description || ''}
              onChange={(e) => onChange('template_description', e.target.value)}
              placeholder="Describe what this template is for..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Category & Privacy */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select 
              value={template.category || 'general'} 
              onValueChange={(v) => onChange('category', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-[10px] ${cat.color}`}>
                        {cat.label}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                {template.is_private ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                Private Template
              </Label>
              <p className="text-xs text-muted-foreground">
                {template.is_private 
                  ? 'Only you can see and use this template' 
                  : 'Anyone in your organization can use this template'}
              </p>
            </div>
            <Switch
              checked={template.is_private || false}
              onCheckedChange={(checked) => onChange('is_private', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats - compact inline */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex items-center gap-1">
              <GitBranch className="h-3.5 w-3.5" />
              {nodeCount}
            </span>
          </TooltipTrigger>
          <TooltipContent>Prompt nodes</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex items-center gap-1">
              <Braces className="h-3.5 w-3.5" />
              {variableCount}
            </span>
          </TooltipTrigger>
          <TooltipContent>Variables</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {template.created_at ? new Date(template.created_at).toLocaleDateString() : 'N/A'}
            </span>
          </TooltipTrigger>
          <TooltipContent>Created</TooltipContent>
        </Tooltip>
        <span className="text-muted-foreground/60">v{template.version || 1}</span>
      </div>
    </div>
    </TooltipProvider>
  );
};

export default TemplateOverviewTab;
