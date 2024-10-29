import { supabase } from '../integrations/supabase/supabase';

export const useSupabase = () => {
  return supabase;
};