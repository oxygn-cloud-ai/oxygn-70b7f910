import { toast } from '@/components/ui/sonner';

export const handleSupabaseError = (error: Error & { code?: string }, operation: string) => {
  console.error(`Error ${operation}:`, error);
  
  // Only include stack traces in development mode to prevent credential exposure
  const errorDetails = {
    operation,
    error: error?.message,
    code: error?.code,
    ...(import.meta.env.DEV && { stack: error?.stack }),
  };
  
  if (error.message === 'Failed to fetch') {
    toast.error('Network error: Unable to connect to the database. Please check your internet connection.', {
      source: 'errorHandling.handleSupabaseError',
      errorCode: 'NETWORK_ERROR',
      details: JSON.stringify(errorDetails, null, 2),
    });
  } else {
    toast.error(`Error ${operation}: ${error.message}`, {
      source: 'errorHandling.handleSupabaseError',
      errorCode: error?.code || 'SUPABASE_ERROR',
      details: JSON.stringify(errorDetails, null, 2),
    });
  }
  throw error;
};
