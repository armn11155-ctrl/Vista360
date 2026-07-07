/**
 * backup-firestore.mjs
 *
 * Respaldo diario de toda la base de datos — clientes, contratos,
 * facturas, todo. Descarga cada colección como JSON y lo guarda en
 * el repo (rama "backups"), así el historial de git ES el historial
 * de respaldos: si algo se borra o se corrompe por accidente, se
 * puede recuperar exactamente cómo estaba cualquier día anterior.
 *
 * No usa la API de exportación de Firestore (esa necesita un permiso
 * de proyecto — "Service Usage" — que esta credencial no tiene, el
 * mismo problema que tuvimos al desplegar reglas con el CLI). En vez
 * de eso, simplemente LEE cada colección (algo que ya hacen todos los
 * demás scripts sin problema) y la guarda tal cual.
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync, mkdirSync } from 'fs';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!getApps().length) initializeApp({ credential: cert(sa) });
const db = getFirestore();

// Todas las colecciones que existen hoy en el proyecto — si agregas
// una colección nueva más adelante, hay que sumarla aquí también.
const COLECCIONES = [
  'clientes', 'contratos', 'paneles', 'gastos', 'proveedores', 'facturas',
  'sueldos', 'solicitudesCampana', 'solicitudesWeb', 'informesCliente',
  'portalUsers', 'config', 'invitacionesPortal',
];

const fecha = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const carpeta = `backups/${fecha}`;
mkdirSync(carpeta, { recursive: true });

let totalDocs = 0;
for (const nombre of COLECCIONES) {
  try {
    const snap = await db.collection(nombre).get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    writeFileSync(`${carpeta}/${nombre}.json`, JSON.stringify(docs, null, 2));
    console.log(`  ✓ ${nombre}: ${docs.length} documento(s)`);
    totalDocs += docs.length;
  } catch (e) {
    console.warn(`  ⚠️  ${nombre}: error — ${e.message}`);
  }
}

console.log(`\n✅ Respaldo del ${fecha} completo — ${totalDocs} documentos en total.`);
