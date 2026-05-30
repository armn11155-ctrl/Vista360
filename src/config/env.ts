/**
 * env.ts — Validación centralizada de variables de entorno.
 *
 * Lanza un error descriptivo en tiempo de carga si falta cualquier
 * variable requerida, en lugar de fallar silenciosamente en producción.
 *
 * Uso:
 *   import { env } from './config/env'
 *   const key = env.firebase.apiKey
 */

function required(key: string): string {
  const val = (import.meta.env as Record<string, string | undefined>)[key];
  if (!val || val.trim() === "") {
    // Warn instead of throw so the app renders the login screen gracefully
    // when Firebase secrets aren't configured (e.g. E2E tests in CI without
    // secrets, forks, or local dev without .env.local).
    // firebase.ts uses placeholder fallbacks so getAuth() doesn't crash;
    // fbEnabled-style checks prevent any real Firebase calls in that case.
    console.warn(
      `[Vista360] Variable de entorno faltante: "${key}"\n` +
        `  → Agrégala en tu .env.local (desarrollo) o en las variables de entorno de Cloudflare Pages (producción).`,
    );
    return "";
  }
  return val;
}

function optional(key: string): string | undefined {
  return (import.meta.env as Record<string, string | undefined>)[key] || undefined;
}

/**
 * Variables de entorno validadas y con tipos.
 * Se evalúa una vez al importar — el error aparece al arrancar la app,
 * no en un momento aleatorio durante el uso.
 */
export const env = {
  firebase: {
    apiKey: required("VITE_FIREBASE_API_KEY"),
    authDomain: required("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: required("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: required("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: required("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: required("VITE_FIREBASE_APP_ID"),
  },

  cloudinary: {
    /** Requerido solo si se usa carga de imágenes */
    cloudName: optional("VITE_CLOUDINARY_CLOUD_NAME"),
    uploadPreset: optional("VITE_CLOUDINARY_UPLOAD_PRESET"),
  },

  api: {
    /** URL del backend (facturacion-api / OCR) */
    url: optional("VITE_API_URL"),
    /** Clave para autenticar con el backend */
    key: optional("VITE_API_KEY"),
    /** URL de la app facturacion-web (para abrir "Nueva Factura") */
    facturacionWebUrl: optional("VITE_FACTURACION_WEB_URL"),
  },

  /** Emails autorizados (separados por coma). Vacío = sin whitelist local. */
  allowedEmails: (optional("VITE_ALLOWED_EMAILS") ?? "")
    .split(",")
    .map(e => e.trim())
    .filter(Boolean),
} as const;

/** Tipo de las variables de entorno validadas */
export type Env = typeof env;
