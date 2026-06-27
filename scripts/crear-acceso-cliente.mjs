#!/usr/bin/env node
/**
 * scripts/crear-acceso-cliente.mjs
 *
 * Crea la cuenta de Firebase Auth de un cliente (para Vista360-Player)
 * y la vincula a su cliente_id existente en Vista360, escribiendo
 * /portalUsers/{uid}.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
 *   node scripts/crear-acceso-cliente.mjs <cliente_id> <email> <password>
 *
 * Ejemplo:
 *   node scripts/crear-acceso-cliente.mjs abc123 cliente@coca-cola.pe Temporal123!
 *
 * Requisitos:
 *   npm install -D firebase-admin
 *   Descargar serviceAccountKey.json desde Firebase Console →
 *   Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada
 *
 * El cliente debe cambiar esa contraseña la primera vez que entre
 * (Vista360-Player no fuerza esto todavía — pídeselo manualmente).
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const [clienteId, email, password] = process.argv.slice(2);

if (!clienteId || !email || !password) {
  console.error("❌  Uso: node scripts/crear-acceso-cliente.mjs <cliente_id> <email> <password>");
  process.exit(1);
}

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("❌  Falta GOOGLE_APPLICATION_CREDENTIALS (ruta al serviceAccountKey.json).");
  process.exit(1);
}

initializeApp({ credential: cert(credPath) });
const db = getFirestore();
const auth = getAuth();

try {
  // 1. Verificar que el cliente_id realmente existe en Vista360
  const clienteSnap = await db.doc(`clientes/${clienteId}`).get();
  if (!clienteSnap.exists) {
    console.error(`❌  No existe ningún cliente con id "${clienteId}" en Vista360.`);
    console.error("    Revisa el id exacto en Vista360 → CRM → el cliente.");
    process.exit(1);
  }
  const clienteData = clienteSnap.data();

  // 2. Crear (o reusar, si ya existe) la cuenta de Firebase Auth
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    console.log(`ℹ️  Ya existía una cuenta con ese correo (uid: ${userRecord.uid}). Se reutiliza.`);
  } catch {
    userRecord = await auth.createUser({
      email,
      password,
      displayName: clienteData.empresa ?? email,
      emailVerified: false,
    });
    console.log(`✅  Cuenta creada (uid: ${userRecord.uid}).`);
  }

  // 3. Vincular la cuenta con el cliente_id
  await db.doc(`portalUsers/${userRecord.uid}`).set({
    clienteId,
    email,
    nombre: clienteData.empresa ?? "",
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log(`✅  portalUsers/${userRecord.uid} vinculado a cliente "${clienteData.empresa}" (${clienteId}).`);
  console.log("");
  console.log("📋  Datos para entregarle al cliente:");
  console.log(`    URL:        https://vista360-player.pages.dev`);
  console.log(`    Correo:     ${email}`);
  console.log(`    Contraseña: ${password}`);
  console.log("");
  console.log("🔒  Recuérdale que cambie la contraseña en su primer ingreso.");
  process.exit(0);
} catch (err) {
  console.error("❌  Error:", err.message ?? err);
  process.exit(1);
}
