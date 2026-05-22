<div align="center">

# Vista360

**Gestión integral de paneles publicitarios OOH**

[![CI](https://github.com/armn11155-ctrl/Vista360/actions/workflows/ci.yml/badge.svg)](https://github.com/armn11155-ctrl/Vista360/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Firebase](https://img.shields.io/badge/Firebase-10-FFCA28?logo=firebase&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)

[**Demo en vivo →**](https://b65a6b26.vista360.pages.dev)

</div>

---

## ¿Qué es Vista360?

Vista360 es una PWA mobile-first para la gestión de un portafolio de paneles publicitarios exteriores (OOH — Out of Home). Permite controlar todo el ciclo de vida del negocio desde un solo lugar: desde el alta de un panel hasta la emisión de la factura electrónica a SUNAT.

### Módulos principales

| Módulo | Descripción |
|--------|-------------|
| **Dashboard** | Resumen del día: vencimientos, cobros pendientes, actividad reciente |
| **Paneles** | CRUD completo con fotos, coordenadas GPS y estado en tiempo real |
| **Contratos** | Arrendamientos con control de pagos mensuales por panel |
| **Histórico** | Línea de tiempo de contratos y registro de pagos por mes |
| **CRM** | Base de clientes y prospectos con pipeline de ventas |
| **Gastos** | Registro de egresos con OCR automático via Cloudinary |
| **Proveedores** | Directorio de proveedores por categoría |
| **Facturación** | Emisión de comprobantes electrónicos (SUNAT — Perú) |
| **Reportes** | P&L, ocupación, resultados OOH por período |
| **Capital** | Dashboard de inversión y rentabilidad del portafolio |
| **Mapa** | Vista geográfica interactiva de todos los paneles |

---

## Stack tecnológico

```
React 18 + TypeScript 5.9 (strict)
Firebase 10  →  Firestore (real-time + offline) + Auth (Google OAuth)
Vite 6       →  bundler + PWA
Cloudinary   →  OCR y almacenamiento de fotos de gastos
Vitest       →  53 tests unitarios (converters · utils · firestore · hooks)
ESLint 9     →  flat config con typescript-eslint + react-hooks + jsx-a11y
Prettier 3   →  formateo consistente
GitHub Actions →  CI/CD (typecheck → lint → test:coverage → build)
```

---

## Arquitectura

El proyecto migró de un monolito de **11 700 líneas** (`App-15.tsx`) a una arquitectura **feature-first** con separación estricta de responsabilidades.

```
src/
├── types/index.ts              ← Interfaces de dominio (Panel, Cliente, Contrato…)
├── config/
│   ├── firebase.ts             ← Init Firebase + Firestore offline cache
│   ├── constants.ts            ← Estados, categorías, tabs de navegación
│   └── theme.ts                ← Design tokens (T.accent, T.red, T.muted…)
├── lib/
│   ├── converters.ts           ← toNumber(), toDate() — normaliza tipos Firestore
│   └── utils.ts                ← fmt(), dias(), validate.*, haptic()
├── services/
│   └── firestore.ts            ← fb.get / post / patch / del / subscribe
├── hooks/
│   ├── useCollection.ts        ← Hook genérico Firestore con real-time + refetch
│   ├── useOnlineStatus.ts      ← Detecta conexión online/offline
│   ├── usePagination.ts        ← Paginación de listas
│   ├── useVirtualList.ts       ← Virtualización para 500+ registros
│   └── useViewportSetup.ts     ← Meta tags PWA + Google Fonts en <head>
├── context/
│   ├── UIContext.tsx            ← ToastProvider + confirmAsync()
│   └── AppContext.tsx           ← AppProvider: datos globales sin prop-drilling
├── components/
│   ├── ui/index.tsx            ← Badge, Card, Modal, Spinner, SwipeRow, Skeleton…
│   ├── layout/                 ← BottomTabBar, DrawerMenu, Logo360
│   ├── shared/                 ← NotifPanel, BusquedaGlobal, TrashModal
│   └── features/               ← 12 módulos de negocio autocontenidos
│       ├── auth/
│       ├── dashboard/
│       ├── paneles/
│       ├── contratos/
│       ├── historico/
│       ├── crm/
│       ├── gastos/
│       ├── proveedores/
│       ├── facturacion/
│       ├── reportes/
│       ├── capital/
│       └── mapa/
├── pages/Splash.tsx            ← Pantalla de carga inicial
├── App.tsx                     ← Raíz: auth, data, routing por tabs
└── main.tsx                    ← Entry point
```

### Principios de diseño

| Patrón | Implementación |
|--------|----------------|
| **Feature-first** | Cada módulo vive en su propia carpeta bajo `features/` |
| **Capas** | `types` → `lib` → `services` → `hooks` → `components` |
| **Real-time** | `fb.subscribe()` con `onSnapshot` en todas las colecciones |
| **Offline-first** | `persistentLocalCache` de Firestore — funciona sin red |
| **Soft delete** | Los registros se marcan `deleted: true`, nunca se borran |
| **Optimistic UI** | El estado local se actualiza antes de esperar a Firestore |
| **Lazy mount** | Tabs pesados (Mapa, Capital) se montan solo al primer acceso |
| **AppContext** | Estado global sin prop-drilling hacia los 12 módulos |

---

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo (hot reload)
npm run dev

# Build de producción
npm run build
```

> Las variables de entorno están configuradas en el deployer (Cloudflare Pages). No se requiere `.env` local para desarrollo con datos reales.

---

## Scripts disponibles

```bash
npm run dev            # Servidor de desarrollo
npm run build          # Build de producción
npm run typecheck      # tsc --noEmit (strict mode)
npm run test           # Vitest — 53 tests
npm run test:coverage  # Tests + reporte de cobertura
npm run lint           # ESLint
npm run lint:fix       # ESLint con auto-fix
npm run format         # Prettier
npm run format:check   # Prettier check (usado en CI)
npm run ci             # Suite completa: typecheck + lint + format:check + test
```

---

## CI/CD

Cada push a `main` ejecuta el pipeline completo en GitHub Actions:

```
typecheck → lint → format:check → test:coverage → build
```

Los secretos de Firebase se inyectan desde el entorno del runner. El reporte de cobertura se sube como artefacto con retención de 14 días.

---

## Tests

```
src/lib/converters.test.ts      — toNumber, toDate                    (12 tests)
src/lib/utils.test.ts           — dias, fmt, fmtF, mesHoy, validate   (27 tests)
src/services/firestore.test.ts  — fb.get/post/patch/del/subscribe     ( 9 tests)
src/hooks/useCollection.test.ts — loading, onData, error, refetch     ( 5 tests)
                                                               Total:   53 tests
```

Firebase se mockea completamente — los tests no requieren conexión ni credenciales.

---

## TypeScript

El proyecto usa `strict: true`. Los archivos de features llevan `// @ts-nocheck` durante la migración gradual — cada módulo elimina la directiva a medida que se tipifica correctamente. Los archivos nuevos deben cumplir strict desde el primer commit.

---

<div align="center">

*Vista360 v1.1.0 · © 2026 8 Millas · Publicidad Exterior*

</div>
