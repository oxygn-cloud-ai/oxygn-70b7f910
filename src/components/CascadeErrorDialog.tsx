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
import { AlertTriangle, SkipForward, RefreshCw, StopCircle, FileQuestion, AlertCircle, LucideIcon } from 'lucide-react';

interface ErrorDetails {
  type: string;
  icon?: LucideIcon;
  suggestion: string | null;
}

// Helper to parse error and provide actionable suggestions
const getErrorDetails = (error: string | null): ErrorDetails => {
  if (!error) return { type: 'unknown', suggestion: null };
  
  const errorLower = error.toLowerCase();
  
  if (errorLower.includes('no message to send') || errorLower.includes('no_message_content')) {
    return {
      type: 'no_content',
      icon: FileQuestion,
      suggestion: 'Add content to the user prompt or admin prompt field for this prompt.',
    };
  }
  
  if (errorLower.includes('rate limit') || errorLower.includes('429')) {
    return {
      type: 'rate_limit',
      icon: AlertCircle,
      suggestion: 'Rate limited by OpenAI. Click Retry to wait and try again.',
    };
  }
  
  if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
    return {
      type: 'timeout',
      icon: AlertCircle,
      suggestion: 'The request timed out. Try again or reduce prompt complexity.',
    };
  }
  
  return { type: 'unknown', icon: AlertTriangle, suggestion: null };
};

const CascadeErrorDialog: React.FC = () => {
  const { error, errorPrompt, resolveError, isRunning } = useCascadeRun();

  const isOpen = isRunning && !!error && !!errorPrompt;
  const errorDetails = getErrorDetails(error);
  const ErrorIcon = errorDetails.icon || AlertTriangle;

  if (!isOpen) return null;

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <ErrorIcon className="h-5 w-5" />
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
              {errorDetails.suggestion && (
                <div className="p-2 bg-muted/50 rounded-md border">
                  <p className="text-sm text-muted-foreground">
                    <strong>Suggestion:</strong> {errorDetails.suggestion}
                  </p>
                </div>
              )}
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
