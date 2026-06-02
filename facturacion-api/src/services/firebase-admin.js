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
/**
 * Actualiza un contrato existente en Firestore.
 * Usado por la API cuando una factura es emitida o cobrada:
 * bloquea los meses correspondientes y sincroniza el estado de pago.
 *
 * Usa dot-notation para mergear claves individuales de mesesFacturados
 * y pagosMeses sin sobreescribir el mapa completo.
 *
 * @param {string} contratoFirebaseId
 * @param {object} updates
 * @param {string}  [updates.factura_id]       UUID de la factura en Postgres
 * @param {string}  [updates.factura_numero]    Número formateado p.ej. "F001-00000001"
 * @param {string}  [updates.factura_estado]    "Emitida" | "Cobrada"
 * @param {boolean} [updates.pagado]
 * @param {Record<string,string>} [updates.mesesFacturados]  key "YYYY-MM" → estado
 * @param {Record<string,boolean>} [updates.pagosMeses]      key "YYYY-MM" → true
 */
export async function actualizarContratoFirestore(contratoFirebaseId, updates = {}) {
  const db = getAdminDb()
  const payload = { updatedAt: FieldValue.serverTimestamp() }

  if (updates.factura_id      !== undefined) payload.factura_id      = updates.factura_id
  if (updates.factura_numero  !== undefined) payload.factura_numero  = updates.factura_numero
  if (updates.factura_estado  !== undefined) payload.factura_estado  = updates.factura_estado
  if (updates.pagado          !== undefined) payload.pagado          = updates.pagado

  // Mergear mes a mes sin sobreescribir el mapa completo
  if (updates.mesesFacturados) {
    for (const [k, v] of Object.entries(updates.mesesFacturados)) {
      payload[`mesesFacturados.${k}`] = v
    }
  }
  if (updates.pagosMeses) {
    for (const [k, v] of Object.entries(updates.pagosMeses)) {
      payload[`pagosMeses.${k}`] = v
    }
  }

  await db.collection('contratos').doc(contratoFirebaseId).update(payload)
}

export async function anularContratoFirestore(contratoFirebaseId, motivo = '') {
  const db = getAdminDb()
  await db.collection('contratos').doc(contratoFirebaseId).update({
    deleted:    true,
    deletedAt:  FieldValue.serverTimestamp(),
    motivoBaja: motivo,
  })
}
