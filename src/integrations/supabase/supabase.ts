import { createClient } from '@supabase/supabase-js';
import type { Database } from './types/tables';

const supabaseUrl = import.meta.env.VITE_SUPABASE_PROJECT_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase configuration missing. Please check your environment variables.');
}

export const supabase = createClient<Database>(
  supabaseUrl || '',
  supabaseKey || ''
);