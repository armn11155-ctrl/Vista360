/**
 * liberar-paneles-vencidos.mjs
 *
 * Al crear un contrato, el panel se marca "Ocupado" automáticamente
 * (ver Contratos.tsx y CRM.tsx). Pero nada lo vuelve a marcar "Libre"
 * cuando el contrato termina — se quedaba "Ocupado" para siempre,
 * aunque la campaña ya hubiera acabado, y no se podía saber qué
 * paneles estaban realmente disponibles para vender.
 *
 * Este script corre todos los días: por cada panel marcado "Ocupado",
 * revisa si TODOS sus contratos ya vencieron (fin < hoy). Si es así,
 * lo vuelve a marcar "Libre". Si tiene al menos un contrato vigente
 * o futuro, lo deja como está.
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT.');
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!getApps().length) initializeApp({ credential: cert(sa) });
const db = getFirestore();

const getAll = async col => (await db.collection(col).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [paneles, contratos] = await Promise.all([getAll('paneles'), getAll('contratos')]);

const hoy = new Date();
const contratosVigentesPorPanel = new Map(); // panel_id -> hay al menos un contrato vigente/futuro

for (const c of contratos) {
  if (c.deleted) continue;
  const fin = c.fin ? new Date(c.fin + 'T23:59:59') : null;
  if (fin && fin >= hoy) {
    contratosVigentesPorPanel.set(c.panel_id, true);
  }
}

let liberados = 0;
for (const p of paneles) {
  if (p.deleted) continue;
  if (p.estado !== 'Ocupado') continue;
  const tieneVigente = contratosVigentesPorPanel.get(p.id);
  if (!tieneVigente) {
    await db.collection('paneles').doc(p.id).update({ estado: 'Libre' });
    console.log(`🟢 ${p.nombre} (${p.id}) — liberado, ya no tiene contratos vigentes.`);
    liberados++;
  }
}

console.log(`\n✅ Listo. ${liberados} panel(es) liberado(s) de ${paneles.length} revisados.`);
