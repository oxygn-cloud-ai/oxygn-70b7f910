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
    port: "8080",
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    force: true, // Force fresh rebuild to fix React instance mismatch
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      // Force a single React instance (prevents `ReactCurrentDispatcher` null hook errors)
      {
        find: /^react$/,
        replacement: resolve(projectRoot, "node_modules/react"),
      },
      {
        find: /^react-dom$/,
        replacement: resolve(projectRoot, "node_modules/react-dom"),
      },
      {
        find: /^react\/jsx-runtime$/,
        replacement: resolve(projectRoot, "node_modules/react/jsx-runtime.js"),
      },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: resolve(projectRoot, "node_modules/react/jsx-dev-runtime.js"),
      },
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
