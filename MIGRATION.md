# Migration guide — major dependency upgrades

Plan de ejecución para los 9 saltos de versión major agrupados en issue #14.
Seguir **el orden exacto** — cada paso debe tener CI verde antes de continuar.

---

## Orden de migración

### Paso 1 — TypeScript 5 → 6 (PR #10)
**Por qué primero:** todo lo demás depende del compilador.

Cambios esperados:
- `import type` obligatorio para tipos reexportados (ya cumplimos con `exactOptionalPropertyTypes`)
- Revisar errores nuevos con `tsc --noEmit` tras el bump
- Actualizar `tsconfig.node.json` si es necesario

```bash
npm install -D typescript@6
npm run typecheck
```

---

### Paso 2 — ESLint 9 → 10 + @eslint/js 9 → 10 (PR #5, #6)
**Por qué segundo:** el flat config de ESLint 10 puede requerir ajustes en `eslint.config.js`.

```bash
npm install -D eslint@10 @eslint/js@10
npm run lint
```

---

### Paso 3 — eslint-plugin-react-hooks 5 → 7 (PR #7)
**Tras ESLint 10:** el plugin 7.x requiere ESLint 10+.

```bash
npm install -D eslint-plugin-react-hooks@7
npm run lint
```

---

### Paso 4 — Vitest 3 → 4 + @vitest/coverage-v8 (PR #4, #13)
Revisar cambios en la API de `vi.*` y en la configuración de `coverage`.

```bash
npm install -D vitest@4 @vitest/coverage-v8@4
npm run test:coverage
```

---

### Paso 5 — React Router 6 → 7 (PR #11)
**El más impactante.** React Router 7 unifica con Remix y cambia imports.

Cambios principales:
- `import { ... } from 'react-router-dom'` → `import { ... } from 'react-router'`
- `<BrowserRouter>` reemplazado por el nuevo sistema de rutas
- Revisar `loader` / `action` si se usan data APIs

```bash
npm install react-router-dom@7
npm run typecheck && npm run test && npm run test:e2e
```

---

### Paso 6 — React + react-dom + @types (PR #9, #12)
Último paso para evitar conflictos de peer deps con React Router 7.

```bash
npm install react@latest react-dom@latest
npm install -D @types/react@latest @types/react-dom@latest
npm run typecheck && npm run build
```

---

## Checklist final

- [ ] CI verde (lint + typecheck + test + build)
- [ ] E2E pasan en Chromium
- [ ] `npm audit` sin vulnerabilidades moderate+
- [ ] CHANGELOG.md actualizado con la versión resultante

---

## Migración de seguridad — Custom Claims (firestore.rules)

### Contexto

Las reglas de Firestore anteriores usaban una función `isAllowed()` con una
lista de emails hardcodeada vacía. Cuando la lista está vacía, la condición
`emails.size() == 0` era `true`, lo que daba acceso de escritura a **cualquier
cuenta de Google autenticada**.

Las nuevas reglas usan **Firebase Custom Claims**: `request.auth.token.role == 'admin'`.

### Pasos para activar

#### 1. Instalar Firebase Admin SDK (solo en backend / script local)

```bash
npm install firebase-admin
```

#### 2. Crear script `scripts/set-admin-role.mjs`

```js
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Descarga tu serviceAccountKey.json desde:
// Firebase Console → Configuración del proyecto → Cuentas de servicio
import serviceAccount from '../serviceAccountKey.json' assert { type: 'json' };

initializeApp({ credential: cert(serviceAccount) });

const EMAIL = 'tu-email@empresa.com'; // ← cambiar

const user = await getAuth().getUserByEmail(EMAIL);
await getAuth().setCustomUserClaims(user.uid, { role: 'admin' });
console.log(`✅ Custom claim role=admin asignado a ${EMAIL}`);
process.exit(0);
```

#### 3. Ejecutar

```bash
node scripts/set-admin-role.mjs
```

#### 4. Forzar refresh del token en el cliente

Los Custom Claims se propagan en el siguiente refresh de token (~1 hora).
Para forzarlo inmediatamente después de asignar el claim:

```ts
// En cualquier parte del frontend tras el login:
await firebase.auth().currentUser?.getIdToken(true);
```

#### 5. Verificar en la consola de Firebase

Firebase Console → Authentication → Users → seleccionar usuario → Custom claims
Debe mostrar: `{"role":"admin"}`

### Notas

- `serviceAccountKey.json` **nunca** debe subirse al repositorio (ya está en `.gitignore`).
- Cada usuario admin debe ejecutar el script una vez. No hay límite de admins.
- Para revocar: `setCustomUserClaims(uid, { role: null })`.
