import { createClient } from '@supabase/supabase-js';

// TODO: Replace with your Supabase project's URL and anon key
const supabaseUrl = 'YOUR_SUPABASE_PROJECT_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);