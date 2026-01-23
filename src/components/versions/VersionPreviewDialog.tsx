import React from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { format } from 'date-fns';

const VersionPreviewDialog = ({ open, onOpenChange, snapshot, metadata }) => {
  if (!snapshot) return null;

  const sections = [
    { label: 'Prompt Name', field: 'prompt_name' },
    { label: 'System Prompt', field: 'input_admin_prompt' },
    { label: 'User Prompt', field: 'input_user_prompt' },
    { label: 'Note', field: 'note' },
    { label: 'Model', field: 'model' },
    { label: 'Temperature', field: 'temperature' },
    { label: 'Node Type', field: 'node_type' },
    { label: 'Post Action', field: 'post_action' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-outline-variant max-w-2xl max-h-[80vh]">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-title-sm text-on-surface font-medium">
              Version {metadata?.version_number} Preview
            </DialogTitle>
            {metadata && (
              <div className="text-[10px] text-on-surface-variant space-x-2 mt-1">
                <span>{format(new Date(metadata.created_at), 'PPpp')}</span>
                {metadata.tag_name && (
                  <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                    {metadata.tag_name}
                  </span>
                )}
              </div>
            )}
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onOpenChange(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
                >
                  <X className="h-4 w-4 text-on-surface-variant" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Close</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 p-1">
            {sections.map(({ label, field }) => {
              const value = snapshot[field];
              if (value === null || value === undefined || value === '') return null;

              return (
                <div key={field} className="bg-surface-container-low rounded-m3-md p-3">
                  <div className="text-label-sm text-on-surface-variant uppercase mb-2">
                    {label}
                  </div>
                  <div className="text-body-sm text-on-surface whitespace-pre-wrap">
                    {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                  </div>
                </div>
              );
            })}

            {/* Show all other non-null fields */}
            <details className="bg-surface-container-low rounded-m3-md p-3">
              <summary className="text-label-sm text-on-surface-variant uppercase cursor-pointer">
                All Fields
              </summary>
              <pre className="mt-2 text-[10px] text-on-surface-variant overflow-auto">
                {JSON.stringify(snapshot, null, 2)}
              </pre>
            </details>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default VersionPreviewDialog;
