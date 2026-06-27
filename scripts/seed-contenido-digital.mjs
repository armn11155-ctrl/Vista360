#!/usr/bin/env node
/**
 * scripts/seed-contenido-digital.mjs
 *
 * Crea/actualiza un documento de prueba en /contenidoDigital/{panelId}
 * para probar Vista360-Player sin tener que entrar a la consola de
 * Firebase a mano.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
 *   node scripts/seed-contenido-digital.mjs panel-001
 *
 * Requisitos:
 *   npm install -D firebase-admin
 *   Descargar serviceAccountKey.json desde Firebase Console →
 *   Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const panelId = process.argv[2];
if (!panelId) {
  console.error("❌  Falta el ID del panel.");
  console.error("    Uso: node scripts/seed-contenido-digital.mjs panel-001");
  process.exit(1);
}

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("❌  Falta GOOGLE_APPLICATION_CREDENTIALS (ruta al serviceAccountKey.json).");
  process.exit(1);
}

initializeApp({ credential: cert(credPath) });
const db = getFirestore();

// Imágenes de muestra públicas — reemplaza por las reales del cliente.
const demo = {
  panel_id: panelId,
  activo: true,
  items: [
    {
      tipo: "imagen",
      url: "https://picsum.photos/seed/v360-a/1920/1080",
      duracionSeg: 8,
      orden: 1,
    },
    {
      tipo: "imagen",
      url: "https://picsum.photos/seed/v360-b/1920/1080",
      duracionSeg: 8,
      orden: 2,
    },
  ],
  updatedAt: FieldValue.serverTimestamp(),
};

try {
  await db.doc(`contenidoDigital/${panelId}`).set(demo, { merge: true });
  console.log(`✅  contenidoDigital/${panelId} creado con 2 imágenes de prueba.`);
  console.log("    Abre Vista360-Player y conéctalo con ese mismo ID de panel.");
  process.exit(0);
} catch (err) {
  console.error("❌  Error escribiendo en Firestore:", err);
  process.exit(1);
}
