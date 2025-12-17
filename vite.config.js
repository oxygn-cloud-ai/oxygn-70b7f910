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
    // Keep Vite defaults; manually forcing/pre-including React can accidentally create
    // multiple pre-bundled React copies and trigger `useState` dispatcher null errors.
  },
  resolve: {
    // Ensure all deps (and the app) share ONE React instance.
    // Avoid file-path aliases for react/react-dom because they can *create* duplicates in Vite.
    dedupe: ["react", "react-dom", "react-dom/client"],
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
