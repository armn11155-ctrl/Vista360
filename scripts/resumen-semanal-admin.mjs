/**
 * resumen-semanal-admin.mjs
 *
 * Correo semanal PARA TI (no para clientes) con lo que necesita tu
 * atención: contratos que vencen en los próximos 7 días, solicitudes
 * de campaña pendientes (desde Vista360 Player) y solicitudes web sin
 * atender. Reutiliza los mismos secretos ya configurados (GMAIL_USER,
 * GMAIL_PASS, FIREBASE_SERVICE_ACCOUNT) — no necesita nada nuevo.
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createTransport } from 'nodemailer';

const GMAIL_USER    = process.env.GMAIL_USER;
const GMAIL_PASS    = process.env.GMAIL_PASS;
const EMAIL_DESTINO = process.env.EMAIL_DESTINO || 'armn.101@hotmail.com';
if (!GMAIL_USER || !GMAIL_PASS) throw new Error('Faltan GMAIL_USER o GMAIL_PASS.');
if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT.');

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!getApps().length) initializeApp({ credential: cert(sa) });
const db = getFirestore();
const getAll = async col => (await db.collection(col).get()).docs.map(d => ({ id: d.id, ...d.data() }));

const [contratos, clientes, paneles, solicitudesCampana, solicitudesWeb] = await Promise.all([
  getAll('contratos'), getAll('clientes'), getAll('paneles'),
  getAll('solicitudesCampana'), getAll('solicitudesWeb'),
]);

const clienteNombre = id => clientes.find(c => c.id === id)?.empresa || '—';
const panelNombre = id => paneles.find(p => p.id === id)?.nombre || '—';

// ── Contratos que vencen en los próximos 7 días ──────────────────────
const hoy = new Date();
const en7dias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000);
const porVencer = contratos.filter(c => {
  if (!c.fin) return false;
  const fin = new Date(c.fin + 'T12:00:00');
  return fin >= hoy && fin <= en7dias;
}).sort((a, b) => new Date(a.fin) - new Date(b.fin));

// ── Solicitudes de campaña pendientes (Vista360 Player) ──────────────
const solCampPendientes = solicitudesCampana.filter(s => s.estado === 'Pendiente');

// ── Solicitudes web sin importar/rechazar ────────────────────────────
const solWebPendientes = solicitudesWeb.filter(s => !s.importado);

// ── Campañas activas sin evidencia reciente (14+ días o nunca) ───────
const estadoCampana = c => {
  const inicio = new Date(c.inicio), fin = new Date(c.fin);
  if (hoy < inicio) return 'Programada';
  if (hoy > fin) return 'Finalizada';
  return 'Activa';
};
const en14dias = new Date(hoy.getTime() - 14 * 24 * 60 * 60 * 1000);
const sinEvidencia = contratos.filter(c => {
  if (estadoCampana(c) !== 'Activa') return false;
  const fotos = c.fotos_campania || [];
  if (fotos.length === 0) return true;
  const ultima = fotos.map(f => new Date(f.fecha)).sort((a, b) => b - a)[0];
  return ultima < en14dias;
});

const total = porVencer.length + solCampPendientes.length + solWebPendientes.length + sinEvidencia.length;
console.log(`📋 Resumen semanal: ${porVencer.length} contrato(s) por vencer, ${solCampPendientes.length} solicitud(es) de campaña, ${solWebPendientes.length} lead(s) web, ${sinEvidencia.length} panel(es) sin evidencia reciente.`);

if (total === 0) {
  console.log('✅ Nada pendiente esta semana — no se envía correo.');
  process.exit(0);
}

const fmtF = s => { try { return new Date(s + 'T12:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }); } catch { return s || '—'; } };

const filaContrato = c => `
  <tr>
    <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;">${clienteNombre(c.cliente_id)}</td>
    <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;">${panelNombre(c.panel_id)}</td>
    <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;color:#DC2626;font-weight:600;">${fmtF(c.fin)}</td>
  </tr>`;

const filaSolCamp = s => `
  <tr>
    <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;">${clienteNombre(s.cliente_id)}</td>
    <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;">${s.nombre || '—'}</td>
    <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;">${s.objetivo || '—'}</td>
  </tr>`;

const filaSolWeb = s => `
  <tr>
    <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;">${s.empresa || s.contacto || '—'}</td>
    <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;">${s.celular || '—'}</td>
    <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;">${s.email || '—'}</td>
  </tr>`;

const html = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0D1629;">
  <h2 style="margin-bottom:4px;">📋 Resumen semanal — Vista360</h2>
  <p style="color:#6B7280;font-size:13px;margin-top:0;">Lo que necesita tu atención esta semana.</p>

  ${porVencer.length > 0 ? `
  <h3 style="font-size:15px;margin-bottom:6px;">⏰ Contratos por vencer (próximos 7 días)</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
    <thead><tr style="text-align:left;color:#6B7280;font-size:11px;text-transform:uppercase;">
      <th style="padding-bottom:6px;">Cliente</th><th>Panel</th><th>Vence</th>
    </tr></thead>
    <tbody>${porVencer.map(filaContrato).join('')}</tbody>
  </table>` : ''}

  ${solCampPendientes.length > 0 ? `
  <h3 style="font-size:15px;margin-bottom:6px;">🎯 Solicitudes de campaña pendientes (Player)</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
    <thead><tr style="text-align:left;color:#6B7280;font-size:11px;text-transform:uppercase;">
      <th style="padding-bottom:6px;">Cliente</th><th>Nombre</th><th>Objetivo</th>
    </tr></thead>
    <tbody>${solCampPendientes.map(filaSolCamp).join('')}</tbody>
  </table>
  <p style="font-size:12px;color:#6B7280;margin-top:-12px;margin-bottom:20px;">Revísalas en Vista360 → CRM → "Solicitudes de campaña (Player)".</p>` : ''}

  ${solWebPendientes.length > 0 ? `
  <h3 style="font-size:15px;margin-bottom:6px;">🌐 Leads del sitio web sin atender</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
    <thead><tr style="text-align:left;color:#6B7280;font-size:11px;text-transform:uppercase;">
      <th style="padding-bottom:6px;">Empresa/Contacto</th><th>Celular</th><th>Email</th>
    </tr></thead>
    <tbody>${solWebPendientes.map(filaSolWeb).join('')}</tbody>
  </table>` : ''}

  ${sinEvidencia.length > 0 ? `
  <h3 style="font-size:15px;margin-bottom:6px;">📸 Campañas activas sin evidencia reciente (14+ días)</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
    <thead><tr style="text-align:left;color:#6B7280;font-size:11px;text-transform:uppercase;">
      <th style="padding-bottom:6px;">Cliente</th><th>Panel</th>
    </tr></thead>
    <tbody>${sinEvidencia.map(c => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;">${clienteNombre(c.cliente_id)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;">${panelNombre(c.panel_id)}</td>
    </tr>`).join('')}</tbody>
  </table>` : ''}

  <p style="font-size:11px;color:#9CA3AF;margin-top:24px;">Vista360 · Resumen automático semanal (todos los lunes).</p>
</div>`;

const t = createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass: GMAIL_PASS } });
await t.sendMail({
  from: `"Vista360" <${GMAIL_USER}>`,
  to: EMAIL_DESTINO,
  subject: `📋 Resumen semanal Vista360 — ${total} pendiente(s)`,
  html,
});
console.log(`📧 Resumen enviado a ${EMAIL_DESTINO}`);
