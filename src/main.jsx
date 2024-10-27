import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { toast } from "sonner";

// Load and verify environment variables before mounting the app
const verifyEnvVariables = () => {
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
    const errorMessage = `Missing required environment variables: ${missingVars.join(', ')}`;
    console.error(errorMessage);
    toast.error(errorMessage);
    throw new Error(errorMessage);
  }

  return true;
};

// Only mount the app if all environment variables are present
if (verifyEnvVariables()) {
  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
}