// ══════════════════════════════════════════════════════════════════
// RETENCIONES (tipo 20) Y PERCEPCIONES (tipo 40)
// Obligatorio para agentes de retención/percepción designados por SUNAT
// ══════════════════════════════════════════════════════════════════
import { query, transaction } from '../db/pool.js'
import { getTokenSunat, firmarXml, xmlToBase64 } from '../services/sunat.js'
import axios from 'axios'

const CPE_BASE = process.env.SUNAT_BETA === 'true'
  ? 'https://gw-efact.sunat.gob.pe/v1/contribuyente/gem'
  : 'https://api-cpe.sunat.gob.pe/v1/contribuyente/gem'

const pad = (n) => String(n).padStart(8, '0')

// ── XML Builder — Retención (tipo 20) ─────────────────────────────
const buildXmlRetencion = (ret, documentos) => {
  const ruc    = process.env.EMISOR_RUC
  const razon  = process.env.EMISOR_RAZON_SOCIAL
  const numero = pad(ret.numero)

  // Régimen de retención: 01=3%, 02=6%
  const regimen    = ret.regimen || '01'
  const porcentaje = regimen === '01' ? '3' : '6'

  const docs = documentos.map((d, i) => `
  <sac:SUNATRetentionDocumentReference>
    <cbc:ID>${d.serie}-${pad(d.numero)}</cbc:ID>
    <cbc:DocumentTypeCode>${d.tipo_doc || '01'}</cbc:DocumentTypeCode>
    <cbc:IssueDate>${d.fecha_emision}</cbc:IssueDate>
    <sac:TotalInvoiceAmount currencyID="${d.moneda || 'PEN'}">${Number(d.total).toFixed(2)}</sac:TotalInvoiceAmount>
    <sac:Payment>
      <cbc:ID>Pago${i + 1}</cbc:ID>
      <cbc:PaidAmount currencyID="${d.moneda || 'PEN'}">${Number(d.importe_pagado || d.total).toFixed(2)}</cbc:PaidAmount>
      <cbc:InstructionID>${d.nro_operacion || ''}</cbc:InstructionID>
      <cbc:PaidDate>${d.fecha_pago || ret.fecha_emision}</cbc:PaidDate>
    </sac:Payment>
    <sac:SUNATRetentionInformation>
      <sac:RetentionPercent>${porcentaje}</sac:RetentionPercent>
      <sac:RetentionAmount currencyID="PEN">${Number(d.monto_retencion).toFixed(2)}</sac:RetentionAmount>
      <sac:RetentionDate>${ret.fecha_emision}</sac:RetentionDate>
      <sac:NetAmountPaid currencyID="${d.moneda || 'PEN'}">${Number(d.neto_pagado || d.total - d.monto_retencion).toFixed(2)}</sac:NetAmountPaid>
      <sac:NetPaymentDate>${ret.fecha_emision}</sac:NetPaymentDate>
    </sac:SUNATRetentionInformation>
  </sac:SUNATRetentionDocumentReference>`).join('')

  const totalRetenido = documentos.reduce((a, d) => a + Number(d.monto_retencion || 0), 0)

  return `<?xml version="1.0" encoding="UTF-8"?>
<Retention
  xmlns="urn:sunat:names:specification:ubl:peru:schema:xsd:Retention-1"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:sac="urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.0</cbc:UBLVersionID>
  <cbc:CustomizationID>1.0</cbc:CustomizationID>
  <cbc:ID>R${ret.serie || '001'}-${numero}</cbc:ID>
  <cbc:IssueDate>${ret.fecha_emision}</cbc:IssueDate>
  <cbc:Description><![CDATA[Régimen de retención ${regimen === '01' ? '3%' : '6%'}]]></cbc:Description>
  <cac:AgentParty>
    <cac:PartyIdentification>
      <cbc:ID schemeID="6">${ruc}</cbc:ID>
    </cac:PartyIdentification>
    <cac:PartyLegalEntity>
      <cbc:RegistrationName><![CDATA[${razon}]]></cbc:RegistrationName>
    </cac:PartyLegalEntity>
  </cac:AgentParty>
  <cac:ReceiverParty>
    <cac:PartyIdentification>
      <cbc:ID schemeID="6">${ret.proveedor_ruc}</cbc:ID>
    </cac:PartyIdentification>
    <cac:PartyLegalEntity>
      <cbc:RegistrationName><![CDATA[${ret.proveedor_nombre}]]></cbc:RegistrationName>
    </cac:PartyLegalEntity>
  </cac:ReceiverParty>
  <sac:SUNATRetentionSystemCode>${regimen}</sac:SUNATRetentionSystemCode>
  <sac:SUNATRetentionPercent>${porcentaje}</sac:SUNATRetentionPercent>
  <sac:TotalInvoiceAmount currencyID="PEN">${Number(ret.total_comprobantes).toFixed(2)}</sac:TotalInvoiceAmount>
  <sac:SUNATTotalPaid currencyID="PEN">${Number(totalRetenido).toFixed(2)}</sac:SUNATTotalPaid>
${docs}
</Retention>`
}

