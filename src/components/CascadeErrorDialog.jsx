import React from 'react';
import { useCascadeRun } from '@/contexts/CascadeRunContext';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, SkipForward, RefreshCw, StopCircle } from 'lucide-react';

const CascadeErrorDialog = () => {
  const { error, errorPrompt, resolveError, isRunning } = useCascadeRun();

  const isOpen = isRunning && !!error && !!errorPrompt;

  if (!isOpen) return null;

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Cascade Run Error
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                An error occurred while running prompt:{' '}
                <strong className="text-foreground">{errorPrompt?.name}</strong>
              </p>
              <div className="p-3 bg-destructive/10 rounded-md border border-destructive/20">
                <p className="text-sm text-destructive font-mono break-all">
                  {error}
                </p>
              </div>
              <p className="text-sm">
                How would you like to proceed?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => resolveError('stop')}
            className="gap-2"
          >
            <StopCircle className="h-4 w-4" />
            Stop Cascade
          </Button>
          <Button
            variant="outline"
            onClick={() => resolveError('skip')}
            className="gap-2"
          >
            <SkipForward className="h-4 w-4" />
            Skip & Continue
          </Button>
          <Button
            onClick={() => resolveError('retry')}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default CascadeErrorDialog;
