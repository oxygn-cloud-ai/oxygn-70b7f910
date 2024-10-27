import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { toast } from "sonner";

// Load and validate environment variables before mounting the app
(() => {
  const requiredEnvVars = {
    'PROMPTS_TABLE': import.meta.env.VITE_PROMPTS_TBL,
    'SETTINGS_TABLE': import.meta.env.VITE_SETTINGS_TBL,
    'MODELS_TABLE': import.meta.env.VITE_MODELS_TBL,
    'INFO_TABLE': import.meta.env.VITE_INFO_TBL,
    'OPENAI_API_KEY': import.meta.env.VITE_OPENAI_API_KEY,
    'OPENAI_URL': import.meta.env.VITE_OPENAI_URL
  };

  const missingVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    const errorMessage = `Missing required environment variables: ${missingVars.join(', ')}`;
    console.error(errorMessage);
    document.body.innerHTML = `<div style="color: red; padding: 20px;">${errorMessage}</div>`;
    throw new Error(errorMessage);
  }
})();

// Only mount the app if environment check passes
ReactDOM.createRoot(document.getElementById("root")).render(<App />);