// ── XML Builder — Percepción (tipo 40) ────────────────────────────
const buildXmlPercepcion = (per, documentos) => {
  const ruc   = process.env.EMISOR_RUC
  const razon = process.env.EMISOR_RAZON_SOCIAL
  const numero = pad(per.numero)

  // Régimen de percepción: 01=Combustible 1%, 02=Bienes 2%, 03=Importación 3.5%
  const regimen    = per.regimen || '02'
  const porcentaje = { '01': '1', '02': '2', '03': '3.5' }[regimen] || '2'

  const docs = documentos.map((d, i) => `
  <sac:SUNATPerceptionDocumentReference>
    <cbc:ID>${d.serie}-${pad(d.numero)}</cbc:ID>
    <cbc:DocumentTypeCode>${d.tipo_doc || '01'}</cbc:DocumentTypeCode>
    <cbc:IssueDate>${d.fecha_emision}</cbc:IssueDate>
    <sac:TotalInvoiceAmount currencyID="${d.moneda || 'PEN'}">${Number(d.total).toFixed(2)}</sac:TotalInvoiceAmount>
    <sac:Payment>
      <cbc:ID>Cobro${i + 1}</cbc:ID>
      <cbc:PaidAmount currencyID="${d.moneda || 'PEN'}">${Number(d.importe_cobrado || d.total).toFixed(2)}</cbc:PaidAmount>
      <cbc:InstructionID>${d.nro_operacion || ''}</cbc:InstructionID>
      <cbc:PaidDate>${d.fecha_cobro || per.fecha_emision}</cbc:PaidDate>
    </sac:Payment>
    <sac:SUNATPerceptionInformation>
      <sac:SUNATPerceptionPercent>${porcentaje}</sac:SUNATPerceptionPercent>
      <sac:SUNATPerceptionAmount currencyID="PEN">${Number(d.monto_percepcion).toFixed(2)}</sac:SUNATPerceptionAmount>
      <sac:SUNATPerceptionDate>${per.fecha_emision}</sac:SUNATPerceptionDate>
      <sac:SUNATNetTotalCashed currencyID="${d.moneda || 'PEN'}">${Number(d.neto_cobrado || d.total + Number(d.monto_percepcion)).toFixed(2)}</sac:SUNATNetTotalCashed>
    </sac:SUNATPerceptionInformation>
  </sac:SUNATPerceptionDocumentReference>`).join('')

  const totalPercibido = documentos.reduce((a, d) => a + Number(d.monto_percepcion || 0), 0)

  return `<?xml version="1.0" encoding="UTF-8"?>
<Perception
  xmlns="urn:sunat:names:specification:ubl:peru:schema:xsd:Perception-1"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:sac="urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.0</cbc:UBLVersionID>
  <cbc:CustomizationID>1.0</cbc:CustomizationID>
  <cbc:ID>P${per.serie || '001'}-${numero}</cbc:ID>
  <cbc:IssueDate>${per.fecha_emision}</cbc:IssueDate>
  <cbc:Description><![CDATA[Régimen de percepción ${porcentaje}%]]></cbc:Description>
  <cac:AgentParty>
    <cac:PartyIdentification>
      <cbc:ID schemeID="6">${ruc}</cbc:ID>
    </cac:PartyIdentification>
    <cac:PartyLegalEntity>
      <cbc:RegistrationName><![CDATA[${razon}]]></cbc:RegistrationName>
    </cac:PartyLegalEntity>
  </cac:AgentParty>
  <cac:ReceiverParty>
    <cac:PartyIdentification>
      <cbc:ID schemeID="6">${per.cliente_ruc}</cbc:ID>
    </cac:PartyIdentification>
    <cac:PartyLegalEntity>
      <cbc:RegistrationName><![CDATA[${per.cliente_nombre}]]></cbc:RegistrationName>
    </cac:PartyLegalEntity>
  </cac:ReceiverParty>
  <sac:SUNATPerceptionSystemCode>${regimen}</sac:SUNATPerceptionSystemCode>
  <sac:SUNATPerceptionPercent>${porcentaje}</sac:SUNATPerceptionPercent>
  <sac:TotalInvoiceAmount currencyID="PEN">${Number(per.total_comprobantes).toFixed(2)}</sac:TotalInvoiceAmount>
  <sac:SUNATTotalCashed currencyID="PEN">${Number(totalPercibido).toFixed(2)}</sac:SUNATTotalCashed>
${docs}
</Perception>`
}

