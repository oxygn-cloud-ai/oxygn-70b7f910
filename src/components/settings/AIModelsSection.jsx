import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bot, Plus, Trash2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { ModelSettingsPanel } from '../InlineModelSettings';
import { ALL_SETTINGS } from '../../config/modelCapabilities';
import { toast } from '@/components/ui/sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TOOLTIPS } from '@/config/labels';

export function AIModelsSection({
  models,
  modelsLoading,
  modelDefaults,
  toggleModelActive,
  addModel,
  deleteModel,
  updateModelDefault,
  isRefreshing,
  onRefresh,
}) {
  const [isAddModelDialogOpen, setIsAddModelDialogOpen] = useState(false);
  const [expandedModels, setExpandedModels] = useState({});
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelProvider, setNewModelProvider] = useState('openai');

  const toggleModelExpanded = (modelId) => {
    setExpandedModels(prev => ({
      ...prev,
      [modelId]: !prev[modelId]
    }));
  };

  const handleAddModel = async () => {
    if (!newModelId.trim() || !newModelName.trim()) {
      toast.error('Model ID and name are required');
      return;
    }

    const result = await addModel(newModelId.trim(), newModelName.trim(), newModelProvider);
    if (result) {
      setNewModelId('');
      setNewModelName('');
      setNewModelProvider('openai');
      setIsAddModelDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">AI Models</h2>
            <p className="text-sm text-muted-foreground">Configure available AI models for prompts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{TOOLTIPS.actions.refresh}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Dialog open={isAddModelDialogOpen} onOpenChange={setIsAddModelDialogOpen}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>{TOOLTIPS.settings.addModel}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Model</DialogTitle>
                <DialogDescription>Add a new AI model to the available options</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="modelId">Model ID</Label>
                  <Input
                    id="modelId"
                    placeholder="e.g., gpt-4o-mini"
                    value={newModelId}
                    onChange={(e) => setNewModelId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modelName">Display Name</Label>
                  <Input
                    id="modelName"
                    placeholder="e.g., GPT-4o Mini"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <Select value={newModelProvider} onValueChange={setNewModelProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddModelDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddModel}>Add Model</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div>
        {modelsLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading models...</div>
        ) : models.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No models configured. Click the + button to add one.
          </div>
        ) : (
          <div className="space-y-2">
            {models.map((model) => {
              const isExpanded = expandedModels[model.model_id];
              const defaultsCount = Object.keys(ALL_SETTINGS).filter(
                key => modelDefaults[model.model_id]?.[`${key}_on`]
              ).length;
              
              return (
                <Collapsible 
                  key={model.row_id} 
                  open={isExpanded}
                  onOpenChange={() => toggleModelExpanded(model.model_id)}
                >
                  <div className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-3 bg-background">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-medium">{model.model_name}</div>
                          <code className="text-xs text-muted-foreground">{model.model_id}</code>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {model.provider || 'unknown'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={model.is_active}
                            onCheckedChange={(checked) => toggleModelActive(model.row_id, checked)}
                          />
                          <span className={`text-sm ${model.is_active ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {model.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleModelExpanded(model.model_id)}
                          className="h-8 w-8"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                        {defaultsCount > 0 && !isExpanded && (
                          <span className="text-xs text-muted-foreground">
                            ({defaultsCount})
                          </span>
                        )}
                        
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteModel(model.row_id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete model</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    
                    <CollapsibleContent>
                      <ModelSettingsPanel
                        model={model}
                        defaults={modelDefaults[model.model_id]}
                        onUpdateDefault={updateModelDefault}
                      />
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
