import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

// Create Supabase client immediately since env vars are verified in main.jsx
const supabaseUrl = import.meta.env.VITE_SUPABASE_PROJECT_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_API_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);