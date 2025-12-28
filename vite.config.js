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
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    // Ensure a single React instance (avoid invalid hook call / dispatcher null)
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    alias: [
      // Exact-match aliases so subpath imports keep working
      { find: /^react$/, replacement: resolve(projectRoot, "node_modules/react") },
      { find: /^react-dom$/, replacement: resolve(projectRoot, "node_modules/react-dom") },
      { find: /^react\/jsx-runtime$/, replacement: resolve(projectRoot, "node_modules/react/jsx-runtime.js") },
      { find: /^react\/jsx-dev-runtime$/, replacement: resolve(projectRoot, "node_modules/react/jsx-dev-runtime.js") },

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
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    force: true,
  },
}));

