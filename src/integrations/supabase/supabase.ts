import { createClient } from '@supabase/supabase-js';
import type { Database } from './types/tables';

if (!import.meta.env.VITE_SUPABASE_PROJECT_URL) {
  throw new Error('VITE_SUPABASE_PROJECT_URL environment variable is not set');
}

if (!import.meta.env.VITE_SUPABASE_API_KEY) {
  throw new Error('VITE_SUPABASE_API_KEY environment variable is not set');
}

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_PROJECT_URL,
  import.meta.env.VITE_SUPABASE_API_KEY
);