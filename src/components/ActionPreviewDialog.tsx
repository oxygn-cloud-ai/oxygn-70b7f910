/**
 * ActionPreviewDialog
 * 
 * Preview dialog shown before creating child prompts from an action node.
 * Shows how many children will be created, their names, and where they will be placed.
 */

import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  GitBranch, 
  FileText, 
  FolderTree,
  CheckCircle2,
} from 'lucide-react';

// Type definitions
interface ActionPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jsonResponse: Record<string, unknown> | null;
  config: {
    json_path?: string | string[];
    name_field?: string;
    content_field?: string;
    placement?: 'children' | 'siblings' | 'top_level' | 'specific_prompt';
    target_prompt_id?: string;
  } | null;
  promptName: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface PreviewItem {
  name: string;
  contentPreview: string;
}

interface AnalysisResult {
  items: PreviewItem[];
  error: string | null;
  availableArrays?: string[];
}

/**
 * Get a nested value from an object using dot notation
 */
const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
  if (!path || path === 'root') return obj;
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj);
};

const ActionPreviewDialog: React.FC<ActionPreviewDialogProps> = ({
  open,
  onOpenChange,
  jsonResponse,
  config,
  promptName,
  onConfirm,
  onCancel,
}) => {
  const {
    json_path = 'sections',
    name_field = 'prompt_name',
    content_field = 'input_admin_prompt',
    placement = 'children',
    target_prompt_id,
  } = config || {};

  // Extract and analyze the items that will be created
  const analysisResult = useMemo((): AnalysisResult => {
    if (!jsonResponse) {
      return { items: [], error: 'No JSON response' };
    }

    const effectivePath = Array.isArray(json_path) ? json_path[0] : json_path;
    const items = getNestedValue(jsonResponse, effectivePath);

    if (!Array.isArray(items)) {
      const availableArrays = Object.keys(jsonResponse || {})
        .filter(k => Array.isArray((jsonResponse as Record<string, unknown>)[k]));
      return {
        items: [],
        error: `Path "${effectivePath}" is not an array`,
        availableArrays,
      };
    }

    // Extract names for preview
    const previewItems: PreviewItem[] = items.map((item: Record<string, unknown>, idx: number) => {
      let name = 'Unnamed';
      
      // Try configured name field
      if (name_field && item[name_field]) {
        name = String(item[name_field]);
      }
      // Auto-detect common name fields
      else if (item.title) name = String(item.title);
      else if (item.name) name = String(item.name);
      else if (item.prompt_name) name = String(item.prompt_name);
      else if (item.heading) name = String(item.heading);
      else if (typeof item === 'string') name = (item as string).slice(0, 50);
      else name = `Item ${idx + 1}`;

      // Get content preview
      let contentPreview = '';
      if (content_field && item[content_field]) {
        contentPreview = String(item[content_field]).slice(0, 100);
      } else if (item.content) {
        contentPreview = String(item.content).slice(0, 100);
      } else if (item.description) {
        contentPreview = String(item.description).slice(0, 100);
      }

      return {
        name,
        contentPreview: contentPreview + (contentPreview.length >= 100 ? '...' : ''),
      };
    });

    return { items: previewItems, error: null };
  }, [jsonResponse, json_path, name_field, content_field]);

  const placementLabel = useMemo(() => {
    switch (placement) {
      case 'children': return `As children of "${promptName}"`;
      case 'siblings': return `As siblings of "${promptName}"`;
      case 'top_level': return 'At the top level (root)';
      case 'specific_prompt': return target_prompt_id 
        ? `Under specific prompt: ${target_prompt_id.slice(0, 8)}...`
        : 'Under specific prompt (not set)';
      default: return placement;
    }
  }, [placement, promptName, target_prompt_id]);

  const handleConfirm = () => {
    onConfirm?.();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-surface border-outline-variant">
        <DialogHeader>
          <DialogTitle className="text-title-sm flex items-center gap-2 text-on-surface">
            <GitBranch className="h-4 w-4 text-primary" />
            Create Child Prompts
          </DialogTitle>
          <DialogDescription className="text-body-sm text-on-surface-variant">
            Review the prompts that will be created from the AI response.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Error State */}
          {analysisResult.error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-m3-sm">
              <p className="text-body-sm text-red-500">{analysisResult.error}</p>
              {analysisResult.availableArrays && analysisResult.availableArrays.length > 0 && (
                <p className="text-[10px] text-on-surface-variant mt-1">
                  Available arrays: {analysisResult.availableArrays.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Summary */}
          {!analysisResult.error && (
            <>
              <div className="flex items-center gap-3 p-3 bg-surface-container rounded-m3-sm">
                <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-m3-full">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-body-sm font-medium text-on-surface">
                    {analysisResult.items.length} prompt{analysisResult.items.length !== 1 ? 's' : ''} will be created
                  </p>
                  <p className="text-[10px] text-on-surface-variant flex items-center gap-1">
                    <FolderTree className="h-3 w-3" />
                    {placementLabel}
                  </p>
                </div>
              </div>

              {/* Items Preview */}
              <div className="space-y-2">
                <p className="text-label-sm text-on-surface-variant">
                  Preview (first {Math.min(5, analysisResult.items.length)} items):
                </p>
                <ScrollArea className="h-48">
                  <div className="space-y-2 pr-4">
                    {analysisResult.items.slice(0, 5).map((item, idx) => (
                      <div 
                        key={idx}
                        className="p-2 bg-surface-container-low rounded-m3-sm border border-outline-variant"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                            {idx + 1}
                          </Badge>
                          <span className="text-body-sm text-on-surface font-medium truncate">
                            {item.name}
                          </span>
                        </div>
                        {item.contentPreview && (
                          <p className="text-[10px] text-on-surface-variant mt-1 line-clamp-2">
                            {item.contentPreview}
                          </p>
                        )}
                      </div>
                    ))}
                    {analysisResult.items.length > 5 && (
                      <p className="text-[10px] text-on-surface-variant text-center py-2">
                        ...and {analysisResult.items.length - 5} more
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={handleCancel}
            className="text-on-surface-variant"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!!analysisResult.error || analysisResult.items.length === 0}
            className="gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            Create {analysisResult.items.length} Prompt{analysisResult.items.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ActionPreviewDialog;
