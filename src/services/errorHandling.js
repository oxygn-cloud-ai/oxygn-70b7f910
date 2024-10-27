import { toast } from 'sonner';

export const handleSupabaseError = (error, operation) => {
  console.error(`Error ${operation}:`, error);
  if (error.message === 'Failed to fetch') {
    toast.error('Network error: Unable to connect to the database. Please check your internet connection.');
  } else {
    toast.error(`Error ${operation}: ${error.message}`);
  }
  throw error;
};