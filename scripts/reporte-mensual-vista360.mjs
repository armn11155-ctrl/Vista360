/**
 * reporte-mensual-vista360.mjs
 * Genera el reporte mensual de Vista360 y lo envía por email vía Resend.
 *
 * Colecciones Firestore:
 *   contratos  → monto, pagado, fechaInicio, fechaFin, clienteId, panelId
 *   gastos     → monto, categoria, fecha (Timestamp)
 *   paneles    → tipo, ciudad, estado
 *   clientes   → nombre, estado
 *   proveedores → nombre, categoria
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// ── Configuración ────────────────────────────────────────────────────────────

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_DESTINO  = process.env.EMAIL_DESTINO  || "armn.101@hotmail.com";
const EMAIL_FROM     = process.env.EMAIL_FROM     || "Vista360 <reportes@tu-dominio.com>";

if (!RESEND_API_KEY) throw new Error("Falta RESEND_API_KEY en los secrets de GitHub.");
if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error("Falta FIREBASE_SERVICE_ACCOUNT.");

// ── Período a reportar ───────────────────────────────────────────────────────

const ahora = new Date();
const mesReporte = process.env.MES_INPUT
  ? parseInt(process.env.MES_INPUT, 10)
  : ahora.getMonth() === 0 ? 12 : ahora.getMonth(); // mes anterior (1-indexed)
const anioReporte = process.env.ANIO_INPUT
  ? parseInt(process.env.ANIO_INPUT, 10)
  : mesReporte === 12 ? ahora.getFullYear() - 1 : ahora.getFullYear();

const MESES_ES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const inicio = new Date(anioReporte, mesReporte - 1, 1);
const fin    = new Date(anioReporte, mesReporte, 1);

console.log(`📅 Generando reporte: ${MESES_ES[mesReporte]} ${anioReporte}`);

// ── Firebase Admin ───────────────────────────────────────────────────────────

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n || 0);

function tsToDate(val) {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  if (val?.seconds) return new Date(val.seconds * 1000);
  if (typeof val === "string") return new Date(val);
  return val instanceof Date ? val : null;
}

function enMes(val) {
  const d = tsToDate(val);
  if (!d) return false;
  return d >= inicio && d < fin;
}

function enMesOActivo(inicioVal, finVal) {
  const di = tsToDate(inicioVal);
  const df = tsToDate(finVal);
  if (!di) return false;
  return di < fin && (!df || df >= inicio);
}

// ── Consultas Firestore ──────────────────────────────────────────────────────

async function getAll(col) {
  const snap = await db.collection(col).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

const [contratos, gastos, paneles, clientes, proveedores] = await Promise.all([
  getAll("contratos"),
  getAll("gastos"),
  getAll("paneles"),
  getAll("clientes"),
  getAll("proveedores"),
]);

// ── Cálculos del mes ─────────────────────────────────────────────────────────

const contratosMes   = contratos.filter((c) => enMesOActivo(c.fechaInicio, c.fechaFin));
const contratosNuevos = contratos.filter((c) => enMes(c.fechaInicio));
const contratosVence  = contratos.filter((c) => enMes(c.fechaFin));

const ingTotal  = contratosMes.reduce((a, c) => a + Number(c.monto || 0), 0);
const ingPagado = contratosMes.filter((c) => c.pagado).reduce((a, c) => a + Number(c.monto || 0), 0);
const ingPendiente = ingTotal - ingPagado;

const gastosMes   = gastos.filter((g) => enMes(g.fecha || g.createdAt));
const totalGastos = gastosMes.reduce((a, g) => a + Number(g.monto || 0), 0);
const utilidad    = ingPagado - totalGastos;

// Gastos por categoría
const porCategoria = {};
gastosMes.forEach((g) => {
  const cat = g.categoria || "Otro";
  porCategoria[cat] = (porCategoria[cat] || 0) + Number(g.monto || 0);
});
const topCategorias = Object.entries(porCategoria)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6);

// Paneles
const panActivos   = paneles.filter((p) => p.estado === "Activo" || !p.estado).length;
const panDispon    = paneles.filter((p) => p.estado === "Disponible").length;
const panTotal     = paneles.length;

// Clientes
const cliActivos   = clientes.filter((c) => c.estado === "Activo" || !c.estado).length;
const cliNuevos    = clientes.filter((c) => enMes(c.createdAt)).length;

// Top clientes por ingreso
const ingresoXCli = {};
contratosMes.forEach((c) => {
  if (!c.clienteId) return;
  ingresoXCli[c.clienteId] = (ingresoXCli[c.clienteId] || 0) + Number(c.monto || 0);
});
const topClientes = Object.entries(ingresoXCli)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([id, monto]) => {
    const cli = clientes.find((c) => c.id === id);
    return { nombre: cli?.nombre || cli?.razonSocial || id, monto };
  });

// Proveedores activos
const provActivos = proveedores.length;

// KPIs
const cobPct   = ingTotal > 0 ? Math.round((ingPagado / ingTotal) * 100) : 0;
const gastPct  = ingPagado > 0 ? Math.round((totalGastos / ingPagado) * 100) : 0;

console.log(`💰 Ingresos cobrados: ${fmt(ingPagado)} / ${fmt(ingTotal)}`);
console.log(`📉 Gastos: ${fmt(totalGastos)} | Utilidad: ${fmt(utilidad)}`);
console.log(`📋 Contratos activos: ${contratosMes.length}`);

// ── Generación del HTML ──────────────────────────────────────────────────────

const colorPos = "#065F46";
const colorNeg = "#991B1B";
const utilColor = utilidad >= 0 ? colorPos : colorNeg;

function kpiCard(label, value, sub = "", color = "#1E3A8A") {
  return `
  <td style="width:25%;padding:8px;">
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px 12px;text-align:center;">
      <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">${label}</div>
      <div style="font-size:22px;font-weight:700;color:${color};">${value}</div>
      ${sub ? `<div style="font-size:11px;color:#94A3B8;margin-top:2px;">${sub}</div>` : ""}
    </div>
  </td>`;
}

function barRow(label, value, total, color) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return `
  <tr>
    <td style="padding:5px 0;font-size:12px;color:#475569;width:140px;">${label}</td>
    <td style="padding:5px 8px;">
      <div style="background:#E2E8F0;border-radius:4px;height:8px;overflow:hidden;">
        <div style="width:${pct}%;height:8px;background:${color};border-radius:4px;"></div>
      </div>
    </td>
    <td style="padding:5px 0;font-size:12px;font-weight:600;color:${color};text-align:right;min-width:90px;">${fmt(value)}</td>
  </tr>`;
}

const gastoRows = topCategorias.length
  ? topCategorias.map(([cat, val]) => barRow(cat, val, totalGastos, "#EF4444")).join("")
  : `<tr><td colspan="3" style="color:#94A3B8;font-size:12px;padding:8px 0;">Sin gastos registrados este mes</td></tr>`;

const topCliRows = topClientes.length
  ? topClientes.map((c, i) =>
      `<tr>
        <td style="padding:6px 8px;font-size:13px;color:#1E293B;">${i + 1}. ${c.nombre}</td>
        <td style="padding:6px 8px;font-size:13px;font-weight:600;color:#065F46;text-align:right;">${fmt(c.monto)}</td>
      </tr>`
    ).join("")
  : `<tr><td colspan="2" style="color:#94A3B8;font-size:12px;padding:8px;">Sin datos</td></tr>`;

const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 16px;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#1E3A8A 0%,#3B82F6 100%);padding:32px 32px 24px;text-align:center;">
      <div style="font-size:28px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;">📊 Vista360</div>
      <div style="font-size:15px;color:#BFDBFE;margin-top:6px;">Reporte Mensual · ${MESES_ES[mesReporte]} ${anioReporte}</div>
    </td>
  </tr>

  <!-- KPIs principales -->
  <tr><td style="padding:24px 24px 8px;">
    <div style="font-size:13px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">Resumen Financiero</div>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      ${kpiCard("Cobrado", fmt(ingPagado), `${cobPct}% del total`, colorPos)}
      ${kpiCard("Pendiente", fmt(ingPendiente), `${100 - cobPct}% por cobrar`, "#92400E")}
      ${kpiCard("Gastos", fmt(totalGastos), `${gastPct}% del cobrado`, colorNeg)}
      ${kpiCard("Utilidad neta", fmt(utilidad), utilidad >= 0 ? "✅ Positiva" : "⚠️ Negativa", utilColor)}
    </tr></table>
  </td></tr>

  <!-- Operaciones -->
  <tr><td style="padding:8px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      ${kpiCard("Contratos activos", contratosMes.length, `${contratosNuevos.length} nuevos`, "#1D4ED8")}
      ${kpiCard("Vencen este mes", contratosVence.length, "a renovar", "#B45309")}
      ${kpiCard("Paneles activos", panActivos, `${panDispon} disponibles · ${panTotal} total`, "#6D28D9")}
      ${kpiCard("Clientes", cliActivos, `${cliNuevos} nuevos este mes`, "#0E7490")}
    </tr></table>
  </td></tr>

  <!-- Gastos por categoría -->
  <tr><td style="padding:16px 24px 8px;">
    <div style="font-size:13px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">Gastos por Categoría</div>
    <table width="100%" cellpadding="0" cellspacing="0">${gastoRows}</table>
  </td></tr>

  <!-- Top clientes -->
  ${topClientes.length ? `
  <tr><td style="padding:16px 24px 8px;">
    <div style="font-size:13px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">Top Clientes por Contrato</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
      <tr style="background:#F8FAFC;">
        <th style="padding:8px;font-size:11px;color:#94A3B8;text-align:left;font-weight:500;">CLIENTE</th>
        <th style="padding:8px;font-size:11px;color:#94A3B8;text-align:right;font-weight:500;">MONTO</th>
      </tr>
      ${topCliRows}
    </table>
  </td></tr>` : ""}

  <!-- Ingresos breakdown -->
  <tr><td style="padding:16px 24px;">
    <div style="font-size:13px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">Ingresos del Mes</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${barRow("Total facturado", ingTotal, ingTotal, "#3B82F6")}
      ${barRow("Cobrado", ingPagado, ingTotal, "#10B981")}
      ${barRow("Pendiente de cobro", ingPendiente, ingTotal, "#F59E0B")}
    </table>
  </td></tr>

  <!-- Footer -->
  <tr>
    <td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:20px 32px;text-align:center;">
      <div style="font-size:11px;color:#94A3B8;">Generado automáticamente · ${new Date().toLocaleDateString("es-PE", { dateStyle: "full" })}</div>
      <div style="font-size:11px;color:#CBD5E1;margin-top:4px;">Vista360 — Sistema de gestión de paneles publicitarios</div>
    </td>
  </tr>

</table>
</td></tr>
</table>

</body>
</html>`;

// ── Envío con Resend ─────────────────────────────────────────────────────────

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${RESEND_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: EMAIL_FROM,
    to: [EMAIL_DESTINO],
    subject: `📊 Vista360 — Reporte ${MESES_ES[mesReporte]} ${anioReporte}`,
    html,
  }),
});

const resData = await res.json();
if (!res.ok) {
  console.error("❌ Error Resend:", JSON.stringify(resData));
  process.exit(1);
}

console.log(`✅ Email enviado a ${EMAIL_DESTINO} (id: ${resData.id})`);
