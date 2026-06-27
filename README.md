# Vista360

[![CI](https://github.com/armn11155-ctrl/Vista360/actions/workflows/ci.yml/badge.svg)](https://github.com/armn11155-ctrl/Vista360/actions/workflows/ci.yml)
[![Deploy](https://github.com/armn11155-ctrl/Vista360/actions/workflows/deploy.yml/badge.svg)](https://github.com/armn11155-ctrl/Vista360/actions/workflows/deploy.yml)

PWA mobile-first para gestión integral de paneles publicitarios OOH — React 18 + Firebase + TypeScript strict.

**Propietaria — Todos los derechos reservados.** Ver [LICENSE](LICENSE).

---

## 🚀 Setup local (guía completa)

### Prerrequisitos

- **Node.js 22+** (ver `.nvmrc`). Si usas nvm: `nvm use`
- **Firebase CLI**: `npm install -g firebase-tools`
- Una cuenta de Firebase con Firestore + Authentication habilitados

### 1. Clonar e instalar

```bash
git clone git@github.com:armn11155-ctrl/Vista360.git
cd Vista360
npm install
```

### 2. Variables de entorno

Crea `.env.local` en la raíz (este archivo está en `.gitignore`):

```env
# Firebase — obligatorias
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123:web:abc

# Emails autorizados (separados por coma) — opcional
VITE_ALLOWED_EMAILS=admin@tuempresa.com,otro@tuempresa.com

# Cloudinary — opcional (solo si usas carga de imágenes / OCR)
VITE_CLOUDINARY_CLOUD_NAME=mi-cloud
VITE_CLOUDINARY_UPLOAD_PRESET=vista360_preset

# Backend OCR / Facturación — opcional
VITE_API_URL=https://tu-backend.com
VITE_API_KEY=tu_clave_secreta
```

> ℹ️ Si falta alguna variable requerida, la app lanza un error descriptivo al arrancar gracias a `src/config/env.ts`.

### 3. Seed de emails autorizados en Firestore

```bash
node scripts/seed-allowed-emails.mjs
```

Este script crea `/config/allowedEmails` en Firestore con los emails de `VITE_ALLOWED_EMAILS`.

### 4. Desplegar reglas de Firestore

```bash
firebase deploy --only firestore:rules
```

### 5. Arrancar

```bash
npm run dev       # http://localhost:5173
```

---

## 📂 Arquitectura del repositorio

```
Vista360/
├── src/
│   ├── components/
│   │   ├── features/          # Una carpeta por módulo de negocio
│   │   │   ├── paneles/
│   │   │   │   ├── Paneles.tsx        # Orquestador (fino)
│   │   │   │   ├── PanelCard.tsx      # Tarjeta individual
│   │   │   │   ├── PanelHeader.tsx    # Cabecera con contadores
│   │   │   │   ├── MiniMapaPanel.tsx  # Mapa Leaflet embebido
│   │   │   │   └── PanelCard.test.tsx
│   │   │   ├── contratos/
│   │   │   ├── gastos/
│   │   │   ├── crm/
│   │   │   ├── dashboard/
│   │   │   ├── facturacion/
│   │   │   ├── reportes/
│   │   │   └── auth/
│   │   │       ├── LoginScreen.tsx
│   │   │       └── LoginScreen.test.tsx
│   │   ├── layout/            # AppHeader, BottomTabBar, DrawerMenu
│   │   ├── shared/            # ErrorBoundary, BusquedaGlobal, NotifPanel
│   │   └── ui/                # Primitivos: Modal, Badge, Pagination…
│   │
│   ├── config/
│   │   ├── env.ts             # Validación de vars de entorno (falla rápido)
│   │   ├── firebase.ts        # Inicialización de Firebase
│   │   ├── constants.ts       # Ciudades, categorías, emojis, EMISOR
│   │   └── theme.ts           # Tokens de color/tipografía
│   │
│   ├── context/
│   │   ├── AppContext.tsx     # Estado global: datos, setters y derivados
│   │   └── UIContext.tsx      # Toast, confirmaciones
│   │
│   ├── hooks/
│   │   ├── useCollection.ts          # Suscripción Firestore en tiempo real
│   │   ├── useFirestorePagination.ts # Paginación cursor-based (nuevas colecciones)
│   │   ├── usePagination.ts          # Paginación en memoria
│   │   ├── useVirtualList.ts         # Virtualización de listas largas
│   │   └── useOnlineStatus.ts
│   │
│   ├── services/
│   │   └── firestore.ts       # CRUD + Cloudinary + helpers de URL
│   │
│   ├── lib/
│   │   ├── utils.ts           # fmt, fmtF, validate (RUC, email, etc.)
│   │   ├── converters.ts      # Firestore Timestamp → tipos TS
│   │   └── firestoreSize.ts   # Estimación de tamaño de documentos
│   │
│   └── types/
│       └── index.ts           # Panel, Cliente, Contrato, Gasto…
│
├── facturacion-api/           # Backend Node.js (OCR, SUNAT, Cloudinary)
│   ├── tsconfig.json          # TypeScript config del backend
│   ├── src/
│   │   ├── types.ts           # Tipos compartidos del backend
│   │   ├── index.js           # Entry point Express
│   │   ├── controllers/       # auth, facturas, ocr, cloudinary
│   │   ├── routes/
│   │   ├── services/          # SUNAT, XML
│   │   ├── middleware/
│   │   └── db/                # PostgreSQL pool + schema
│   └── README.md
│
├── e2e/                       # Tests end-to-end con Playwright
│   ├── login.spec.ts
│   └── contratos.spec.ts
│
├── public/                    # PWA: manifest, icons, service worker
├── firestore.rules            # Seguridad de Firestore (deny-all + whitelist)
├── playwright.config.ts       # Configuración de E2E
└── vite.config.ts             # Build + chunks manuales
```

### Principio de organización

> **Una carpeta por módulo de negocio.** Cada carpeta en `features/` contiene el orquestador principal y sus sub-componentes. Lo compartido entre módulos va en `shared/`, `ui/`, `lib/`, `hooks/` o `services/`.

---

## 🔑 Scripts disponibles

```bash
npm run dev           # Servidor de desarrollo
npm run build         # Compilar para producción
npm run preview       # Vista previa del build
npm run typecheck     # Verificar tipos TypeScript
npm run lint          # ESLint
npm run lint:fix      # ESLint + autocorregir
npm run format        # Prettier (formatear)
npm run format:check  # Prettier (verificar)
npm run test          # Tests unitarios con Vitest
npm run test:watch    # Tests en modo watch
npm run test:coverage # Tests + informe de cobertura
npm run ci            # Pipeline completa (typecheck + lint + format + test)

# E2E (requiere npm install primero)
npx playwright test          # Todos los tests E2E
npx playwright test --ui     # Modo UI interactivo
npx playwright test login    # Solo tests de login
```

---

## 🚢 Deploy

Cada push a `main` despliega automáticamente en **Cloudflare Pages** vía GitHub Actions.

El pipeline de CI ejecuta: `typecheck → lint → format:check → test:coverage → build`.

### Variables de entorno en producción

Configura las variables `VITE_*` en **Cloudflare Pages → Settings → Environment variables**.

---

## 🔐 Seguridad

- **Firestore rules**: deny-all por defecto. Solo emails en `/config/allowedEmails` pueden acceder a las colecciones de negocio.
- **Whitelist en Firestore**: los emails autorizados se guardan en Firestore (no en el frontend) para evitar exponerlos en el repositorio.
- **Cloudinary**: las imágenes se comprimen antes de subir (máx 1200px, JPEG 72%). La eliminación de imágenes se hace vía backend (Admin SDK).
- **Variables de entorno**: validadas en arranque por `src/config/env.ts` — falla rápido con mensaje descriptivo si falta alguna.

---

## 📐 Stack técnico

| Capa | Tecnología |
|---|---|
| UI | React 18 + TypeScript strict |
| Build | Vite 6 (chunks manuales: React / Firebase / Router) |
| Backend-as-a-Service | Firebase (Firestore + Google Auth) |
| Imágenes | Cloudinary (thumb / detail / PDF transforms) |
| OCR | Google Cloud Vision (via backend) |
| Facturación | SUNAT (via facturacion-api) |
| Tests unitarios | Vitest + Testing Library |
| Tests E2E | Playwright |
| CI/CD | GitHub Actions → Cloudflare Pages |
| Linting | ESLint 9 + typescript-eslint + jsx-a11y |
| Formato | Prettier |
