# Vista360

Aplicación de gestión de paneles publicitarios, contratos, clientes y finanzas.

**Propietaria — Todos los derechos reservados.** Ver [LICENSE](LICENSE).

---

## 📂 Estructura del repositorio

### Raíz — archivos de configuración (no mover)

| Archivo | Para qué sirve |
|---|---|
| `package.json` | Dependencias y scripts de npm |
| `package-lock.json` | Versiones exactas de dependencias (lo genera npm) |
| `tsconfig.json` | Configuración de TypeScript |
| `tsconfig.node.json` | Config TS para archivos de build (Vite) |
| `vite.config.ts` | Configuración de Vite (build tool) |
| `eslint.config.js` | Reglas de linter |
| `.prettierrc` | Reglas de formato de código |
| `.prettierignore` | Archivos que Prettier debe ignorar |
| `.gitignore` | Archivos que Git no debe subir al repo |
| `index.html` | Punto de entrada HTML |
| `firestore.rules` | Reglas de seguridad de Firebase |
| `LICENSE` | Licencia propietaria |
| `README.md` | Este archivo |

> ⚠️ Todos estos archivos **deben** estar en la raíz para que las herramientas los encuentren. No moverlos.

### Carpetas principales

```
.github/workflows/  → Configuración de CI/CD (GitHub Actions)
public/             → Assets estáticos (iconos, manifest, service worker)
scripts/            → Scripts de mantenimiento (seed de datos)
src/                → CÓDIGO FUENTE DE LA APP
```

---

## 📁 Estructura de `src/`

```
src/
├── App.tsx                    # Router principal de la app
├── App.module.css             # Estilos globales
├── main.tsx                   # Punto de entrada de React
│
├── components/
│   ├── features/              # UNA CARPETA POR PESTAÑA — todo el código de cada pestaña vive aquí
│   │   ├── auth/              # Login
│   │   ├── capital/           # Capital
│   │   ├── contratos/         # Contratos
│   │   ├── crm/               # CRM (Clientes)
│   │   ├── dashboard/         # Resumen / Inicio
│   │   ├── facturacion/       # Facturación
│   │   ├── gastos/            # Gastos
│   │   ├── historico/         # Histórico
│   │   ├── mapa/              # Mapa
│   │   ├── paneles/           # Paneles (incluye mini-mapa)
│   │   ├── profile/           # Perfil (incluye estado Firebase)
│   │   ├── proveedores/       # Proveedores
│   │   └── reportes/          # Reportes (incluye Resultados y MesCard)
│   │
│   ├── layout/                # Navegación, drawer, logo
│   ├── shared/                # Modales y componentes compartidos
│   └── ui/                    # Primitivos UI (botones, modales base)
│
├── config/                    # Configuración (tema, constantes, Firebase)
├── context/                   # React Context (estado global)
├── hooks/                     # Hooks personalizados
├── lib/                       # Funciones utilitarias
├── pages/                     # Páginas standalone (Splash)
├── services/                  # Capa de datos (Firestore)
├── test/                      # Setup de tests
└── types/                     # Tipos TypeScript compartidos
```

---

## 🔑 Reglas de organización

1. **Una pestaña = una carpeta en `features/` = un archivo `.tsx`**. Todo lo de esa pestaña (sub-componentes, modales locales, helpers) va dentro de ese mismo archivo. Cuando quieras editar "Reportes", abres `features/reportes/Reportes.tsx` y ahí está TODO.

2. **Lo compartido entre pestañas va en `shared/`, `ui/`, `lib/`, `hooks/` o `services/`** según corresponda.

3. **Configuración va en `config/`** — colores, tipos de gastos, ciudades, Firebase, etc.

---

## 🚀 Scripts disponibles

```bash
npm run dev           # Servidor de desarrollo
npm run build         # Compilar para producción
npm run preview       # Vista previa del build
npm run typecheck     # Verificar tipos TypeScript
npm run lint          # ESLint
npm run lint:fix      # ESLint + autocorregir
npm run format        # Prettier (formatear)
npm run format:check  # Prettier (verificar)
npm run test          # Tests con Vitest
npm run ci            # Pipeline completa (typecheck + lint + format + test)
```

---

## 🚢 Deploy

Cada push a `main` despliega automáticamente en Cloudflare Pages.
