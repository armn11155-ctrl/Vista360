# Changelog

All notable changes to Vista360 are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) — versioning: [SemVer](https://semver.org/).

---

## [Unreleased]

### Added
- CHANGELOG.md con formato keep-a-changelog
- Branch protection en `main` (CI requerido antes de merge)
- Umbrales de cobertura progresivos en vite.config.ts

---

## [1.1.0] — 2026-05-27

### Added
- CI completo con dos jobs: unit tests + E2E (Playwright)
- `CONTRIBUTING.md` con estrategia de branching y Conventional Commits
- `SECURITY.md` — política de divulgación responsable
- `.github/PULL_REQUEST_TEMPLATE.md` — checklist de calidad en cada PR
- Dependabot configurado para GitHub Actions y npm
- `.editorconfig` para consistencia de estilo entre editores
- `.nvmrc` apuntando a Node.js 22
- `src/config/env.ts` — validación de variables de entorno al arrancar
- `useAppShell`, `useNotifications`, `useServiceWorker` hooks extraídos
- Banner de estado Firebase caído + loading por ruta

### Fixed
- Pantalla blanca al cargar la app (race condition en auth)
- 3 errores de typecheck (TS2375, TS6133 ×2)
- Comillas en `useAppShell.ts` (TS1127)
- Umbrales de coverage ajustados a estado real del proyecto

### Changed
- CSS global extraído de `AppShell` a `index.css`
- Prettier aplicado a 14 archivos

---

## [1.0.0] — 2026-05-26

### Added
- Proyecto base: React 18 + TypeScript strict + Vite
- Firebase Authentication + Firestore con reglas deny-all
- PWA mobile-first con manifest y service worker
- Autenticación por whitelist de emails (`/config/allowedEmails`)
- Módulos: Dashboard, Contratos, Paneles, Mapa, CRM, Capital, Gastos, Histórico, Facturación
- Tests unitarios: `LoginScreen`, `ErrorBoundary`, `validate`, `cloudinary`, `gasto-flow`
- Deploy en Cloudflare Pages
- Firestore rules con `isAllowed()` guard
- `scripts/seed-allowed-emails.mjs`

### Fixed
- `validate.test.ts` — RUCs con dígito verificador correcto
- `gasto-flow.test.ts` — `toDate()` retorna `new Date()` como fallback
- `cloudinary.test.ts` — `publicId` extrae solo nombre de archivo

---

[Unreleased]: https://github.com/armn11155-ctrl/Vista360/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/armn11155-ctrl/Vista360/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/armn11155-ctrl/Vista360/releases/tag/v1.0.0
