import { toast } from '@/components/ui/sonner';

export const handleSupabaseError = (error, operation) => {
  console.error(`Error ${operation}:`, error);
  if (error.message === 'Failed to fetch') {
    toast.error('Network error: Unable to connect to the database. Please check your internet connection.', {
      source: 'errorHandling.handleSupabaseError',
      errorCode: 'NETWORK_ERROR',
      details: JSON.stringify({ operation, error: error?.message, stack: error?.stack }, null, 2),
    });
  } else {
    toast.error(`Error ${operation}: ${error.message}`, {
      source: 'errorHandling.handleSupabaseError',
      errorCode: error?.code || 'SUPABASE_ERROR',
      details: JSON.stringify({ operation, error: error?.message, code: error?.code, stack: error?.stack }, null, 2),
    });
  }
  throw error;
};