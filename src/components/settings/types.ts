// Types for settings components

export interface KeyValidation {
  success: boolean;
  message: string;
  fingerprint?: string;
  projectCount?: number;
}

export interface ConnectionStatus {
  success: boolean;
  message: string;
}

export interface FetchedModel {
  model_id: string;
  api_model_id?: string;
  model_name?: string;
  context_window?: number | null;
  max_output_tokens?: number | null;
  input_cost_per_million?: number | null;
  output_cost_per_million?: number | null;
  provider?: string;
}

export interface ExistingModel {
  row_id: string;
  model_id: string;
  api_model_id?: string;
  model_name?: string;
  context_window?: number | null;
  max_output_tokens?: number | null;
  input_cost_per_million?: number | null;
  output_cost_per_million?: number | null;
  provider?: string;
  is_active?: boolean;
}

export interface ModelFetchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: string;
  fetchedModels: FetchedModel[];
  existingModels: ExistingModel[];
  onAddModels?: (models: FetchedModel[]) => void;
  isAdding?: boolean;
}

export interface EditedModelFields {
  model_name?: string;
  context_window?: string;
  max_output_tokens?: string;
  input_cost_per_million?: string;
  output_cost_per_million?: string;
}

export type EditedModelsMap = Record<string, EditedModelFields>;
