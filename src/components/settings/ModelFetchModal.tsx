import React, { useState, useMemo } from 'react';
import { X, Check, AlertCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ModelFetchModalProps, FetchedModel, EditedModelsMap, EditedModelFields } from './types';

const ModelFetchModal: React.FC<ModelFetchModalProps> = ({ 
  open, 
  onOpenChange, 
  provider, 
  fetchedModels = [], 
  existingModels = [],
  onAddModels,
  isAdding = false 
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editedModels, setEditedModels] = useState<EditedModelsMap>({});

  // Get existing model IDs and api_model_ids for duplicate checking
  const existingIds = useMemo(() => {
    const ids = new Set<string>();
    existingModels.forEach(m => {
      if (m.model_id) ids.add(m.model_id.toLowerCase());
      if (m.api_model_id) ids.add(m.api_model_id.toLowerCase());
    });
    return ids;
  }, [existingModels]);

  // Check if a model already exists
  const modelExists = (model: FetchedModel): boolean => {
    return existingIds.has(model.model_id?.toLowerCase() || '') || 
           existingIds.has(model.api_model_id?.toLowerCase() || '');
  };

  // Get available (non-existing) models
  const availableModels = useMemo(() => {
    return fetchedModels.filter(m => !modelExists(m));
  }, [fetchedModels, existingIds]);

  // Toggle selection
  const toggleSelect = (modelId: string): void => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  };

  // Select all available
  const toggleSelectAll = (): void => {
    if (selectedIds.size === availableModels.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(availableModels.map(m => m.model_id)));
    }
  };

  // Update editable field
  const updateField = (modelId: string, field: keyof EditedModelFields, value: string): void => {
    setEditedModels(prev => ({
      ...prev,
      [modelId]: {
        ...(prev[modelId] || {}),
        [field]: value
      }
    }));
  };

  // Get effective value (edited or original)
  const getValue = <K extends keyof FetchedModel>(model: FetchedModel, field: K): FetchedModel[K] | string => {
    const edited = editedModels[model.model_id]?.[field as keyof EditedModelFields];
    return edited !== undefined ? edited : model[field];
  };

  // Handle add
  const handleAdd = (): void => {
    const modelsToAdd: FetchedModel[] = availableModels
      .filter(m => selectedIds.has(m.model_id))
      .map(m => ({
        ...m,
        model_name: getValue(m, 'model_name') as string | undefined,
        context_window: getValue(m, 'context_window') ? parseInt(String(getValue(m, 'context_window'))) : null,
        max_output_tokens: getValue(m, 'max_output_tokens') ? parseInt(String(getValue(m, 'max_output_tokens'))) : null,
        input_cost_per_million: getValue(m, 'input_cost_per_million') ? parseFloat(String(getValue(m, 'input_cost_per_million'))) : null,
        output_cost_per_million: getValue(m, 'output_cost_per_million') ? parseFloat(String(getValue(m, 'output_cost_per_million'))) : null,
      }));
    
    onAddModels?.(modelsToAdd);
  };

  // Reset state when closing
  const handleOpenChange = (isOpen: boolean): void => {
    if (!isOpen) {
      setSelectedIds(new Set());
      setEditedModels({});
    }
    onOpenChange(isOpen);
  };

  const providerName = provider === 'openai' ? 'OpenAI' : provider === 'google' ? 'Gemini' : provider;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] bg-surface border-outline-variant">
        <DialogHeader>
          <DialogTitle className="text-title-sm text-on-surface font-medium flex items-center gap-2">
            Fetch {providerName} Models
            <span className="text-body-sm text-on-surface-variant font-normal">
              ({fetchedModels.length} found, {availableModels.length} available)
            </span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[50vh]">
          <div className="space-y-1 p-1">
            {/* Header */}
            <div className="grid grid-cols-[32px,1fr,100px,100px,80px,80px] gap-2 px-2 py-2 text-[10px] text-on-surface-variant uppercase tracking-wider sticky top-0 bg-surface z-10 border-b border-outline-variant">
              <div className="flex items-center justify-center">
                <Checkbox
                  checked={availableModels.length > 0 && selectedIds.size === availableModels.length}
                  onCheckedChange={toggleSelectAll}
                  disabled={availableModels.length === 0}
                  className="h-3.5 w-3.5"
                />
              </div>
              <span>Model ID</span>
              <span>Context</span>
              <span>Max Output</span>
              <span>Input $</span>
              <span>Output $</span>
            </div>

            {/* Rows */}
            {fetchedModels.length === 0 ? (
              <div className="py-8 text-center text-body-sm text-on-surface-variant">
                No models found
              </div>
            ) : (
              fetchedModels.map((model) => {
                const exists = modelExists(model);
                const isSelected = selectedIds.has(model.model_id);
                const hasNullFields = !model.context_window || !model.max_output_tokens;

                return (
                  <div 
                    key={model.model_id}
                    className={`grid grid-cols-[32px,1fr,100px,100px,80px,80px] gap-2 px-2 py-2 items-center rounded-m3-sm ${
                      exists ? 'opacity-50 bg-surface-container-low' : 
                      isSelected ? 'bg-primary/5' : 'hover:bg-surface-container-low'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="flex items-center justify-center">
                      {exists ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <Check className="h-4 w-4 text-green-600" />
                          </TooltipTrigger>
                          <TooltipContent className="text-[10px]">Already added</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(model.model_id)}
                          className="h-3.5 w-3.5"
                        />
                      )}
                    </div>

                    {/* Model ID and Name */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-body-sm text-on-surface font-medium truncate">
                          {model.model_id}
                        </span>
                        {hasNullFields && !exists && (
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent className="text-[10px]">
                              Some fields need to be filled manually
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      {model.model_name !== model.model_id && (
                        <span className="text-[10px] text-on-surface-variant truncate block">
                          {model.model_name}
                        </span>
                      )}
                    </div>

                    {/* Context Window */}
                    <input
                      type="number"
                      value={String(getValue(model, 'context_window') || '')}
                      onChange={(e) => updateField(model.model_id, 'context_window', e.target.value)}
                      disabled={exists}
                      placeholder="—"
                      className="h-7 px-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface text-right focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    />

                    {/* Max Output */}
                    <input
                      type="number"
                      value={String(getValue(model, 'max_output_tokens') || '')}
                      onChange={(e) => updateField(model.model_id, 'max_output_tokens', e.target.value)}
                      disabled={exists}
                      placeholder="—"
                      className="h-7 px-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface text-right focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    />

                    {/* Input Cost */}
                    <input
                      type="number"
                      step="0.01"
                      value={String(getValue(model, 'input_cost_per_million') || '')}
                      onChange={(e) => updateField(model.model_id, 'input_cost_per_million', e.target.value)}
                      disabled={exists}
                      placeholder="—"
                      className="h-7 px-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface text-right focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    />

                    {/* Output Cost */}
                    <input
                      type="number"
                      step="0.01"
                      value={String(getValue(model, 'output_cost_per_million') || '')}
                      onChange={(e) => updateField(model.model_id, 'output_cost_per_million', e.target.value)}
                      disabled={exists}
                      placeholder="—"
                      className="h-7 px-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface text-right focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-outline-variant">
          <span className="text-body-sm text-on-surface-variant">
            {selectedIds.size} model{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleOpenChange(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container"
                >
                  <X className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Cancel</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleAdd}
                  disabled={selectedIds.size === 0 || isAdding}
                  className="px-4 h-8 bg-primary text-on-primary text-body-sm rounded-m3-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>Add {selectedIds.size} Model{selectedIds.size !== 1 ? 's' : ''}</>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Add selected models to database</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ModelFetchModal;
