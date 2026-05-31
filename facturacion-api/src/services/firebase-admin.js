// ══════════════════════════════════════════════════════════════════
// FIREBASE ADMIN — Escritura a Firestore desde facturacion-api
// ──────────────────────────────────────────────────────────────────
// Permite que la API de facturación cree documentos en Firebase
// (contratos, notificaciones) cuando se emite una factura con período.
//
// REQUISITOS de la cuenta de servicio (GOOGLE_SERVICE_ACCOUNT_JSON):
//   · roles/datastore.user   → para escribir en Firestore
//   · roles/monitoring.viewer → ya necesario para firebase-usage
//
// Si usas una cuenta de servicio distinta para Firestore, agrega:
//   FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON en tu .env
// ══════════════════════════════════════════════════════════════════

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

let _db = null

/**
 * Inicializa Firebase Admin y retorna la instancia de Firestore.
 * Se inicializa solo una vez (patrón singleton).
 */
function getAdminDb() {
  if (_db) return _db

  // Usar cuenta de servicio dedicada si existe, si no, la general
  const saRaw =
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON

  if (!saRaw) {
    throw new Error(
      'Configura FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON (o GOOGLE_SERVICE_ACCOUNT_JSON) ' +
      'con una cuenta de servicio que tenga roles/datastore.user para Firestore.'
    )
  }

  const serviceAccount = JSON.parse(saRaw)

  if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount) })
  }

  _db = getFirestore()
  return _db
}

/**
 * Crea un contrato en la colección "contratos" de Firestore.
 * Se llama automáticamente cuando una factura tiene periodo_inicio y periodo_fin.
 *
 * @param {object} opts
 * @param {string} opts.panel_firebase_id   - ID del documento en paneles/
 * @param {string} opts.cliente_firebase_id - ID del documento en clientes/
 * @param {'A'|'B'|null} opts.cara          - Cara del panel ('A', 'B', o null para panel de 1 cara)
 * @param {string} opts.inicio              - Fecha inicio 'YYYY-MM-DD'
 * @param {string} opts.fin                 - Fecha fin   'YYYY-MM-DD'
 * @param {number} opts.monto               - Monto mensual en PEN
 * @param {boolean} opts.pagado             - Si la factura ya está pagada
 * @param {string} opts.factura_id          - UUID de la factura en Postgres
 * @param {string} opts.factura_numero      - Número formateado p.ej. "F001-00000001"
 */
export async function crearContratoFirestore({
  panel_firebase_id,
  cliente_firebase_id,
  cara = null,
  inicio,
  fin,
  monto,
  pagado = false,
  factura_id,
  factura_numero,
}) {
  const db = getAdminDb()

  // Construir pagosMeses vacío (se marcará desde Vista360 o la facturación web)
  const pagosMeses = {}

  const doc = {
    panel_id:     panel_firebase_id,
    cliente_id:   cliente_firebase_id,
    cara:         cara,               // null | 'A' | 'B'
    inicio,
    fin,
    monto,
    pagado,
    pagosMeses,
    // Referencia a la factura que originó este contrato
    factura_id,
    factura_numero,
    // Auditoría
    deleted:      false,
    createdAt:    FieldValue.serverTimestamp(),
    updatedAt:    FieldValue.serverTimestamp(),
    // Origen: para distinguirlos de contratos manuales en Vista360
    origen:       'facturacion_api',
  }

  const ref = await db.collection('contratos').add(doc)
  return ref.id
}

/**
 * Elimina (soft-delete) un contrato en Firestore cuando la factura es anulada.
 *
 * @param {string} contratoFirebaseId - ID del documento en contratos/
 * @param {string} motivo             - Motivo de anulación
 */
export async function anularContratoFirestore(contratoFirebaseId, motivo = '') {
  const db = getAdminDb()
  await db.collection('contratos').doc(contratoFirebaseId).update({
    deleted:    true,
    deletedAt:  FieldValue.serverTimestamp(),
    motivoBaja: motivo,
  })
}
