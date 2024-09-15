import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import * as Sentry from "@sentry/react";

// Initialize Sentry with a lower sample rate
Sentry.init({
  dsn: "YOUR_SENTRY_DSN", // Replace with your actual Sentry DSN
  integrations: [new Sentry.BrowserTracing()],
  tracesSampleRate: 0.1, // Set this to a lower value, e.g., 0.1 for 10% of transactions
  beforeSend(event) {
    // Optionally, you can add logic here to further filter events
    // For example, only send errors in production
    if (process.env.NODE_ENV === "production") {
      return event;
    }
    return null;
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
    <App />
  </Sentry.ErrorBoundary>
);

function ErrorFallback({error}) {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre>{error.message}</pre>
    </div>
  );
}
