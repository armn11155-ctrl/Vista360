// ══════════════════════════════════════════════════════════════════
// CONTROLLER: guias.js — Guías de Remisión Electrónica (GRE)
// Tipo 09 (Remitente) y 31 (Transportista)
// ══════════════════════════════════════════════════════════════════
import { query, transaction } from '../db/pool.js'
import { getTokenSunat, firmarXml, xmlToBase64 } from '../services/sunat.js'
import { buildXmlGRE } from '../services/gre.xml.js'
import axios from 'axios'

const CPE_BASE = process.env.SUNAT_BETA === 'true'
  ? 'https://gw-efact.sunat.gob.pe/v1/contribuyente/gem'
  : 'https://api-cpe.sunat.gob.pe/v1/contribuyente/gem'

// ── GET /api/guias ─────────────────────────────────────────────────
export const listar = async (req, res) => {
  try {
    const { estado, mes, page = 1, limit = 50, q } = req.query
    const conditions = ['deleted = false']
    const params = []
    let i = 1

    if (estado) { conditions.push(`estado = $${i++}`); params.push(estado) }
    if (mes)    { conditions.push(`to_char(fecha_emision,'YYYY-MM') = $${i++}`); params.push(mes) }
    if (q) {
      conditions.push(`(numero_fmt ILIKE $${i} OR destinatario_nombre ILIKE $${i})`)
      params.push(`%${q}%`)
      i++
    }

    const where  = conditions.join(' AND ')
    const offset = (parseInt(page) - 1) * parseInt(limit)

    const { rows: guias } = await query(
      `SELECT id, tipo_doc, serie, numero, numero_fmt, fecha_emision,
              destinatario_nombre, destinatario_doc,
              motivo_traslado, peso_total, bultos,
              estado, sunat_estado, sunat_mensaje, xml_url,
              factura_referencia, created_at
       FROM guias_remision
       WHERE ${where}
       ORDER BY fecha_emision DESC, numero DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...params, parseInt(limit), offset]
    )

    const { rows: [{ total }] } = await query(
      `SELECT COUNT(*) AS total FROM guias_remision WHERE ${where}`,
      params
    )

    res.json({
      ok: true,
      data: guias,
      pagination: {
        total: parseInt(total),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(parseInt(total) / parseInt(limit)),
      },
    })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}

// ── GET /api/guias/:id ──────────────────────────────────────────────
export const obtener = async (req, res) => {
  try {
    const { rows: [guia] } = await query(
      'SELECT * FROM guias_remision WHERE id = $1 AND deleted = false',
      [req.params.id]
    )
    if (!guia) return res.status(404).json({ ok: false, error: 'GRE no encontrada' })

    const { rows: items } = await query(
      'SELECT * FROM guia_items WHERE guia_id = $1 ORDER BY orden',
      [req.params.id]
    )
    res.json({ ok: true, data: { ...guia, items } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}

// ── POST /api/guias ────────────────────────────────────────────────
export const crear = async (req, res) => {
  try {
    const {
      tipo_doc = '09',           // '09' remitente | '31' transportista
      serie,                     // T001 | V001
      fecha_emision,
      motivo_traslado = '01',
      modalidad_traslado = '02',
      peso_total, unidad_peso = 'KGM', bultos = 1,
      // Destinatario
      destinatario_tipo_doc = 'RUC',
      destinatario_doc, destinatario_nombre,
      // Direcciones
      direccion_partida, direccion_llegada,
      // Transportista (si modalidad=01)
      transportista_ruc, transportista_razon,
      placa, conductor_doc,
      // Referencia a factura
      factura_referencia,
      items = [],
    } = req.body

    if (!destinatario_doc) return res.status(400).json({ ok: false, error: 'destinatario_doc requerido' })
    if (!items.length)     return res.status(400).json({ ok: false, error: 'Se requiere al menos un ítem' })

    const result = await transaction(async (client) => {
      // Correlativo de serie
      const { rows: [serie_row] } = await client.query(
        `UPDATE series SET correlativo = correlativo + 1
         WHERE tipo_doc = $1 AND serie = $2 AND activo = true
         RETURNING correlativo`,
        [tipo_doc, serie]
      )
      if (!serie_row) throw new Error(`Serie ${serie} no encontrada o inactiva`)
      const numero = serie_row.correlativo

      const { rows: [guia] } = await client.query(
        `INSERT INTO guias_remision (
          tipo_doc, serie, numero,
          fecha_emision, emisor_ruc, emisor_razon,
          destinatario_tipo_doc, destinatario_doc, destinatario_nombre,
          motivo_traslado, modalidad_traslado,
          peso_total, unidad_peso, bultos,
          direccion_partida, direccion_llegada,
          transportista_ruc, transportista_razon, placa, conductor_doc,
          factura_referencia, estado, usuario_id
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'Borrador',$22
        ) RETURNING *`,
        [
          tipo_doc, serie, numero,
          fecha_emision || new Date().toISOString().split('T')[0],
          process.env.EMISOR_RUC, process.env.EMISOR_RAZON_SOCIAL,
          destinatario_tipo_doc, destinatario_doc, destinatario_nombre,
          motivo_traslado, modalidad_traslado,
          peso_total || 0, unidad_peso, bultos,
          direccion_partida || null, direccion_llegada || null,
          transportista_ruc || null, transportista_razon || null,
          placa || null, conductor_doc || null,
          factura_referencia || null,
          req.user?.id || null,
        ]
      )

      for (const [idx, item] of items.entries()) {
        await client.query(
          `INSERT INTO guia_items (guia_id, orden, descripcion, codigo, unidad_medida, cantidad)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [guia.id, idx + 1, item.descripcion, item.codigo || null,
           item.unidad_medida || 'NIU', item.cantidad || 1]
        )
      }

      return guia
    })

    res.status(201).json({ ok: true, data: result, mensaje: 'GRE creada como Borrador' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: err.message })
  }
}

