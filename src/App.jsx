import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { navItems } from "./nav-items";
import Navbar from "./components/Navbar";
import { useEffect } from "react";
import { toast } from "sonner";
import { getSupabaseClient } from "./lib/supabase";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    const loadEnvVariables = () => {
      const requiredEnvVars = {
        'DEBUG': import.meta.env.VITE_DEBUG,
        'SUPABASE_PROJECT_URL': import.meta.env.VITE_SUPABASE_PROJECT_URL,
        'PROMPTS_TABLE': import.meta.env.VITE_PROMPTS_TBL,
        'SETTINGS_TABLE': import.meta.env.VITE_SETTINGS_TBL,
        'MODELS_TABLE': import.meta.env.VITE_MODELS_TBL,
        'INFO_TABLE': import.meta.env.VITE_INFO_TBL,
        'SUPABASE_API_KEY': import.meta.env.VITE_SUPABASE_API_KEY,
        'OPENAI_API_KEY': import.meta.env.VITE_OPENAI_API_KEY,
        'OPENAI_URL': import.meta.env.VITE_OPENAI_URL
      };

      const missingVars = Object.entries(requiredEnvVars)
        .filter(([_, value]) => !value)
        .map(([key]) => key);

      if (missingVars.length > 0) {
        toast.error(`Missing required environment variables: ${missingVars.join(', ')}`);
        console.error('Missing environment variables:', missingVars);
      } else {
        console.log('All environment variables loaded successfully');
        // Initialize Supabase client after environment variables are confirmed to be loaded
        getSupabaseClient();
      }
    };

    loadEnvVariables();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <Navbar />
          <Routes>
            {navItems.map(({ to, page }) => (
              <Route key={to} path={to} element={page} />
            ))}
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;