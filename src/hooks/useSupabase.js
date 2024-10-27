import { supabase } from '../lib/supabase';

export const useSupabase = () => {
  // Instead of managing state, just return the supabase instance directly
  return supabase;
};