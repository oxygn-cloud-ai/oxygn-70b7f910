import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_PROJECT_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_API_KEY;

// Validate Supabase configuration
if (!supabaseUrl || !supabaseAnonKey) {
  const error = new Error('Supabase configuration is missing. Please check your environment variables.');
  console.error('Supabase Error:', {
    url: supabaseUrl ? 'present' : 'missing',
    key: supabaseAnonKey ? 'present' : 'missing'
  });
  toast.error(error.message);
  throw error;
}

// Create and export Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});