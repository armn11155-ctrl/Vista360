/**
 * felicitar-cumpleanos.mjs
 *
 * Todos los días revisa qué clientes cumplen años HOY (comparando
 * solo día y mes de clientes.cumpleanos, ignorando el año) y les
 * manda un correo de felicitación con la firma de la empresa.
 *
 * Se marca con ultimoCumpleFelicitado: "YYYY" para no mandarlo dos
 * veces el mismo año si el script corre más de una vez ese día.
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createTransport } from 'nodemailer';

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;
if (!GMAIL_USER || !GMAIL_PASS) throw new Error('Faltan GMAIL_USER o GMAIL_PASS.');
if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT.');

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!getApps().length) initializeApp({ credential: cert(sa) });
const db = getFirestore();
const t = createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass: GMAIL_PASS } });

const hoy = new Date();
const mesDiaHoy = `${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
const anioActual = String(hoy.getFullYear());

const clientesSnap = await db.collection('clientes').get();
const cumpleanerosHoy = clientesSnap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(c => {
    if (c.deleted || !c.cumpleanos || !c.email) return false;
    if (c.ultimoCumpleFelicitado === anioActual) return false;
    const mesDia = c.cumpleanos.slice(5); // "YYYY-MM-DD" -> "MM-DD"
    return mesDia === mesDiaHoy;
  });

console.log(`🎂 ${cumpleanerosHoy.length} cliente(s) de cumpleaños hoy.`);

for (const c of cumpleanerosHoy) {
  const primerNombre = (c.contacto || c.empresa || '').split(' ')[0] || 'estimado(a)';
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,#2563EB 0%,#7C3AED 100%);border-radius:16px 16px 0 0;padding:36px 28px;text-align:center;">
      <div style="font-size:44px;margin-bottom:8px;">🎉</div>
      <div style="color:#fff;font-size:22px;font-weight:800;">¡Feliz cumpleaños, ${primerNombre}!</div>
    </div>
    <div style="background:#fff;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 16px 16px;padding:28px;">
      <p style="font-size:14.5px;color:#374151;line-height:1.7;margin:0 0 16px;">
        En este día tan especial, todo el equipo de <strong>Vista360</strong> quiere desearte
        un año lleno de éxitos, buena salud y grandes logros — tanto en lo personal como en
        lo profesional.
      </p>
      <p style="font-size:14.5px;color:#374151;line-height:1.7;margin:0 0 24px;">
        Gracias por confiar en nosotros. Es un gusto ser parte del camino de
        <strong>${c.empresa || 'tu empresa'}</strong>.
      </p>
      <p style="font-size:14px;color:#6B7280;margin:0;">Con cariño,</p>
      <p style="font-size:15px;color:#0D1629;font-weight:700;margin:2px 0 0;">Equipo Vista360</p>
    </div>
  </div>`;

  await t.sendMail({
    from: `"Equipo Vista360" <${GMAIL_USER}>`,
    to: c.email,
    subject: `🎉 ¡Feliz cumpleaños, ${primerNombre}! — de parte de Vista360`,
    html,
  });
  await db.collection('clientes').doc(c.id).update({ ultimoCumpleFelicitado: anioActual });
  console.log(`  🎂 Enviado a ${c.empresa} (${c.email})`);
}
