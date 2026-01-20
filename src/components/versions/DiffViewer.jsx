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
import { cn } from '@/lib/utils';

const DiffViewer = ({ open, onOpenChange, changes, versionInfo }) => {

  const renderTextDiff = (textDiff) => {
    if (!textDiff || textDiff.length === 0) {
      return <div className="text-on-surface-variant text-body-sm italic">No text changes</div>;
    }

    return (
      <div className="font-mono text-[11px] space-y-0">
        {textDiff.map((line, idx) => (
          <div
            key={idx}
            className={cn(
              'px-2 py-0.5',
              line.type === 'added' && 'bg-green-500/10 text-green-700',
              line.type === 'removed' && 'bg-red-500/10 text-red-700',
              line.type === 'unchanged' && 'text-on-surface-variant'
            )}
          >
            <span className="inline-block w-8 text-on-surface-variant opacity-50">
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </span>
            {line.content || '\u00A0'}
          </div>
        ))}
      </div>
    );
  };

  const renderDeepDiff = (deepDiff) => {
    if (!deepDiff || deepDiff.length === 0) {
      return <div className="text-on-surface-variant text-body-sm italic">No changes</div>;
    }

    return (
      <div className="space-y-1">
        {deepDiff.map((change, idx) => (
          <div key={idx} className="text-[11px] font-mono">
            <span className="text-on-surface-variant">{change.path}: </span>
            {change.type === 'added' && (
              <span className="text-green-600">+ {JSON.stringify(change.newValue)}</span>
            )}
            {change.type === 'removed' && (
              <span className="text-red-600">- {JSON.stringify(change.oldValue)}</span>
            )}
            {change.type === 'modified' && (
              <>
                <span className="text-red-600">{JSON.stringify(change.oldValue)}</span>
                <span className="text-on-surface-variant"> → </span>
                <span className="text-green-600">{JSON.stringify(change.newValue)}</span>
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderSimpleDiff = (change) => {
    return (
      <div className="text-body-sm space-y-1">
        {change.oldValue !== undefined && (
          <div className="bg-red-500/10 p-2 rounded-m3-sm">
            <span className="text-red-600">- </span>
            <span className="text-on-surface">{String(change.oldValue)}</span>
          </div>
        )}
        {change.newValue !== undefined && (
          <div className="bg-green-500/10 p-2 rounded-m3-sm">
            <span className="text-green-600">+ </span>
            <span className="text-on-surface">{String(change.newValue)}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-outline-variant max-w-3xl max-h-[80vh]">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-title-sm text-on-surface font-medium">
            Changes {versionInfo && `(vs v${versionInfo.version_number})`}
          </DialogTitle>
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
            {(!changes || changes.length === 0) ? (
              <div className="text-center py-8 text-on-surface-variant text-body-sm">
                No differences found
              </div>
            ) : (
              changes.map((change, idx) => (
                <div key={idx} className="bg-surface-container-low rounded-m3-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-label-sm text-on-surface-variant uppercase">
                      {change.field.replace(/_/g, ' ')}
                    </span>
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded',
                      change.type === 'added' && 'bg-green-500/10 text-green-600',
                      change.type === 'removed' && 'bg-red-500/10 text-red-600',
                      change.type === 'modified' && 'bg-amber-500/10 text-amber-600'
                    )}>
                      {change.type}
                    </span>
                  </div>

                  {change.textDiff && renderTextDiff(change.textDiff)}
                  {change.deepDiff && renderDeepDiff(change.deepDiff)}
                  {!change.textDiff && !change.deepDiff && renderSimpleDiff(change)}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default DiffViewer;
