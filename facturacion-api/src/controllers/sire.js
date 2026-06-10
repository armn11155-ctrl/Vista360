// ══════════════════════════════════════════════════════════════════
// SIRE / PLE — Exportación compatible con SUNAT
// SIRE: Sistema Integrado de Registros Electrónicos (desde 2022)
// PLE: Programa de Libros Electrónicos (anterior, aún vigente)
//
// Registro de Ventas: 14.1 (Facturas/Boletas emitidas)
// Registro de Compras: 8.1 (facturas de proveedores)
// ══════════════════════════════════════════════════════════════════
import { query } from '../db/pool.js'

// ── Helpers ───────────────────────────────────────────────────────
const pipe  = '|'
const crlf  = '\r\n'
const yyyymm = (fecha) => fecha ? String(fecha).slice(0, 7).replace('-', '') : ''
const yyyymmdd = (fecha) => fecha ? String(fecha).slice(0, 10).replace(/-/g, '') : ''
const num2 = (n) => Number(n || 0).toFixed(2)
const safe  = (s) => (s || '').replace(/\|/g, ' ').trim()

// Tipo de doc identificación: 1=DNI, 6=RUC, 4=CE, 7=Pasaporte
const tipoDocId = (t) => ({ 'RUC': '6', 'DNI': '1', 'CE': '4' })[t] || '0'

// Tipo de comprobante → código SUNAT catálogo 01
const tipoCpe = (t) => ({ '01': '01', '03': '03', '07': '07', '08': '08' })[t] || '01'

