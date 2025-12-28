import { fileURLToPath, URL } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { createRequire } from "module";
import { componentTagger } from "lovable-tagger";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

// Force a single React instance (prevents "dispatcher is null" hook crashes)
const require = createRequire(import.meta.url);
const reactPath = require.resolve("react");
const reactDomPath = require.resolve("react-dom");
const reactJsxRuntimePath = require.resolve("react/jsx-runtime");
const reactJsxDevRuntimePath = require.resolve("react/jsx-dev-runtime");

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    // Ensure a single React instance
    dedupe: ["react", "react-dom"],
    alias: [
      { find: "react", replacement: reactPath },
      { find: "react-dom", replacement: reactDomPath },
      { find: "react/jsx-runtime", replacement: reactJsxRuntimePath },
      { find: "react/jsx-dev-runtime", replacement: reactJsxDevRuntimePath },
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
    include: ["react", "react-dom"],
  },
}));

