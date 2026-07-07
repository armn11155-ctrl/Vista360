#!/usr/bin/env node
/**
 * scripts/seed-allowed-emails.mjs
 *
 * Crea o actualiza el documento /config/allowedEmails en Firestore
 * con la lista de emails permitidos definida en VITE_ALLOWED_EMAILS.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
 *   VITE_ALLOWED_EMAILS=tu@email.com,otro@email.com \
 *   node scripts/seed-allowed-emails.mjs
 *
 * O con .env.local:
 *   node -r dotenv/config scripts/seed-allowed-emails.mjs dotenv_config_path=.env.local
 *
 * Requisitos:
 *   npm install -D firebase-admin dotenv
 *   Descargar serviceAccountKey.json desde Firebase Console →
 *   Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const rawEmails = process.env.VITE_ALLOWED_EMAILS ?? "";
const emails = rawEmails
  .split(",")
  .map(e => e.trim())
  .filter(Boolean);

if (emails.length === 0) {
  console.error("❌  No se encontraron emails en VITE_ALLOWED_EMAILS.");
  console.error("    Ejemplo: VITE_ALLOWED_EMAILS=tu@gmail.com node scripts/seed-allowed-emails.mjs");
  process.exit(1);
}

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("❌  Falta GOOGLE_APPLICATION_CREDENTIALS (ruta al serviceAccountKey.json).");
  process.exit(1);
}

initializeApp({ credential: cert(credPath) });
const db = getFirestore();

try {
  await db.doc("config/allowedEmails").set({ emails }, { merge: true });
  console.log("✅  /config/allowedEmails actualizado con:");
  emails.forEach(e => console.log(`   • ${e}`));
  console.log("\n🔒  Ahora despliega las reglas:");
  console.log("    firebase deploy --only firestore:rules");
  process.exit(0);
} catch (err) {
  console.error("❌  Error escribiendo en Firestore:", err);
  process.exit(1);
}
