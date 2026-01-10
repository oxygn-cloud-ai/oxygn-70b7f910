// Application entry point
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { initPostHog } from "./lib/posthog";

// Development-only React version logging for debugging
if (import.meta.env.DEV) {
  console.log('[Boot] React version:', React.version);
}

// Initialize PostHog before React renders
initPostHog();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
