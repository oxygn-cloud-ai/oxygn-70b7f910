import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

export const useSupabase = (): SupabaseClient<Database> => {
  return supabase;
};
