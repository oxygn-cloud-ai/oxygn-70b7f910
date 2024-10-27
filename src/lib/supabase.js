import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

const supabaseUrl = import.meta.env.VITE_SUPABASE_PROJECT_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_API_KEY;

if (!supabaseUrl) {
  toast.error('VITE_SUPABASE_PROJECT_URL environment variable is not set');
  throw new Error('VITE_SUPABASE_PROJECT_URL environment variable is not set');
}

if (!supabaseAnonKey) {
  toast.error('VITE_SUPABASE_API_KEY environment variable is not set');
  throw new Error('VITE_SUPABASE_API_KEY environment variable is not set');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);