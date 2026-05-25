import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

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
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      exclude:  ["src/test/**", "src/assets/**", "src/config/firebase.ts"],
    },
  },
});