// ── Enviar a SUNAT (común para retenciones y percepciones) ────────
const enviarDocEspecial = async (id, tipoTabla, xmlSinFirmar, nombreArchivo) => {
  const xmlFirmado = firmarXml(xmlSinFirmar, 'ESPECIAL')
  const xmlBase64  = xmlToBase64(xmlFirmado)
  const token      = await getTokenSunat()
  const ruc        = process.env.EMISOR_RUC

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

  await query(
    `UPDATE ${tipoTabla} SET
      estado = $2, sunat_estado = $3,
      sunat_codigo = $4, sunat_mensaje = $5,
      hash = $6, updated_at = NOW()
     WHERE id = $1`,
    [
      id,
      aceptado ? 'Emitido' : 'Rechazado',
      aceptado ? 'Aceptado' : 'Rechazado',
      data.numRspsta,
      data.desRspsta || '',
      data.arcCdr || '',
    ]
  )

  return { aceptado, data, mensaje: data.desRspsta || '' }
}

// ══════════════════════════════════════════════════════════════════
// RETENCIONES
// ══════════════════════════════════════════════════════════════════

export const listarRetenciones = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, serie, numero, fecha_emision, proveedor_ruc, proveedor_nombre,
              regimen, total_comprobantes, total_retenido, estado, sunat_estado, created_at
       FROM retenciones
       WHERE deleted = false
       ORDER BY fecha_emision DESC, numero DESC
       LIMIT 100`
    )
    res.json({ ok: true, data: rows })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}

export const crearRetencion = async (req, res) => {
  try {
    const {
      proveedor_ruc, proveedor_nombre,
      regimen = '01',
      fecha_emision,
      documentos = [], // [{ tipo_doc, serie, numero, total, monto_retencion, ... }]
    } = req.body

    if (!proveedor_ruc) return res.status(400).json({ ok: false, error: 'proveedor_ruc requerido' })
    if (!documentos.length) return res.status(400).json({ ok: false, error: 'Se requiere al menos un documento' })

    const result = await transaction(async (client) => {
      // Correlativo serie retención (R001)
      const { rows: [sr] } = await client.query(
        `UPDATE series SET correlativo = correlativo + 1
         WHERE tipo_doc = '20' AND serie = 'R001' AND activo = true
         RETURNING correlativo`
      )
      if (!sr) throw new Error('Serie R001 no configurada. Agrégala en la tabla series.')

      const totalComprobantes = documentos.reduce((a, d) => a + Number(d.total || 0), 0)
      const totalRetenido     = documentos.reduce((a, d) => a + Number(d.monto_retencion || 0), 0)

      const { rows: [ret] } = await client.query(
        `INSERT INTO retenciones
          (serie, numero, fecha_emision, emisor_ruc, emisor_razon,
           proveedor_ruc, proveedor_nombre, regimen,
           total_comprobantes, total_retenido, documentos_json,
           estado, usuario_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Borrador',$12)
         RETURNING *`,
        [
          'R001', sr.correlativo, fecha_emision || new Date().toISOString().split('T')[0],
          process.env.EMISOR_RUC, process.env.EMISOR_RAZON_SOCIAL,
          proveedor_ruc, proveedor_nombre, regimen,
          totalComprobantes, totalRetenido,
          JSON.stringify(documentos),
          req.user?.id || null,
        ]
      )
      return ret
    })

    res.status(201).json({ ok: true, data: result })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}

export const emitirRetencion = async (req, res) => {
  try {
    const { rows: [ret] } = await query(
      'SELECT * FROM retenciones WHERE id = $1 AND deleted = false',
      [req.params.id]
    )
    if (!ret) return res.status(404).json({ ok: false, error: 'Retención no encontrada' })
    if (ret.estado !== 'Borrador') return res.status(400).json({ ok: false, error: 'Solo Borradores' })

    const documentos = typeof ret.documentos_json === 'string'
      ? JSON.parse(ret.documentos_json) : ret.documentos_json

    const xml = buildXmlRetencion(ret, documentos)
    const nombreArchivo = `${ret.emisor_ruc}-20-${ret.serie}-${String(ret.numero).padStart(8, '0')}`
    const { aceptado, mensaje } = await enviarDocEspecial(ret.id, 'retenciones', xml, nombreArchivo)

    if (!aceptado) return res.status(422).json({ ok: false, error: `SUNAT rechazó: ${mensaje}` })
    res.json({ ok: true, mensaje: 'Retención aceptada por SUNAT' })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}

// ══════════════════════════════════════════════════════════════════
// PERCEPCIONES
// ══════════════════════════════════════════════════════════════════

export const listarPercepciones = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, serie, numero, fecha_emision, cliente_ruc, cliente_nombre,
              regimen, total_comprobantes, total_percibido, estado, sunat_estado, created_at
       FROM percepciones
       WHERE deleted = false
       ORDER BY fecha_emision DESC, numero DESC
       LIMIT 100`
    )
    res.json({ ok: true, data: rows })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}

