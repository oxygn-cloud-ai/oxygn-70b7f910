// Vite config - cache bust v5 (force React re-bundle)
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
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
      {
        find: "lib",
        replacement: resolve(projectRoot, "lib"),
      },
      // Force single React instance - prevent nested dependencies from bundling their own
      {
        find: /^react$/,
        replacement: fileURLToPath(new URL("./node_modules/react", import.meta.url)),
      },
      {
        find: /^react-dom$/,
        replacement: fileURLToPath(new URL("./node_modules/react-dom", import.meta.url)),
      },
    ],
  },
  optimizeDeps: {
    // Force cache invalidation by specifying entry point
    entries: ['src/main.jsx'],
    include: [
      "react", 
      "react-dom", 
      "react/jsx-runtime", 
      "react/jsx-dev-runtime",
      "zod",
      "framer-motion",
      "react-dnd",
      "react-dnd-html5-backend",
      // Router
      "react-router-dom",
      // TipTap editor and all its extensions
      "@tiptap/react",
      "@tiptap/starter-kit",
      "@tiptap/extension-link",
      "@tiptap/extension-placeholder",
      // Radix UI primitives (commonly cause React duplication)
      "@radix-ui/react-tooltip",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-accordion",
      "@radix-ui/react-switch",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-scroll-area",
      // React Query
      "@tanstack/react-query",
      // Supabase
      "@supabase/supabase-js",
    ],
    force: true,
    // Ensure React is not externalized
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  // Ensure a single copy of React in the build
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
}));

