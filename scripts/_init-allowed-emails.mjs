import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!getApps().length) initializeApp({ credential: cert(sa) });
const db = getFirestore();

// Mismos correos que ya usa isOwner() en Finanzas — punto de partida
// razonable para quién puede tocar facturas también.
const emails = ['armn.101@hotmail.com', 'armn.11155@gmail.com'];

await db.collection('config').doc('allowedEmails').set({ emails });
console.log(`✅ config/allowedEmails creado con ${emails.length} correo(s).`);