export const crearPercepcion = async (req, res) => {
  try {
    const {
      cliente_ruc, cliente_nombre,
      regimen = '02',
      fecha_emision,
      documentos = [],
    } = req.body

    if (!cliente_ruc) return res.status(400).json({ ok: false, error: 'cliente_ruc requerido' })
    if (!documentos.length) return res.status(400).json({ ok: false, error: 'Se requiere al menos un documento' })

    const result = await transaction(async (client) => {
      const { rows: [sp] } = await client.query(
        `UPDATE series SET correlativo = correlativo + 1
         WHERE tipo_doc = '40' AND serie = 'P001' AND activo = true
         RETURNING correlativo`
      )
      if (!sp) throw new Error('Serie P001 no configurada. Agrégala en la tabla series.')

      const totalComprobantes = documentos.reduce((a, d) => a + Number(d.total || 0), 0)
      const totalPercibido    = documentos.reduce((a, d) => a + Number(d.monto_percepcion || 0), 0)

      const { rows: [per] } = await client.query(
        `INSERT INTO percepciones
          (serie, numero, fecha_emision, emisor_ruc, emisor_razon,
           cliente_ruc, cliente_nombre, regimen,
           total_comprobantes, total_percibido, documentos_json,
           estado, usuario_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Borrador',$12)
         RETURNING *`,
        [
          'P001', sp.correlativo, fecha_emision || new Date().toISOString().split('T')[0],
          process.env.EMISOR_RUC, process.env.EMISOR_RAZON_SOCIAL,
          cliente_ruc, cliente_nombre, regimen,
          totalComprobantes, totalPercibido,
          JSON.stringify(documentos),
          req.user?.id || null,
        ]
      )
      return per
    })

    res.status(201).json({ ok: true, data: result })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}

export const emitirPercepcion = async (req, res) => {
  try {
    const { rows: [per] } = await query(
      'SELECT * FROM percepciones WHERE id = $1 AND deleted = false',
      [req.params.id]
    )
    if (!per) return res.status(404).json({ ok: false, error: 'Percepción no encontrada' })
    if (per.estado !== 'Borrador') return res.status(400).json({ ok: false, error: 'Solo Borradores' })

    const documentos = typeof per.documentos_json === 'string'
      ? JSON.parse(per.documentos_json) : per.documentos_json

    const xml = buildXmlPercepcion(per, documentos)
    const nombreArchivo = `${per.emisor_ruc}-40-${per.serie}-${String(per.numero).padStart(8, '0')}`
    const { aceptado, mensaje } = await enviarDocEspecial(per.id, 'percepciones', xml, nombreArchivo)

    if (!aceptado) return res.status(422).json({ ok: false, error: `SUNAT rechazó: ${mensaje}` })
    res.json({ ok: true, mensaje: 'Percepción aceptada por SUNAT' })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}
