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

const NavigationGuard = () => {
  const { 
    isApiCallInProgress, 
    pendingCallsCount, 
    cancelAllCalls,
    showNavigationDialog,
    setShowNavigationDialog,
    pendingNavigation,
    confirmNavigation,
    cancelNavigation,
  } = useApiCallContext();

  // Handle browser back/forward and tab close
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

  const handleCancel = () => {
    cancelAllCalls();
    confirmNavigation();
  };

  const handleContinueInBackground = () => {
    // Allow navigation but let calls continue
    confirmNavigation();
  };

  const handleStay = () => {
    cancelNavigation();
  };

  if (!showNavigationDialog) {
    return null;
  }

  return (
    <AlertDialog open={true} onOpenChange={(open) => !open && handleStay()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            API Call In Progress
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pendingCallsCount === 1 
              ? 'An API call is currently running.' 
              : `${pendingCallsCount} API calls are currently running.`}
            {' '}What would you like to do?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={handleStay}>
            Stay on Page
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleContinueInBackground}
            className="bg-primary"
          >
            Continue in Background
          </AlertDialogAction>
          <AlertDialogAction 
            onClick={handleCancel}
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
