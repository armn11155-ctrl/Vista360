#!/usr/bin/env node
/**
 * scripts/crear-acceso-cliente.mjs
 *
 * Crea una cuenta de Firebase Auth para Vista360-Player, y le manda un
 * correo AUTOMÁTICO de Firebase con un link para que la persona cree su
 * propia contraseña — nunca mandamos una contraseña en texto plano.
 *
 * Dos modos:
 *
 *   CLIENTE — ve solo sus propias campañas:
 *     node --env-file=.env.local scripts/crear-acceso-cliente.mjs <cliente_id> <email>
 *
 *   ADMIN (para ti, el dueño) — ve y gestiona TODOS los clientes, puede
 *   subir evidencias. Es una cuenta aparte de tu login de Vista360 (ERP):
 *     node --env-file=.env.local scripts/crear-acceso-cliente.mjs admin <email>
 *
 * Ejemplos:
 *   node --env-file=.env.local scripts/crear-acceso-cliente.mjs abc123 cliente@coca-cola.pe
 *   node --env-file=.env.local scripts/crear-acceso-cliente.mjs admin tu-correo@ejemplo.com
 *
 * Requisitos:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json (Admin SDK)
 *   npm install -D firebase-admin
 */

import { randomBytes } from "crypto";
import { initializeApp as initAdmin, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { initializeApp as initClient } from "firebase/app";
import { getAuth as getClientAuth, sendPasswordResetEmail } from "firebase/auth";

const [primero, email] = process.argv.slice(2);
const esAdmin = primero === "admin";
const clienteId = esAdmin ? null : primero;

if (!primero || !email) {
  console.error("❌  Uso:");
  console.error("    node scripts/crear-acceso-cliente.mjs <cliente_id> <email>   (cliente)");
  console.error("    node scripts/crear-acceso-cliente.mjs admin <email>          (tú, admin)");
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
  let clienteData = null;
  if (!esAdmin) {
    // Verificar que el cliente_id realmente existe en Vista360
    const clienteSnap = await db.doc(`clientes/${clienteId}`).get();
    if (!clienteSnap.exists) {
      console.error(`❌  No existe ningún cliente con id "${clienteId}" en Vista360.`);
      console.error("    Revisa el id exacto en Vista360 → CRM → el cliente.");
      process.exit(1);
    }
    clienteData = clienteSnap.data();
  }

  // Crear (o reusar, si ya existe) la cuenta de Firebase Auth.
  // La contraseña es aleatoria y nadie la usa nunca — la persona va a
  // crear la suya mediante el link que le llega por correo.
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
      displayName: esAdmin ? "Admin Vista360" : (clienteData.empresa ?? email),
      emailVerified: false,
    });
    esNueva = true;
    console.log(`✅  Cuenta creada (uid: ${userRecord.uid}).`);
  }

  // Vincular la cuenta — admin sin cliente_id (ve todos), cliente con su cliente_id
  const portalDoc = esAdmin
    ? { role: "admin", email, nombre: "Admin Vista360", createdAt: FieldValue.serverTimestamp() }
    : { role: "cliente", clienteId, email, nombre: clienteData.empresa ?? "", createdAt: FieldValue.serverTimestamp() };

  await db.doc(`portalUsers/${userRecord.uid}`).set(portalDoc);
  console.log(
    esAdmin
      ? `✅  portalUsers/${userRecord.uid} creado como ADMIN (ve todos los clientes).`
      : `✅  portalUsers/${userRecord.uid} vinculado a cliente "${clienteData.empresa}" (${clienteId}).`
  );

  // Correo automático de Firebase para crear contraseña — esto SÍ envía
  // el correo de verdad, no es solo generar un link.
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
