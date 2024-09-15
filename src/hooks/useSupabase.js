import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useSupabase = () => {
  const [supabaseClient, setSupabaseClient] = useState(null);

  useEffect(() => {
    setSupabaseClient(supabase);
  }, []);

  return supabaseClient;
};
