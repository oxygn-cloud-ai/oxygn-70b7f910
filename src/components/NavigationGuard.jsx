import React, { useEffect } from 'react';
import { useApiCallContext } from '@/contexts/ApiCallContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';

/**
 * NavigationGuard displays a confirmation dialog when the user tries to navigate
 * away while API calls are in progress. It also warns on browser tab close.
 */
const NavigationGuard = () => {
  const {
    isApiCallInProgress,
    pendingCallsCount,
    cancelAllCalls,
    showNavigationDialog,
    pendingDestination,
    confirmNavigation,
    cancelNavigation,
  } = useApiCallContext();

  // Warn user when closing tab/window during API calls
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isApiCallInProgress) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isApiCallInProgress]);

  const handleStay = () => {
    cancelNavigation();
  };

  const handleContinueInBackground = () => {
    // Navigate but let calls continue running
    confirmNavigation();
  };

  const handleCancelAndNavigate = () => {
    cancelAllCalls();
    confirmNavigation();
  };

  if (!showNavigationDialog) return null;

  return (
    <AlertDialog open onOpenChange={(open) => !open && handleStay()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            API Call In Progress
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pendingCallsCount === 1
              ? 'An API call is currently running.'
              : `${pendingCallsCount} API calls are currently running.`}{' '}
            What would you like to do?
            {pendingDestination && (
              <span className="block mt-2 text-xs text-muted-foreground">
                Navigating to: {pendingDestination}
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={handleStay}>Stay on Page</AlertDialogCancel>
          <AlertDialogAction onClick={handleContinueInBackground} className="bg-primary">
            Continue in Background
          </AlertDialogAction>
          <AlertDialogAction
            onClick={handleCancelAndNavigate}
            className="bg-destructive hover:bg-destructive/90"
          >
            Cancel & Navigate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default NavigationGuard;
