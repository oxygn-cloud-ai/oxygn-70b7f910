// Application entry point - standard Lovable boot (v3 - cache bust)  
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { initPostHog } from "./lib/posthog";

// Initialize PostHog before React renders
initPostHog();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
