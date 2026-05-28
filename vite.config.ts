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
    environment: "happy-dom",
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
        // Roadmap de cobertura — subir ~10 puntos por sprint
        // Sprint 2 (anterior): lines 30%, functions 34%
        // Sprint 3 (actual):   lines 45%, functions 50%  ← umbral actual
        // Sprint 4 (próximo):  lines 60%, functions 65%
        // Sprint 5 (meta):     lines 70%, functions 80%
        //
        // NOTA: V8 cuenta arrow functions inline en JSX como funciones separadas.
        // Los componentes grandes (Gastos, Contratos) necesitan tests de interacción
        // para cubrir sus handlers — trabajo pendiente en Sprint 4.
        lines: 45,
        functions: 50,
      },
    },
  },
});
