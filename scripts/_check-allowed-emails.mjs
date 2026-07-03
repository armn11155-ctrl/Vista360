import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!getApps().length) initializeApp({ credential: cert(sa) });
const db = getFirestore();

const snap = await db.collection('config').doc('allowedEmails').get();
if (!snap.exists) {
  console.log('❌ El documento config/allowedEmails NO existe. isAllowed() bloqueará a TODOS de crear facturas.');
  process.exit(0);
}
const data = snap.data();
const emails = Array.isArray(data?.emails) ? data.emails : [];
console.log(`✅ config/allowedEmails existe. ${emails.length} correo(s) en la lista:`);
// Solo mostramos cuántos y una versión parcial (no exponer correos completos en logs públicos del repo)
for (const e of emails) {
  const [user, domain] = String(e).split('@');
  console.log(`   - ${user?.slice(0, 3)}***@${domain}`);
}
