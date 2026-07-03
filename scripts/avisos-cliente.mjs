/**
 * avisos-cliente.mjs
 *
 * Correo automático PARA EL CLIENTE (no para ti) cuando pasa algo que
 * le importa a él, sin que tenga que abrir Vista360 Player a mirar:
 *
 * 1) Su contrato vence en 7 días o menos.
 * 2) Confirmaste que recibiste su pago (renovación).
 * 3) Su solicitud de campaña cambió de estado (revisada/rechazada/
 *    convertida en contrato).
 *
 * Corre a diario. Cada aviso se manda UNA sola vez — se marca con un
 * flag en el propio documento (avisoVencimientoEnviado / pagoNotificado
 * / estadoNotificadoCliente) para no spamear al cliente cada día.
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

const getAll = async col => (await db.collection(col).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [contratos, clientes, paneles, solicitudes] = await Promise.all([
  getAll('contratos'), getAll('clientes'), getAll('paneles'), getAll('solicitudesCampana'),
]);
const clienteById = id => clientes.find(c => c.id === id);
const panelNombre = id => paneles.find(p => p.id === id)?.nombre ?? id;

function envoltorio(titulo, cuerpoHtml) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#0D1629;">
    <h2 style="margin-bottom:4px;">${titulo}</h2>
    ${cuerpoHtml}
    <p style="font-size:11px;color:#9CA3AF;margin-top:28px;">
      Vista360 · Puedes ver el detalle completo en tu portal en cualquier momento.
    </p>
  </div>`;
}

let enviados = 0;

// ── 1) Contratos por vencer en 7 días o menos ──────────────────────────
const hoy = new Date();
const en7dias = new Date(hoy.getTime() + 7 * 86400000);
for (const c of contratos) {
  if (c.avisoVencimientoEnviado) continue;
  if (!c.fin) continue;
  const fin = new Date(c.fin + 'T12:00:00');
  if (fin < hoy || fin > en7dias) continue;
  const cliente = clienteById(c.cliente_id);
  if (!cliente?.email) continue;

  const dias = Math.ceil((fin - hoy) / 86400000);
  await t.sendMail({
    from: `"Vista360" <${GMAIL_USER}>`,
    to: cliente.email,
    subject: `⏰ Tu campaña "${panelNombre(c.panel_id)}" vence en ${dias} día(s)`,
    html: envoltorio(
      '⏰ Tu campaña está por vencer',
      `<p style="font-size:14px;">Hola ${cliente.empresa ?? ''},</p>
       <p style="font-size:14px;">Tu campaña en <strong>${panelNombre(c.panel_id)}</strong> vence
       el <strong>${c.fin}</strong> (en ${dias} día${dias === 1 ? '' : 's'}).</p>
       <p style="font-size:14px;">Si quieres renovarla, puedes solicitarlo directo desde tu portal
       de Vista360 Player — el botón aparece automáticamente en tu campaña cuando está por vencer.</p>`
    ),
  });
  await db.collection('contratos').doc(c.id).update({ avisoVencimientoEnviado: true });
  enviados++;
  console.log(`📧 Aviso de vencimiento enviado a ${cliente.email} (${panelNombre(c.panel_id)})`);
}

// ── 2 y 3) Solicitudes: pago confirmado / cambio de estado ─────────────
for (const s of solicitudes) {
  const cliente = clienteById(s.cliente_id);
  if (!cliente?.email) continue;

  // Pago confirmado
  if (s.pagoConfirmado === true && !s.pagoNotificado) {
    await t.sendMail({
      from: `"Vista360" <${GMAIL_USER}>`,
      to: cliente.email,
      subject: `✅ Recibimos tu pago — "${s.nombre}"`,
      html: envoltorio(
        '✅ Pago confirmado',
        `<p style="font-size:14px;">Hola ${cliente.empresa ?? ''},</p>
         <p style="font-size:14px;">Confirmamos la recepción de tu pago para
         <strong>"${s.nombre}"</strong>. Tu campaña sigue activa sin interrupciones. ¡Gracias!</p>`
      ),
    });
    await db.collection('solicitudesCampana').doc(s.id).update({ pagoNotificado: true });
    enviados++;
    console.log(`📧 Aviso de pago confirmado enviado a ${cliente.email}`);
  }

  // Cambio de estado (revisada / rechazada / convertida)
  if (s.estado !== 'Pendiente' && !s.estadoNotificadoCliente) {
    const mensajes = {
      Rechazada: `Tu solicitud <strong>"${s.nombre}"</strong> fue revisada y, por ahora, no pudo
        ser aprobada. Escríbenos si quieres que lo conversemos.`,
      Revisada: `Tu solicitud <strong>"${s.nombre}"</strong> ya fue revisada por nuestro equipo.
        Pronto te contactamos con los siguientes pasos.`,
      Convertida: `¡Tu solicitud <strong>"${s.nombre}"</strong> ya es una campaña activa! 🎉`,
    };
    await t.sendMail({
      from: `"Vista360" <${GMAIL_USER}>`,
      to: cliente.email,
      subject: s.estado === 'Rechazada'
        ? `Actualización de tu solicitud — "${s.nombre}"`
        : `✅ Novedades de tu solicitud — "${s.nombre}"`,
      html: envoltorio(
        'Actualización de tu solicitud',
        `<p style="font-size:14px;">Hola ${cliente.empresa ?? ''},</p>
         <p style="font-size:14px;">${mensajes[s.estado] ?? `Tu solicitud "${s.nombre}" cambió de estado.`}</p>`
      ),
    });
    await db.collection('solicitudesCampana').doc(s.id).update({ estadoNotificadoCliente: true });
    enviados++;
    console.log(`📧 Aviso de "${s.estado}" enviado a ${cliente.email}`);
  }
}

console.log(`\n✅ Listo. ${enviados} correo(s) enviado(s) a clientes.`);
