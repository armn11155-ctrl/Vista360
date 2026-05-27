# Guía de migración — deps major (Vista360)

> Rama: `chore/deps-major-migration`
> Creada: 2026-05-27 — ejecutar por partes, no todo de golpe

## Orden recomendado de migración

### Paso 1 — TypeScript 5 → 6 (PR #10)
```bash
npm install --save-dev typescript@^6.0.3
npm run typecheck
```
**Cambios breaking conocidos:**
- `moduleResolution: "node"` ya no se acepta — cambiar a `"bundler"` en tsconfig.json
- Algunos tipos de utilidad cambiaron (revisar errores con `tsc --noEmit`)

---

### Paso 2 — ESLint 9 → 10 + @eslint/js 9 → 10 (PRs #5 y #6)
```bash
npm install --save-dev eslint@^10.4.0 @eslint/js@^10.0.1
npm run lint
```
**Cambios breaking conocidos:**
- Flat config ya es el único formato (ya estamos en eslint.config.js ✅)
- Algunas reglas renombradas — revisar warnings

---

### Paso 3 — eslint-plugin-react-hooks 5 → 7 (PR #7)
```bash
npm install --save-dev eslint-plugin-react-hooks@^7.1.1
npm run lint
```
**Cambios:** nuevas reglas para hooks condicionales más estrictas.

---

### Paso 4 — Vitest 3 → 4 + @vitest/coverage-v8 3 → 4 (PRs #4 y #13)
```bash
npm install --save-dev vitest@^4.1.7 @vitest/coverage-v8@^4.1.7
npm run test:coverage
```
**Cambios breaking:**
- API de `vi.mock` ligeramente diferente — revisar mocks en tests existentes
- Config de `coverage.thresholds` puede tener nuevo formato

---

### Paso 5 — React Router DOM 6 → 7 (PR #11)
```bash
npm install react-router-dom@^7.15.1
npm run typecheck && npm run build
```
**Cambios breaking importantes:**
- `<Routes>` / `<Route>` mantienen compatibilidad pero se recomienda migrar a `createBrowserRouter`
- `useNavigate` / `useLocation` igual
- Revisar loaders y actions si se usan (v7 los promueve)

---

### Paso 6 — React + react-dom (PRs #9 y #12)
```bash
npm install react@latest react-dom@latest @types/react@latest @types/react-dom@latest
npm run typecheck && npm run build
```
**Generalmente seguro** — React sigue semver estricto en su API pública.

---

## Checklist antes de abrir PR → main
- [ ] `npm run typecheck` sin errores
- [ ] `npm run lint` sin errores
- [ ] `npm run test:coverage` pasa thresholds
- [ ] `npm run build` sin warnings críticos
- [ ] E2E: `npm run test:e2e` en entorno local
