#!/usr/bin/env node
/**
 * scripts/crear-acceso-cliente.mjs
 *
 * Crea la cuenta de Firebase Auth de un cliente (para Vista360-Player),
 * la vincula a su cliente_id existente en Vista360, y le manda un correo
 * AUTOMÁTICO de Firebase con un link para que el cliente cree su propia
 * contraseña — nunca le mandamos una contraseña en texto plano.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
 *   VITE_FIREBASE_API_KEY=... VITE_FIREBASE_AUTH_DOMAIN=... VITE_FIREBASE_PROJECT_ID=... \
 *   node scripts/crear-acceso-cliente.mjs <cliente_id> <email>
 *
 * Más fácil: si ya tienes un .env.local con las VITE_FIREBASE_* (el mismo
 * que usa la app), corre con dotenv:
 *   node --env-file=.env.local scripts/crear-acceso-cliente.mjs <cliente_id> <email>
 *
 * Ejemplo:
 *   node --env-file=.env.local scripts/crear-acceso-cliente.mjs abc123 cliente@coca-cola.pe
 *
 * Requisitos:
 *   npm install -D firebase-admin
 *   Descargar serviceAccountKey.json desde Firebase Console →
 *   Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada
 */

import { randomBytes } from "crypto";
import { initializeApp as initAdmin, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { initializeApp as initClient } from "firebase/app";
import { getAuth as getClientAuth, sendPasswordResetEmail } from "firebase/auth";

const [clienteId, email] = process.argv.slice(2);

if (!clienteId || !email) {
  console.error("❌  Uso: node scripts/crear-acceso-cliente.mjs <cliente_id> <email>");
  process.exit(1);
}

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("❌  Falta GOOGLE_APPLICATION_CREDENTIALS (ruta al serviceAccountKey.json).");
  process.exit(1);
}

const clientConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
};
if (!clientConfig.apiKey || !clientConfig.authDomain || !clientConfig.projectId) {
  console.error("❌  Faltan VITE_FIREBASE_API_KEY / VITE_FIREBASE_AUTH_DOMAIN / VITE_FIREBASE_PROJECT_ID.");
  console.error("    Corre con: node --env-file=.env.local scripts/crear-acceso-cliente.mjs ...");
  process.exit(1);
}

initAdmin({ credential: cert(credPath) });
const db = getFirestore();
const adminAuth = getAdminAuth();
const clientApp = initClient(clientConfig, "client-temporal");
const clientAuth = getClientAuth(clientApp);

try {
  // 1. Verificar que el cliente_id realmente existe en Vista360
  const clienteSnap = await db.doc(`clientes/${clienteId}`).get();
  if (!clienteSnap.exists) {
    console.error(`❌  No existe ningún cliente con id "${clienteId}" en Vista360.`);
    console.error("    Revisa el id exacto en Vista360 → CRM → el cliente.");
    process.exit(1);
  }
  const clienteData = clienteSnap.data();

  // 2. Crear (o reusar, si ya existe) la cuenta de Firebase Auth.
  //    La contraseña es aleatoria y nadie la usa nunca — el cliente va a
  //    crear la suya mediante el link que le llega por correo.
  let userRecord;
  let esNueva = false;
  try {
    userRecord = await adminAuth.getUserByEmail(email);
    console.log(`ℹ️  Ya existía una cuenta con ese correo (uid: ${userRecord.uid}). Se reutiliza.`);
  } catch {
    const passwordTemporal = randomBytes(24).toString("base64url");
    userRecord = await adminAuth.createUser({
      email,
      password: passwordTemporal,
      displayName: clienteData.empresa ?? email,
      emailVerified: false,
    });
    esNueva = true;
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

  // 4. Mandar el correo automático de Firebase para que el cliente cree
  //    su propia contraseña (esto SÍ envía el correo de verdad — no es
  //    solo generar un link, Firebase lo despacha por su cuenta).
  await sendPasswordResetEmail(clientAuth, email, {
    url: "https://vista360-player.pages.dev",
    handleCodeInApp: false,
  });

  console.log("");
  console.log(`📧  Correo enviado a ${email} con el link para crear su contraseña.`);
  console.log(`    URL del portal: https://vista360-player.pages.dev`);
  if (!esNueva) console.log("    (cuenta ya existía — el correo sirve para que reestablezca su contraseña)");
  process.exit(0);
} catch (err) {
  console.error("❌  Error:", err.message ?? err);
  process.exit(1);
}
