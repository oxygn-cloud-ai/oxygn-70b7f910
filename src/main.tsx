// Application entry point
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initPostHog } from "./lib/posthog";

// Validate required environment variables at startup
// This fails fast with a clear message if critical config is missing
const REQUIRED_ENV_VARS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'] as const;
const missingEnvVars = REQUIRED_ENV_VARS.filter(v => !import.meta.env[v]);
if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}. App cannot start without backend configuration.`);
}

// Development-only React version logging for debugging
if (import.meta.env.DEV) {
  console.log('[Boot] React version:', React.version);
}

// Initialize PostHog before React renders
initPostHog();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