// ──────────────────────────────────────────────────────────────────
// 14.1 — REGISTRO DE VENTAS (Formato SIRE / PLE)
// Columnas obligatorias SUNAT (R.S. 286-2009/SUNAT y modificatorias)
// ──────────────────────────────────────────────────────────────────
export const exportarRegistroVentas = async (req, res) => {
  try {
    const { periodo, formato = 'txt' } = req.query
    // periodo: YYYYMM  p.e. 202506
    if (!periodo || !/^\d{6}$/.test(periodo)) {
      return res.status(400).json({ ok: false, error: 'periodo requerido en formato YYYYMM (ej: 202506)' })
    }

    const anio = periodo.slice(0, 4)
    const mes  = periodo.slice(4, 6)
    const mesISO = `${anio}-${mes}`

    const { rows: facturas } = await query(
      `SELECT
        f.id, f.tipo_doc, f.serie, f.numero, f.numero_fmt,
        f.fecha_emision, f.fecha_vencimiento,
        f.emisor_ruc,
        f.cliente_tipo_doc, f.cliente_doc, f.cliente_nombre,
        f.moneda, f.tipo_cambio,
        f.op_gravada, f.op_exonerada, f.op_inafecta,
        f.igv, f.subtotal, f.total,
        f.es_exonerado, f.estado
       FROM facturas f
       WHERE to_char(f.fecha_emision,'YYYY-MM') = $1
         AND f.deleted = false
         AND f.estado NOT IN ('Borrador','Anulada')
       ORDER BY f.fecha_emision, f.numero`,
      [mesISO]
    )

    // ── Generar líneas TXT (pipe-delimited) ───────────────────────
    // Estructura: campo1|campo2|...|campo49|
    // Referencia: Anexo 14.1 R.S. 286-2009 y R.S. 279-2012
    const lineas = facturas.map((f, idx) => {
      const campos = [
        /* 1 */ periodo,                                          // Período
        /* 2 */ yyyymmdd(f.fecha_emision),                       // Fecha de emisión
        /* 3 */ '',                                              // Fecha vto/pago (opcional)
        /* 4 */ tipoCpe(f.tipo_doc),                             // Tipo CPE (catálogo 01)
        /* 5 */ safe(f.serie),                                   // Serie
        /* 6 */ '',                                              // Año de emisión DUA/DSI (solo importación)
        /* 7 */ String(f.numero),                                // Número correlativo
        /* 8 */ '',                                              // N° final rango (tickets)
        /* 9 */ tipoDocId(f.cliente_tipo_doc),                   // Tipo doc identidad cliente
        /* 10 */ safe(f.cliente_doc),                            // N° doc identidad cliente
        /* 11 */ safe(f.cliente_nombre),                         // Apellidos/razón social cliente
        /* 12 */ num2(f.op_exonerada),                           // Valor facturado - exportación
        /* 13 */ num2(f.op_gravada),                             // Base imponible OP gravadas
        /* 14 */ num2(0),                                        // Descuento base imponible
        /* 15 */ num2(f.igv),                                    // IGV y/o IPM
        /* 16 */ num2(0),                                        // Descuento IGV y/o IPM
        /* 17 */ '',                                             // Tipo cambio ISC (N/A)
        /* 18 */ num2(0),                                        // ISC
        /* 19 */ num2(0),                                        // OP. Gravadas IVAP
        /* 20 */ num2(0),                                        // IVAP
        /* 21 */ num2(0),                                        // ICBPER
        /* 22 */ num2(0),                                        // Otros tributos/cargos
        /* 23 */ num2(f.total),                                  // Importe total
        /* 24 */ f.moneda || 'PEN',                              // Moneda (ISO 4217)
        /* 25 */ num2(f.tipo_cambio || 1),                       // Tipo de cambio
        /* 26 */ '',                                             // Fecha CPE referencia (NC/ND)
        /* 27 */ '',                                             // Tipo CPE referencia
        /* 28 */ '',                                             // Serie CPE referencia
        /* 29 */ '',                                             // Código DUA referencia
        /* 30 */ '',                                             // Número CPE referencia
        /* 31 */ '',                                             // Fecha emisión origen NC/ND
        /* 32 */ '',                                             // Tipo NC/ND (A=anulación)
        /* 33 */ num2(f.op_inafecta),                            // OP. No gravadas (exoneradas+inafectas)
        /* 34 */ num2(0),                                        // ISC - monto
        /* 35 */ num2(0),                                        // ICBPER - monto
        /* 36 */ '',                                             // Código de establecimiento
        /* 37 */ '1',                                            // Estado (1=activo, 8=baja, 9=anulado)
        /* 38 */ '',                                             // Campos adicionales
      ]
      return campos.join(pipe) + pipe
    })

    // ── Totales para SIRE ──────────────────────────────────────────
    const totOpGravada   = facturas.reduce((a, f) => a + Number(f.op_gravada  || 0), 0)
    const totIgv         = facturas.reduce((a, f) => a + Number(f.igv         || 0), 0)
    const totOpExonerada = facturas.reduce((a, f) => a + Number(f.op_exonerada|| 0), 0)
    const totOpInafecta  = facturas.reduce((a, f) => a + Number(f.op_inafecta || 0), 0)
    const totTotal       = facturas.reduce((a, f) => a + Number(f.total       || 0), 0)

    if (formato === 'json') {
      return res.json({
        ok: true,
        periodo,
        totales: {
          comprobantes:  facturas.length,
          op_gravada:    totOpGravada,
          igv:           totIgv,
          op_exonerada:  totOpExonerada,
          op_inafecta:   totOpInafecta,
          total:         totTotal,
        },
        data: facturas,
      })
    }

    // Nombre de archivo estándar SUNAT: LE{RUC}{PERIODO}00140100001111.txt
    const ruc = process.env.EMISOR_RUC || '00000000000'
    const nombreArchivo = `LE${ruc}${periodo}00140100001111.txt`
    const contenido = lineas.join(crlf) + (lineas.length ? crlf : '')

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`)
    res.send(contenido)

  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: err.message })
  }
}

// ──────────────────────────────────────────────────────────────────
// 8.1 — REGISTRO DE COMPRAS
// Requiere tabla `compras` o usar tabla gastos con campos extendidos
// ──────────────────────────────────────────────────────────────────
export const exportarRegistroCompras = async (req, res) => {
  try {
    const { periodo, formato = 'txt' } = req.query
    if (!periodo || !/^\d{6}$/.test(periodo)) {
      return res.status(400).json({ ok: false, error: 'periodo requerido en formato YYYYMM' })
    }

    const anio = periodo.slice(0, 4)
    const mes  = periodo.slice(4, 6)
    const mesISO = `${anio}-${mes}`

    // Leer de tabla compras (si existe) o de gastos con campo tipo_doc_proveedor
    let rows = []
    try {
      const result = await query(
        `SELECT * FROM compras
         WHERE to_char(fecha_emision,'YYYY-MM') = $1
           AND deleted = false
         ORDER BY fecha_emision, numero`,
        [mesISO]
      )
      rows = result.rows
    } catch (_) {
      // tabla compras no existe todavía — retornar vacío con aviso
      return res.json({
        ok: true,
        aviso: 'La tabla "compras" aún no existe. Ejecuta la migración de schema para habilitarla.',
        periodo,
        data: [],
      })
    }

    const lineas = rows.map((c) => {
      const campos = [
        /* 1 */ periodo,
        /* 2 */ yyyymmdd(c.fecha_emision),
        /* 3 */ yyyymmdd(c.fecha_vencimiento),
        /* 4 */ tipoCpe(c.tipo_doc || '01'),
        /* 5 */ safe(c.serie),
        /* 6 */ '',
        /* 7 */ String(c.numero),
        /* 8 */ tipoDocId(c.proveedor_tipo_doc || 'RUC'),
        /* 9 */ safe(c.proveedor_doc),
        /* 10 */ safe(c.proveedor_nombre),
        /* 11 */ num2(c.op_no_gravada || 0),
        /* 12 */ num2(c.op_gravada    || 0),
        /* 13 */ num2(0),
        /* 14 */ num2(c.igv           || 0),
        /* 15 */ num2(0),
        /* 16 */ num2(0),
        /* 17 */ num2(0),
        /* 18 */ num2(0),
        /* 19 */ num2(c.total         || 0),
        /* 20 */ c.moneda || 'PEN',
        /* 21 */ num2(c.tipo_cambio   || 1),
        /* 22 */ '',
        /* 23 */ '',
        /* 24 */ '',
        /* 25 */ '',
        /* 26 */ '',
        /* 27 */ num2(c.op_inafecta   || 0),
        /* 28 */ '',
        /* 29 */ '1',
        /* 30 */ '',
      ]
      return campos.join(pipe) + pipe
    })

    if (formato === 'json') {
      return res.json({ ok: true, periodo, data: rows })
    }

    const ruc = process.env.EMISOR_RUC || '00000000000'
    const nombreArchivo = `LE${ruc}${periodo}00080100001111.txt`
    const contenido = lineas.join(crlf) + (lineas.length ? crlf : '')

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`)
    res.send(contenido)

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}

