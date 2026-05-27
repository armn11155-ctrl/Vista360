import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  // base explícito evita rutas rotas si algún día se despliega en subdirectorio
  base: "/",

  build: {
    rollupOptions: {
      output: {
        // Separar vendor (React, Firebase) del código de la app
        // Así el browser cachea React/Firebase por separado y no re-descarga en cada deploy
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
    // Avisar si algún chunk supera 500 KB
    chunkSizeWarningLimit: 500,
  },

  test: {
    environment: "jsdom",
    globals:     true,
    setupFiles:  ["./src/test/setup.ts"],
    // Excluir e2e/ — esos tests son de Playwright, no de vitest
    include:     ["src/**/*.test.{ts,tsx}"],
    exclude:     ["e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      // Solo medir src/ — excluir backend, configs, SW, scripts y archivos de tipos
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
      // Thresholds actuales: ~20% lines, ~30% functions con los tests existentes.
      // Subir gradualmente a medida que se agregan tests a los componentes grandes.
      // lines ~4% por App.tsx (900 líneas sin tests) — subir al agregar tests de páginas
      thresholds: { lines: 3, functions: 25 },
    },
  },
});
