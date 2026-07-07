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
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/test/**",
        "src/assets/**",
        "src/config/firebase.ts",
        "src/config/env.ts",
        "src/**/*.d.ts",
        "src/main.tsx",
        "src/types/**",
        "src/vite-env.d.ts",
        // ── Archivos de integración / E2E (no aplican a unit coverage) ──
        // Estos archivos requieren un navegador real o Firebase emulator;
        // se cubren por los tests E2E de Playwright, no por vitest.
        "src/App.tsx",
        "src/components/layout/AppRouter.tsx",
        "src/components/layout/DrawerMenu.tsx",
        "src/components/layout/AppHeader.tsx",
        "src/components/layout/BottomTabIcons.tsx",
        "src/components/shared/AppSkeletons.tsx",
        "src/components/shared/BusquedaGlobal.tsx",
        "src/components/shared/NotifPanel.tsx",
        "src/components/shared/TrashModal.tsx",
        "src/components/shared/ShellErrorBoundary.tsx",
        // Paths corregidos: carpetas son "paneles/" y "mapa/", no "panels/" ni "map/"
        "src/components/features/paneles/MiniMapaPanel.tsx",
        "src/components/features/paneles/Paneles.tsx",
        "src/components/features/paneles/PanelHeader.tsx",
        "src/components/features/mapa/Mapa.tsx",
        // ── Utilidades sin lógica unit-testeable ──
        "src/lib/firestoreSize.ts",
        // ── Hooks de DOM / sistema (solo efectos secundarios, sin lógica testeable) ──
        "src/hooks/useAppShell.ts",
        "src/hooks/useDataShell.ts",
        "src/hooks/useUIShell.ts",
        "src/hooks/useServiceWorker.ts",
        "src/hooks/useNotifications.ts",
        "src/hooks/useViewportSetup.ts",
      ],
      thresholds: {
        // Roadmap de cobertura — umbrales sobre archivos unit-testeables (excluidos los shells)
        //
        // NOTA TÉCNICA: V8 cuenta cada arrow function inline en JSX (onClick, onChange, etc.)
        // como una función separada. Los componentes grandes (Gastos ~120 handlers, CRM ~80,
        // Contratos ~60) inflan el denominador de "functions" sin que sean lógica de negocio.
        // El umbral de LINES (45%) es el indicador real de cobertura en esta base de código.
        //
        // Sprint 3 (actual):  lines 45%, functions 35%
        // Sprint 4 (próximo): lines 60%, functions 45%  (+ tests de interacción en Gastos/CRM)
        // Sprint 5 (meta):    lines 70%, functions 60%
        lines: 45,
        functions: 34,
      },
    },
  },
});
