import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// ── Validación de variables de entorno requeridas ─────────────────
// Falla rápido en dev y en build si falta alguna config crítica.
const REQUIRED_ENV: Array<[string, string | undefined]> = [
  ["VITE_FIREBASE_API_KEY", import.meta.env.VITE_FIREBASE_API_KEY],
  ["VITE_FIREBASE_AUTH_DOMAIN", import.meta.env.VITE_FIREBASE_AUTH_DOMAIN],
  ["VITE_FIREBASE_PROJECT_ID", import.meta.env.VITE_FIREBASE_PROJECT_ID],
];

const missing = REQUIRED_ENV.filter(([, v]) => !v).map(([k]) => k);
if (missing.length > 0) {
  throw new Error(
    `[Vista360] Variables de entorno faltantes: ${missing.join(", ")}\n` +
      "Copia .env.example a .env.local y completa los valores de Firebase.",
  );
}

// ── Validación opcional: Cloudinary (solo warn, no bloquea el boot) ─
const CLOUDINARY_VARS = ["VITE_CLOUDINARY_CLOUD_NAME", "VITE_CLOUDINARY_UPLOAD_PRESET"] as const;
const missingCloudinary = CLOUDINARY_VARS.filter(k => !import.meta.env[k]);
if (missingCloudinary.length > 0) {
  console.warn(
    `[Vista360] Cloudinary no configurado: ${missingCloudinary.join(", ")}. ` +
      "La carga de imágenes estará deshabilitada.",
  );
}

// ── Mount ─────────────────────────────────────────────────────────
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found in index.html");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
