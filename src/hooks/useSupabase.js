import { supabase } from '@/integrations/supabase/client';

export const useSupabase = () => {
  return supabase;
};