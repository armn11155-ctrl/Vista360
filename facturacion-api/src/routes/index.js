import { Router } from 'express'
import { authJWT, authApiKey, auth, soloAdmin } from '../middleware/auth.js'
import rateLimit from 'express-rate-limit'
import { query } from '../db/pool.js'

// Controllers
import * as authCtrl from '../controllers/auth.js'
import * as factCtrl  from '../controllers/facturas.js'
import * as cliCtrl   from '../controllers/clientes.js'
import { analizarImagen }  from '../controllers/ocr.js'
import { eliminarImagen }  from '../controllers/cloudinary.js'
import { getFirebaseUsage } from '../controllers/firebaseUsage.js'
import * as sireCtrl from '../controllers/sire.js'

const router = Router()

// ── AUTH ──────────────────────────────────────────────────────────
router.post('/auth/login',    authCtrl.login)
router.get ('/auth/me',       authJWT, authCtrl.me)
router.post('/auth/api-keys', authJWT, soloAdmin, authCtrl.generarApiKey)

// ── OCR — Proxy seguro a Google Cloud Vision ──────────────────────
const ocrLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { ok: false, error: 'Límite de escaneos alcanzado. Espera 15 minutos.' },
})
router.post('/ocr', ocrLimit, authApiKey, analizarImagen)

// ── CLOUDINARY — Eliminación segura de imágenes ───────────────────
router.post('/cloudinary/delete', authApiKey, eliminarImagen)

// ── FIREBASE USAGE ────────────────────────────────────────────────
router.get('/firebase/usage', authApiKey, getFirebaseUsage)

// ── FACTURAS ──────────────────────────────────────────────────────
router.get ('/facturas',            auth, factCtrl.listar)
router.get ('/facturas/:id',        auth, factCtrl.obtener)
router.post('/facturas',            authJWT, factCtrl.crear)
router.post('/facturas/:id/emitir', authJWT, factCtrl.emitir)
router.post('/facturas/:id/cobrar', authJWT, factCtrl.cobrar)
router.post('/facturas/:id/anular', authJWT, factCtrl.anular)

// ── CLIENTES ──────────────────────────────────────────────────────
router.get ('/clientes',    auth, cliCtrl.listar)
router.post('/clientes',    authJWT, cliCtrl.crear)
router.put ('/clientes/:id', authJWT, cliCtrl.actualizar)

