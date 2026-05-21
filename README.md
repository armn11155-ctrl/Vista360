# Vista360 — Gestión de Paneles Publicitarios 📡

> Aplicación React + Firebase para la gestión integral de paneles publicitarios (OOH).

## 🏗️ Arquitectura del Proyecto

```
src/
├── types/                    # Interfaces & tipos TypeScript
│   └── index.ts              # Panel, Cliente, Contrato, Gasto, Proveedor, Factura…
│
├── config/                   # Configuración global
│   ├── firebase.ts           # Inicialización Firebase + Firestore offline
│   ├── constants.ts          # Constantes app (estados, categorías, tabs)
│   └── theme.ts              # Design tokens (T.accent, T.red, T.muted…)
│
├── lib/                      # Utilitarios puros (sin React)
│   ├── converters.ts         # toNumber(), toDate() — normalize Firestore types
│   └── utils.ts              # fmt(), días(), validate, haptic()
│
├── services/                 # Capa de acceso a datos
│   └── firestore.ts          # fb.get/post/patch/del/subscribe — cliente Firestore
│
├── hooks/                    # Custom React hooks
│   ├── useViewportSetup.ts   # Inyecta meta tags PWA + Google Fonts
│   ├── useOnlineStatus.ts    # Detecta estado online/offline
│   ├── useCollection.ts      # Hook genérico para colecciones Firestore
│   ├── usePagination.ts      # Paginación de listas
│   └── useVirtualList.ts     # Virtualización para listas largas (500+ items)
│
├── context/
│   └── UIContext.tsx          # ToastProvider + confirmAsync() — sistema de notificaciones
│
├── components/
│   ├── ui/                   # Primitivos de UI reutilizables
│   │   └── index.tsx         # Badge, Card, Modal, Pagination, Spinner, SwipeRow, Skeleton…
│   │
│   ├── layout/               # Estructura de la app
│   │   ├── BottomTabBar.tsx  # Barra de navegación flotante
│   │   ├── DrawerMenu.tsx    # Menú lateral deslizable
│   │   └── Logo360.tsx       # Logo de la marca
│   │
│   ├── shared/               # Componentes compartidos entre features
│   │   ├── NotifPanel.tsx    # Centro de notificaciones
│   │   ├── BusquedaGlobal.tsx# Búsqueda global (paneles, clientes, contratos)
│   │   └── TrashModal.tsx    # Papelera (soft delete)
│   │
│   └── features/             # Módulos de negocio
│       ├── auth/             # LoginScreen (Google OAuth)
│       ├── dashboard/        # ResumenNuevo — pantalla principal (Hoy)
│       ├── paneles/          # CRUD de paneles publicitarios
│       ├── contratos/        # Contratos de arrendamiento
│       ├── historico/        # Histórico de contratos + pagos mensuales
│       ├── crm/              # CRM de clientes y prospectos
│       ├── gastos/           # Registro de gastos con OCR (Cloudinary)
│       ├── proveedores/      # Directorio de proveedores
│       ├── facturacion/      # Facturación electrónica (SUNAT)
│       ├── reportes/         # Reportes financieros + Resultados OOH
│       ├── capital/          # Dashboard de capital e inversión
│       └── mapa/             # Mapa interactivo de paneles
│
├── assets/
│   └── logos.ts              # Logos en Base64 (Vista360, drawer)
│
├── pages/
│   └── Splash.tsx            # Pantalla de carga inicial
│
├── App.tsx                   # Componente raíz — auth, data, routing por tabs
└── main.tsx                  # Entry point React
```

## 🧩 Principios de Arquitectura

| Patrón | Descripción |
|--------|-------------|
| **Feature-first** | Cada módulo de negocio es autocontenido en `features/` |
| **Separation of concerns** | `types` → `lib` → `services` → `hooks` → `components` |
| **Soft delete** | Los registros se marcan como `deleted:true`, no se borran |
| **Optimistic UI** | Las mutaciones actualizan el estado local antes de Firestore |
| **Real-time** | `fb.subscribe()` mantiene los datos sincronizados con `onSnapshot` |
| **Code splitting** | Los tabs pesados se importan con `React.lazy()` |
| **Offline-first** | Firestore `persistentLocalCache` para funcionamiento offline |

## 🚀 Setup

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Completa con tus credenciales de Firebase y Cloudinary

# 3. Desarrollo
npm run dev

# 4. Build producción
npm run build
```

## 🔐 Variables de Entorno

Ver `.env.example` para la lista completa. Las más importantes:

- `VITE_FIREBASE_*` — Credenciales del proyecto Firebase
- `VITE_ALLOWED_EMAILS` — Lista de emails con acceso (vacío = acceso libre)
- `VITE_CLOUDINARY_*` — Para la subida de fotos en Gastos
- `VITE_EMISOR_*` — Datos de la empresa para facturación

## 📦 Stack Tecnológico

- **React 18** + **TypeScript**
- **Firebase 10** (Firestore, Auth)
- **Vite 5** (bundler)
- **Google Fonts** DM Sans + Barlow Condensed
- **Cloudinary** (OCR y almacenamiento de fotos)

## 🗂️ Migración desde App-15.tsx (monolito → módulos)

El proyecto original era un único archivo `App-15.tsx` de ~11,700 líneas.
Esta arquitectura divide ese monolito en módulos cohesivos:

| Módulo | Líneas originales | Archivo destino |
|--------|-------------------|-----------------|
| Tipos  | 1–172             | `types/index.ts` |
| Firebase config | 224–270 | `config/firebase.ts` |
| Firestore client | 272–424 | `services/firestore.ts` |
| Constantes | 407–432 | `config/constants.ts` |
| Utils + Validate | 433–553 | `lib/utils.ts` |
| Theme | 554–586 | `config/theme.ts` |
| UIContext | 587–755 | `context/UIContext.tsx` |
| UI primitivos | 756–1660 | `components/ui/index.tsx` |
| Paneles | 1928–2350 | `features/paneles/` |
| Mapa | 2351–2715 | `features/mapa/` |
| Contratos | 2716–3251 | `features/contratos/` |
| CRM | 3308–3736 | `features/crm/` |
| Proveedores | 3737–4090 | `features/proveedores/` |
| Resultados | 4091–5000 | `features/reportes/` |
| Gastos | 5284–6396 | `features/gastos/` |
| Histórico | 6400–6755 | `features/historico/` |
| Facturación | 6756–8138 | `features/facturacion/` |
| Reportes | 8139–8803 | `features/reportes/` |
| Dashboard | 8803–9150 | `features/dashboard/` |
| Capital | 9281–9850 | `features/capital/` |
| TrashModal | 9853–10068 | `components/shared/` |
| DrawerMenu + Búsqueda | 10068–10510 | `components/layout/` + `shared/` |
| Auth | 10533–10721 | `features/auth/` |
| NotifPanel | 10723–11000 | `components/shared/` |
| App root | 11000–11708 | `App.tsx` |

---
*Vista360 v1.0 · © 2026 8 Millas · Publicidad Exterior*
