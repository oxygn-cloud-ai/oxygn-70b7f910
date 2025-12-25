import { fileURLToPath, URL } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { componentTagger } from "lovable-tagger";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

// Fix for intermittent HTTP 412 (Precondition Failed) in Lovable preview.
// Some proxy/browser combinations send conditional headers (If-Match/If-None-Match)
// on Vite's health ping request (Accept: text/x-vite-ping), which can cause a 412.
// We:
// 1) Short-circuit the Vite ping with a 204.
// 2) Strip conditional headers for all requests.
const stripConditionalHeaders = (req, res, next) => {
  // Strip conditional headers that cause 412 errors
  delete req.headers["if-none-match"];
  delete req.headers["if-match"];
  delete req.headers["if-modified-since"];
  delete req.headers["if-unmodified-since"];

  const accept = req.headers?.accept || "";
  if (accept.includes("text/x-vite-ping")) {
    res.statusCode = 204;
    res.setHeader("Cache-Control", "no-store");
    res.end();
    return;
  }

  next();
};

const lovablePreview412Fix = () => ({
  name: "lovable-preview-412-fix",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use(stripConditionalHeaders);
  },
  configurePreviewServer(server) {
    server.middlewares.use(stripConditionalHeaders);
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    strictPort: true,
    // Prevent caching issues that cause HTTP 412 errors
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
    // Lovable preview runs Vite behind a secure proxy; ensure the HMR socket
    // connects back to the current origin instead of localhost.
    hmr: {
      protocol: "wss",
      clientPort: 443,
      // Empty string is falsy in the Vite client, so it falls back to import.meta.url.hostname.
      host: "",
    },
    // Ensure proper file change detection to prevent stale cached responses
    watch: {
      usePolling: true,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), lovablePreview412Fix()].filter(Boolean),
  optimizeDeps: {
    // Prevent Vite from pre-bundling React into multiple optimized chunks.
    // This is a common cause of `ReactCurrentDispatcher` being null (hooks crash).
    exclude: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  resolve: {
    // Ensure all deps (and the app) share ONE React instance.
    // Avoid file-path aliases for react/react-dom because they can *create* duplicates in Vite.
    dedupe: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
    alias: [
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
      {
        find: "lib",
        replacement: resolve(projectRoot, "lib"),
      },
    ],
  },
}));
