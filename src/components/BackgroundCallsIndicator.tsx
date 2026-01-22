import React from 'react';
import { useApiCallContext } from '@/contexts/ApiCallContext';
import { Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TOOLTIPS } from '@/config/labels';

/**
 * A floating indicator that shows when API calls are in progress.
 */
const BackgroundCallsIndicator = () => {
  // Disabled - no longer showing floating indicator
  return null;
};

export default BackgroundCallsIndicator;
