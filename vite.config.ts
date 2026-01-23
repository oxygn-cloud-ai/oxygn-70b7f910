import { fileURLToPath, URL } from "url";
import { defineConfig, ConfigEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
// @ts-ignore - lovable-tagger lacks type definitions
import { componentTagger } from "lovable-tagger";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }: ConfigEnv) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    dedupe: ["react", "react-dom"],
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
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        strict: true,
        jsx: "react-jsx" as const,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        isolatedModules: true,
      },
    },
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
}));
