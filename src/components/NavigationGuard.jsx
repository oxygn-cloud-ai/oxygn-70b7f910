import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

const getUrlKey = (loc) => `${loc.pathname}${loc.search}${loc.hash}`;

const NavigationGuard = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    isApiCallInProgress,
    pendingCallsCount,
    cancelAllCalls,
    showNavigationDialog,
    confirmNavigation,
    cancelNavigation,
    navigateWithGuard,
  } = useApiCallContext();

  const lastAllowedLocationRef = useRef(getUrlKey(location));
  const allowNextLocationRef = useRef(false);
  const internalRevertRef = useRef(false);

  // Keep track of the last "allowed" location even while calls run in the background.
  useEffect(() => {
    const current = getUrlKey(location);
    if (!isApiCallInProgress || allowNextLocationRef.current) {
      lastAllowedLocationRef.current = current;
      allowNextLocationRef.current = false;
    }
  }, [location, isApiCallInProgress]);

  // Block in-app link clicks while calls are in progress.
  useEffect(() => {
    const onClickCapture = (e) => {
      if (!isApiCallInProgress) return;
      if (e.defaultPrevented) return;

      // Let users open in new tab/window.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target;
      const anchor = target?.closest?.('a[href]');
      if (!anchor) return;

      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const hrefAttr = anchor.getAttribute('href');
      if (!hrefAttr) return;
      if (hrefAttr.startsWith('mailto:') || hrefAttr.startsWith('tel:')) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return; // external link

      const to = `${url.pathname}${url.search}${url.hash}`;
      const current = getUrlKey(location);
      if (to === current) return;

      e.preventDefault();
      e.stopPropagation();

      navigateWithGuard(() => {
        allowNextLocationRef.current = true;
        navigate(to);
      });
    };

    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, [isApiCallInProgress, location, navigate, navigateWithGuard]);

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

  // If the location changes while a call is running (e.g., back/forward or programmatic),
  // immediately revert and show the guard dialog.
  useEffect(() => {
    if (!isApiCallInProgress) return;
    if (showNavigationDialog) return;
    if (internalRevertRef.current) {
      internalRevertRef.current = false;
      return;
    }

    const current = getUrlKey(location);
    const lastAllowed = lastAllowedLocationRef.current;
    if (current === lastAllowed) return;

    internalRevertRef.current = true;
    navigate(lastAllowed, { replace: true });

    // After reverting, open the guard dialog with the user's intended destination.
    queueMicrotask(() => {
      navigateWithGuard(() => {
        allowNextLocationRef.current = true;
        navigate(current, { replace: true });
      });
    });
  }, [isApiCallInProgress, location, navigate, navigateWithGuard, showNavigationDialog]);

  const handleCancel = () => {
    cancelAllCalls();
    allowNextLocationRef.current = true;
    confirmNavigation();
  };

  const handleContinueInBackground = () => {
    allowNextLocationRef.current = true;
    confirmNavigation();
  };

  const handleStay = () => {
    cancelNavigation();
  };

  if (!showNavigationDialog) return null;

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
              : `${pendingCallsCount} API calls are currently running.`}{' '}
            What would you like to do?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={handleStay}>Stay on Page</AlertDialogCancel>
          <AlertDialogAction onClick={handleContinueInBackground} className="bg-primary">
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