// ── POST /api/guias/:id/emitir ──────────────────────────────────────
export const emitir = async (req, res) => {
  try {
    const { rows: [guia] } = await query(
      'SELECT * FROM guias_remision WHERE id = $1 AND deleted = false',
      [req.params.id]
    )
    if (!guia)                    return res.status(404).json({ ok: false, error: 'GRE no encontrada' })
    if (guia.estado !== 'Borrador') return res.status(400).json({ ok: false, error: 'Solo se pueden emitir GREs en estado Borrador' })

    const { rows: items } = await query(
      'SELECT * FROM guia_items WHERE guia_id = $1 ORDER BY orden',
      [req.params.id]
    )

    // 1. Generar XML
    const xmlSinFirmar = buildXmlGRE(guia, items)

    // 2. Firmar con raíz DespatchAdvice
    const xmlFirmado = firmarXml(xmlSinFirmar, 'GRE')

    // 3. Base64
    const nombreArchivo = `${guia.emisor_ruc}-${guia.tipo_doc}-${guia.serie}-${String(guia.numero).padStart(8, '0')}`
    const xmlBase64     = xmlToBase64(xmlFirmado)

    // 4. Token
    const token = await getTokenSunat()
    const ruc   = process.env.EMISOR_RUC

    // 5. Enviar a SUNAT
    const { data } = await axios.post(
      `${CPE_BASE}/comprobantes`,
      {
        archivo: {
          nomArchivo: `${nombreArchivo}.xml`,
          arcGreZip:  xmlBase64,
          hashZip:    '',
        },
      },
      {
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ruc':          ruc,
        },
        timeout: 30000,
      }
    )

    const aceptado = data.numRspsta === '0'
    const mensaje  = data.desRspsta || 'Procesado'

    await query(
      `INSERT INTO eventos_sunat (factura_id, accion, response_body, status_code, exitoso, mensaje)
       VALUES ($1, 'GRE_ENVIO', $2, 200, $3, $4)`,
      [req.params.id, JSON.stringify(data), aceptado, mensaje]
    )

    if (!aceptado) {
      await query(
        `UPDATE guias_remision SET estado = 'Rechazada', sunat_mensaje = $2 WHERE id = $1`,
        [req.params.id, mensaje]
      )
      return res.status(422).json({ ok: false, error: `SUNAT rechazó la GRE: ${mensaje}` })
    }

    await query(
      `UPDATE guias_remision SET
        estado = 'Emitida', sunat_estado = 'Aceptado',
        sunat_codigo = $2, sunat_mensaje = $3,
        hash = $4, updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, data.numRspsta, mensaje, data.arcCdr || '']
    )

    res.json({ ok: true, mensaje: 'GRE emitida y aceptada por SUNAT', data: { estado: 'Emitida' } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: err.response?.data?.desRspsta || err.message })
  }
}

// ── DELETE /api/guias/:id ───────────────────────────────────────────
export const eliminar = async (req, res) => {
  try {
    const { rows: [guia] } = await query(
      'SELECT estado FROM guias_remision WHERE id = $1 AND deleted = false',
      [req.params.id]
    )
    if (!guia) return res.status(404).json({ ok: false, error: 'GRE no encontrada' })
    if (guia.estado === 'Emitida') return res.status(400).json({ ok: false, error: 'No se puede eliminar una GRE emitida' })

    await query('UPDATE guias_remision SET deleted = true WHERE id = $1', [req.params.id])
    res.json({ ok: true, mensaje: 'GRE eliminada' })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}
