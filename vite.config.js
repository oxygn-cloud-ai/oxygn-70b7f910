import { fileURLToPath, URL } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { componentTagger } from "lovable-tagger";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    strictPort: true,
    // Lovable preview runs Vite behind a secure proxy; ensure the HMR socket
    // connects back to the current origin instead of localhost.
    hmr: {
      protocol: "wss",
      clientPort: 443,
      // Empty string is falsy in the Vite client, so it falls back to import.meta.url.hostname.
      host: "",
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
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
