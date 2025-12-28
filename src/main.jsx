// Application entry point with error handling - v2
import * as React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

/**
 * Render a fallback error UI when the app fails to load.
 * This catches errors that happen BEFORE React mounts.
 */
const renderErrorFallback = (error) => {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 24px;
        font-family: 'Poppins', sans-serif;
        background: #1a1a1a;
        color: #e0e0e0;
      ">
        <div style="max-width: 500px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
          <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 12px;">
            Application Error
          </h1>
          <p style="color: #a0a0a0; margin-bottom: 20px;">
            Failed to load the application. Please try refreshing the page.
          </p>
          <details style="
            text-align: left;
            background: #2a2a2a;
            padding: 12px;
            border-radius: 8px;
            font-size: 12px;
            max-height: 150px;
            overflow: auto;
            margin-bottom: 20px;
          ">
            <summary style="cursor: pointer; font-weight: 500; margin-bottom: 8px;">
              Error details
            </summary>
            <pre style="white-space: pre-wrap; word-break: break-all; margin: 0;">
${error?.message || 'Unknown error'}
${error?.stack || ''}
            </pre>
          </details>
          <button 
            onclick="window.location.reload()"
            style="
              padding: 10px 20px;
              background: #e11d48;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
            "
          >
            Refresh Page
          </button>
        </div>
      </div>
    `;
  }
};

/**
 * Async app loader with error handling.
 * Uses dynamic import to catch module loading errors.
 */
const loadApp = async () => {
  try {
    // Dynamic import allows us to catch import-time errors
    const { default: App } = await import("./App.jsx");
    
    const rootElement = document.getElementById("root");
    if (!rootElement) {
      throw new Error("Root element not found");
    }
    
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Failed to start application:", error);
    renderErrorFallback(error);
  }
};

// Start the app
loadApp();