// ── Resumen SIRE (metadata del período) ───────────────────────────
export const resumenSIRE = async (req, res) => {
  try {
    const { periodo } = req.query
    if (!periodo || !/^\d{6}$/.test(periodo)) {
      return res.status(400).json({ ok: false, error: 'periodo requerido en formato YYYYMM' })
    }

    const mesISO = `${periodo.slice(0, 4)}-${periodo.slice(4, 6)}`
    const ruc    = process.env.EMISOR_RUC

    const { rows: [ventas] } = await query(
      `SELECT
        COUNT(*) AS total_comprobantes,
        COUNT(*) FILTER (WHERE tipo_doc = '01') AS facturas,
        COUNT(*) FILTER (WHERE tipo_doc = '03') AS boletas,
        COUNT(*) FILTER (WHERE tipo_doc = '07') AS notas_credito,
        COUNT(*) FILTER (WHERE tipo_doc = '08') AS notas_debito,
        COALESCE(SUM(op_gravada),  0) AS total_gravado,
        COALESCE(SUM(igv),         0) AS total_igv,
        COALESCE(SUM(op_exonerada),0) AS total_exonerado,
        COALESCE(SUM(op_inafecta), 0) AS total_inafecto,
        COALESCE(SUM(total),       0) AS total_importe
       FROM facturas
       WHERE to_char(fecha_emision,'YYYY-MM') = $1
         AND deleted = false
         AND estado NOT IN ('Borrador','Anulada')`,
      [mesISO]
    )

    res.json({
      ok:      true,
      periodo,
      ruc,
      ventas,
      archivos: [
        {
          nombre:      `LE${ruc}${periodo}00140100001111.txt`,
          descripcion: 'Registro de Ventas (14.1)',
          url:         `/api/sire/ventas?periodo=${periodo}`,
        },
        {
          nombre:      `LE${ruc}${periodo}00080100001111.txt`,
          descripcion: 'Registro de Compras (8.1)',
          url:         `/api/sire/compras?periodo=${periodo}`,
        },
      ],
    })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}
