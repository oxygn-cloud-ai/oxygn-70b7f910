import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

let supabase = null;

const initializeSupabase = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_PROJECT_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_API_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables not available yet');
    return null;
  }

  try {
    return createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('Error initializing Supabase client:', error);
    toast.error('Failed to initialize Supabase client');
    return null;
  }
};

export const getSupabaseClient = () => {
  if (!supabase) {
    supabase = initializeSupabase();
  }
  return supabase;
};

// Initialize the client
supabase = initializeSupabase();

export { supabase };