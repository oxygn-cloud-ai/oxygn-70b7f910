// Import all the relevant exports from other files in the supabase directory
import { supabase } from "./supabase";
import {
  SupabaseAuthProvider,
  useSupabaseAuth,
  SupabaseAuthUI,
} from "./auth.js";

// Export all the imported functions and objects from .auth and .hooks/
export { supabase, SupabaseAuthProvider, useSupabaseAuth, SupabaseAuthUI };
