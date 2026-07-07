# Branching strategy

Este repositorio usa un flujo de trabajo basado en **main / develop / feature**.

## Ramas principales

| Rama       | Propósito                                  | Directamente pusheable |
|------------|--------------------------------------------|------------------------|
| `main`     | Producción — desplegado automáticamente    | ❌ Solo vía PR          |
| `develop`  | Integración — base de todas las features   | ❌ Solo vía PR          |

## Ramas de trabajo

| Prefijo         | Cuándo usarla                              | Ejemplo                         |
|-----------------|--------------------------------------------|---------------------------------|
| `feature/`      | Nueva funcionalidad                        | `feature/mapa-calor-paneles`    |
| `fix/`          | Corrección de bug                          | `fix/login-redirect-loop`       |
| `hotfix/`       | Corrección urgente en producción           | `hotfix/firestore-rules-typo`   |
| `chore/`        | Mantenimiento, deps, docs                  | `chore/update-firebase-sdk`     |
| `refactor/`     | Refactor sin cambio de comportamiento      | `refactor/extract-use-paneles`  |

## Flujo de trabajo

```
develop
  └── feature/nombre-descriptivo
        └── PR → develop  (squash merge)
              └── PR → main  (merge commit, genera release)
```

1. Crea tu rama desde `develop`:
   ```bash
   git checkout develop && git pull
   git checkout -b feature/mi-feature
   ```

2. Desarrolla, commitea con [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat(paneles): add heatmap overlay
   fix(auth): redirect to /login on token expiry
   ```

3. Abre PR hacia `develop`. El CI debe pasar (lint + typecheck + format + tests + build).

4. Cuando `develop` está estable, abre PR de `develop` → `main` para el release.

## Reglas de protección (configurar en GitHub Settings → Branches)

- `main`: requiere 1 review + CI verde + no force-push
- `develop`: requiere CI verde + no force-push

## Convención de commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>(<scope>): <descripción corta>

[cuerpo opcional]

[footer opcional — BREAKING CHANGE, closes #N]
```

Tipos válidos: `feat` `fix` `docs` `style` `refactor` `test` `chore` `ci` `perf`
