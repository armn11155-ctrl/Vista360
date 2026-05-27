import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  base: "/",

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/firebase")) {
            return "vendor-firebase";
          }
          if (id.includes("node_modules/react-router")) {
            return "vendor-router";
          }
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },

  test: {
    environment: "jsdom",
    globals:     true,
    setupFiles:  ["./src/test/setup.ts"],
    include:     ["src/**/*.test.{ts,tsx}"],
    exclude:     ["e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/test/**",
        "src/assets/**",
        "src/config/firebase.ts",
        "src/**/*.d.ts",
        "src/main.tsx",
        "src/types/**",
        "src/vite-env.d.ts",
      ],
      thresholds: {
        // Ruta hacia 70% en 4 meses — subir ~10-15 puntos por sprint
        // Sprint 1 (base):     lines 20%, functions 40%
        // Sprint 2 (hoy):      lines 30%, functions 50%
        // Sprint 3 (4 sem):    lines 45%, functions 65%
        // Sprint 4 (8 sem):    lines 70%, functions 80%
        lines: 30,
        functions: 50,
      },
    },
  },
});
