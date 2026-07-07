import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier";

// Archivos legacy con @ts-nocheck — excluidos de lint hasta que sean migrados a strict.
// El CI solo aplica las reglas estrictas al código nuevo.
const LEGACY_IGNORE = [
  "src/App.tsx",
  "src/assets/**",
  "src/components/features/**",
  "src/components/layout/**",
  "src/components/shared/**",
  "src/components/ui/**",
  "src/context/UIContext.tsx",
  "src/hooks/useViewportSetup.ts",
  "src/hooks/useOnlineStatus.ts",
  "src/hooks/usePagination.ts",
  "src/hooks/useVirtualList.ts",
  "src/pages/**",
];

export default tseslint.config(
  // Excluir archivos legacy del linting estricto
  { ignores: LEGACY_IGNORE },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Reglas para código nuevo (services, hooks nuevos, context/AppContext, types, lib)
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      react:        reactPlugin,
      "react-hooks": reactHooks,
      "jsx-a11y":   jsxA11y,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,

      "react/react-in-jsx-scope":              "off",
      "react/prop-types":                      "off",
      "@typescript-eslint/no-explicit-any":    "warn",
      "@typescript-eslint/no-unused-vars":     ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/ban-ts-comment":     "off",   // @ts-nocheck permitido en migración gradual
      "no-console":                            ["warn", { allow: ["warn", "error"] }],
    },
    settings: {
      react: { version: "detect" },
    },
  },

  // Tests — reglas más permisivas (mocks, any, etc.)
  {
    files: ["src/**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any":    "off",
      "@typescript-eslint/no-unused-vars":     "off",
      "no-console":                            "off",
    },
  },

  prettier,
);
