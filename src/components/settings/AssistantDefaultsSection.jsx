import React, { useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bot, RefreshCw, Save } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAssistantToolDefaults } from '@/hooks/useAssistantToolDefaults';

export function AssistantDefaultsSection({
  isRefreshing,
  onRefresh,
}) {
  const {
    toolDefaults,
    isLoading,
    updateToolDefault,
    refetch,
  } = useAssistantToolDefaults();

  useEffect(() => {
    if (onRefresh) {
      refetch();
    }
  }, [isRefreshing]);

  const handleToggle = async (key, value) => {
    await updateToolDefault(key, value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-muted-foreground">Loading assistant defaults...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Assistant Defaults</h2>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="bg-transparent"
                onClick={onRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Default Tool Settings</CardTitle>
          <CardDescription>
            Default tools enabled for new Assistants. Individual Assistants can override these settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Code Interpreter</Label>
              <p className="text-xs text-muted-foreground">
                Allows the Assistant to write and run Python code
              </p>
            </div>
            <Switch
              checked={toolDefaults?.code_interpreter_enabled ?? true}
              onCheckedChange={(checked) => handleToggle('code_interpreter_enabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>File Search</Label>
              <p className="text-xs text-muted-foreground">
                Enables searching through uploaded files using vector stores
              </p>
            </div>
            <Switch
              checked={toolDefaults?.file_search_enabled ?? true}
              onCheckedChange={(checked) => handleToggle('file_search_enabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Function Calling</Label>
              <p className="text-xs text-muted-foreground">
                Allows defining custom functions for the Assistant to call
              </p>
            </div>
            <Switch
              checked={toolDefaults?.function_calling_enabled ?? false}
              onCheckedChange={(checked) => handleToggle('function_calling_enabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default Thread Mode</CardTitle>
          <CardDescription>
            Default thread behavior for new child prompts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select defaultValue="new">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">
                New Thread - Create fresh conversation for each execution
              </SelectItem>
              <SelectItem value="reuse">
                Reuse Thread - Maintain conversation history
              </SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    </div>
  );
}