// ── VISTA360 — Facturas por panel/cliente ─────────────────────────
router.get('/vista360/facturas', authApiKey, async (req, res) => {
  try {
    const { panel_firebase_id, cliente_firebase_id, estado, limit = 20 } = req.query
    const conditions = ['f.deleted = false']
    const params = []
    let i = 1

    if (panel_firebase_id)   { conditions.push(`p.firebase_id = $${i++}`); params.push(panel_firebase_id) }
    if (cliente_firebase_id) { conditions.push(`c.firebase_id = $${i++}`); params.push(cliente_firebase_id) }
    if (estado)              { conditions.push(`f.estado = $${i++}`);      params.push(estado) }

    const { rows } = await query(
      `SELECT f.id, f.numero_fmt, f.tipo_doc, f.estado, f.sunat_estado,
              f.total, f.moneda, f.fecha_emision, f.fecha_vencimiento,
              f.pdf_url, f.xml_url, f.cdr_url, f.hash,
              f.pagado, f.fecha_pago,
              f.cliente_nombre, f.panel_nombre
       FROM facturas f
       LEFT JOIN paneles  p ON p.id = f.panel_id
       LEFT JOIN clientes c ON c.id = f.cliente_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY f.fecha_emision DESC
       LIMIT $${i}`,
      [...params, parseInt(limit)]
    )
    res.json({ ok: true, data: rows })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── REPORTES ──────────────────────────────────────────────────────
router.get('/reportes/resumen', auth, async (req, res) => {
  try {
    const { anio = new Date().getFullYear() } = req.query

    const { rows: mensual } = await query(
      `SELECT
        to_char(fecha_emision, 'YYYY-MM') AS mes,
        to_char(fecha_emision, 'Mon')     AS mes_label,
        COUNT(*) AS comprobantes,
        SUM(total) AS facturado,
        SUM(total) FILTER (WHERE estado IN ('Cobrada','Pagada')) AS cobrado,
        SUM(total) FILTER (WHERE estado IN ('Emitida','Aceptada','Pendiente')) AS pendiente,
        SUM(total) FILTER (WHERE estado = 'Vencida') AS vencido
       FROM facturas
       WHERE deleted = false
         AND EXTRACT(YEAR FROM fecha_emision) = $1
         AND estado NOT IN ('Anulada','Rechazada')
       GROUP BY 1, 2
       ORDER BY 1`,
      [parseInt(anio)]
    )

    const { rows: topClientes } = await query(
      `SELECT
        cliente_nombre, cliente_doc,
        COUNT(*) AS comprobantes,
        SUM(total) AS total_facturado,
        SUM(total) FILTER (WHERE estado IN ('Cobrada','Pagada')) AS total_cobrado
       FROM facturas
       WHERE deleted = false AND estado NOT IN ('Anulada','Rechazada')
       GROUP BY cliente_nombre, cliente_doc
       ORDER BY total_facturado DESC
       LIMIT 10`
    )

    res.json({ ok: true, data: { mensual, topClientes } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── HEALTH CHECK ──────────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'Facturación 8 Millas', version: '1.0.1', timestamp: new Date() })
})

// ── SIRE / PLE — Exportación registros electrónicos ──────────────
router.get('/sire/resumen',  auth, sireCtrl.resumenSIRE)
router.get('/sire/ventas',   auth, sireCtrl.exportarRegistroVentas)
router.get('/sire/compras',  auth, sireCtrl.exportarRegistroCompras)

// ── PORTAL PÚBLICO — Verificar comprobante (sin autenticación) ────
router.get('/public/comprobante', async (req, res) => {
  try {
    const { ruc, tipo, serie, numero } = req.query
    if (!ruc || !tipo || !serie || !numero) {
      return res.status(400).json({
        ok: false,
        error: 'Parametros requeridos: ruc, tipo, serie, numero',
      })
    }
    const { rows: [f] } = await query(
      `SELECT
        tipo_doc, serie, numero, numero_fmt,
        fecha_emision, emisor_ruc, emisor_razon,
        cliente_tipo_doc, cliente_doc, cliente_nombre,
        moneda, subtotal, igv, total,
        estado, sunat_estado, sunat_codigo, sunat_mensaje,
        hash, cdr_url, pdf_url
       FROM facturas
       WHERE emisor_ruc = $1
         AND tipo_doc   = $2
         AND serie      = $3
         AND numero     = $4
         AND deleted    = false`,
      [ruc, tipo, serie, parseInt(numero)]
    )
    if (!f) {
      return res.status(404).json({ ok: false, existe: false, mensaje: 'Comprobante no encontrado' })
    }
    const esValido = ['Emitida', 'Aceptada', 'Cobrada', 'Pagada'].includes(f.estado)
      && f.sunat_estado === 'Aceptado'
    res.json({
      ok: true, existe: true, valido: esValido,
      comprobante: {
        numero_fmt:     f.numero_fmt,
        tipo_doc:       f.tipo_doc,
        fecha_emision:  f.fecha_emision,
        emisor_ruc:     f.emisor_ruc,
        emisor_razon:   f.emisor_razon,
        cliente_nombre: f.cliente_nombre,
        total:          f.total,
        moneda:         f.moneda,
        estado_sunat:   f.sunat_estado,
        codigo_sunat:   f.sunat_codigo,
        mensaje_sunat:  f.sunat_mensaje,
        hash:           f.hash,
        cdr_url:        esValido ? f.cdr_url : null,
        pdf_url:        esValido ? f.pdf_url : null,
      },
    })
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error interno del servidor' })
  }
})

export default router
