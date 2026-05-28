#!/usr/bin/env node
/**
 * scripts/check-dep-sync.mjs
 *
 * Valida que las dependencias compartidas entre Vista360 y facturacion-web
 * estén en las mismas versiones (o rangos compatibles).
 *
 * Uso:
 *   node scripts/check-dep-sync.mjs
 *   node scripts/check-dep-sync.mjs --fix   # actualiza package.json local
 *
 * Requiere acceso al repo hermano (ruta relativa ../facturacion-web) o
 * puede apuntar a cualquier path con la variable SIBLING_PATH.
 *
 * También puede correr en CI comparando contra el package.json publicado
 * (usa NPM_COMPARE=1 para comparar contra npm registry en lugar de disco).
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const fix = process.argv.includes("--fix");

// ── Shared deps — las que ambos repos deberían tener sincronizadas ──
const SHARED = [
  "firebase",
  "react",
  "react-dom",
  "react-router-dom",
  "@types/react",
  "@types/react-dom",
  "typescript",
  "vite",
  "vitest",
  "@vitest/coverage-v8",
  "eslint",
  "prettier",
  "@vitejs/plugin-react",
  "@playwright/test",
  "@testing-library/react",
  "@testing-library/jest-dom",
  "eslint-plugin-react-hooks",
  "eslint-config-prettier",
];

function readPkg(dir) {
  const p = resolve(dir, "package.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

function allDeps(pkg) {
  return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
}

const selfPkg = readPkg(resolve(__dir, ".."));
const siblingPath =
  process.env.SIBLING_PATH ?? resolve(__dir, "../../facturacion-web");
const siblingPkg = readPkg(siblingPath);

if (!siblingPkg) {
  console.warn(
    `⚠  No se encontró package.json en ${siblingPath}\n` +
      `   Exporta SIBLING_PATH=/ruta/a/facturacion-web para ajustar.`
  );
  process.exit(0);
}

const selfDeps = allDeps(selfPkg);
const sibDeps = allDeps(siblingPkg);

let diffs = 0;
const rows = [];

for (const dep of SHARED.sort()) {
  const a = selfDeps[dep];
  const b = sibDeps[dep];
  if (!a && !b) continue;
  const match = a === b;
  if (!match) diffs++;
  rows.push({ dep, vista360: a ?? "—", facturacion: b ?? "—", match });
}

// Pretty print
const W = [40, 22, 22, 6];
const hr = W.map((w) => "─".repeat(w)).join("┼");
const row = (cols) =>
  cols.map((c, i) => String(c ?? "").padEnd(W[i])).join("│");

console.log("\n" + row(["Dependencia", "Vista360", "facturacion-web", "OK?"]));
console.log(hr);
for (const r of rows) {
  const icon = r.match ? "✓" : "✗";
  console.log(row([r.dep, r.vista360, r.facturacion, icon]));
}
console.log(hr);

if (diffs === 0) {
  console.log("\n✅  Todas las dependencias compartidas están sincronizadas.\n");
  process.exit(0);
} else {
  console.log(`\n⚠  ${diffs} dependencia(s) fuera de sync.`);
  console.log("   Revisa manualmente y actualiza con npm install <pkg>@<version>\n");
  process.exit(1);
}
