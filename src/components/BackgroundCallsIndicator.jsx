import React from 'react';
import { useApiCallContext } from '@/contexts/ApiCallContext';
import { Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * A floating indicator that shows when API calls are in progress.
 */
const BackgroundCallsIndicator = () => {
  const { pendingCallsCount } = useApiCallContext();

  if (pendingCallsCount === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-full shadow-lg cursor-default">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">
              {pendingCallsCount} {pendingCallsCount === 1 ? 'call' : 'calls'} in progress
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>API calls are running. They will complete even if you navigate away.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default BackgroundCallsIndicator;
