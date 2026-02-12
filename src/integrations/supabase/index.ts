// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import {
  SupabaseAuthProvider,
  useSupabaseAuth,
  SupabaseAuthUI,
} from "./auth";

export { supabase, SupabaseAuthProvider, useSupabaseAuth, SupabaseAuthUI };