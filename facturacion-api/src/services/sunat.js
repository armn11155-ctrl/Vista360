// ══════════════════════════════════════════════════════════════════
// SUNAT API DIRECTA — 100% GRATUITO
// ──────────────────────────────────────────────────────────────────
// No necesitas OSE ni PSE de pago.
// SUNAT ofrece su propia API REST gratuita para emisión electrónica.
//
// LO QUE NECESITAS (todo gratis):
// 1. Clave SOL de 8 Millas (ya la tienes en sunat.gob.pe)
// 2. Client ID + Secret → los generas en:
//    https://api-seguridad.sunat.gob.pe → "Mis aplicaciones"
// 3. Certificado digital p12 → SUNAT lo da gratis en:
//    sunat.gob.pe → SOL → "Comprobantes de Pago" → "Certificado Digital"
// ══════════════════════════════════════════════════════════════════

import axios from 'axios'
import { SignedXml } from 'xml-crypto'
import forge from 'node-forge'
import { readFileSync } from 'fs'
import { query } from '../db/pool.js'
import { buildXmlFactura, buildXmlBoleta, buildXmlNotaCredito } from './sunat.xml.js'

// ── Endpoints SUNAT ───────────────────────────────────────────────
const SUNAT = {
  TOKEN_URL:      'https://api-seguridad.sunat.gob.pe/v1/clientessol',
  CPE_URL:        'https://api-cpe.sunat.gob.pe/v1/contribuyente/gem',
  TOKEN_URL_BETA: 'https://gw-efact.sunat.gob.pe/v1/clientessol',
  CPE_URL_BETA:   'https://gw-efact.sunat.gob.pe/v1/contribuyente/gem',
}

const IS_BETA   = process.env.SUNAT_BETA === 'true'
const TOKEN_BASE = IS_BETA ? SUNAT.TOKEN_URL_BETA : SUNAT.TOKEN_URL
const CPE_BASE   = IS_BETA ? SUNAT.CPE_URL_BETA   : SUNAT.CPE_URL

// ── Cache del token OAuth2 (expira en 1h) ─────────────────────────
let tokenCache = { token: null, expira: 0 }

// ── Cache del certificado: almacenamos PEM extraído del .p12 ──────
// El .p12 está cifrado con contraseña — hay que descifrarlo una vez
// con node-forge y guardar la clave privada y el certificado en PEM.
let _cachedKey  = null   // PEM de la clave privada
let _cachedCert = null   // PEM del certificado público

/**
 * Carga el certificado digital y extrae clave privada + cert en PEM.
 * Soporta archivos .p12 / .pfx (cifrados con contraseña) y .pem.
 * El resultado se cachea a nivel de módulo (se carga solo una vez).
 */
function getCertPems() {
  if (_cachedKey && _cachedCert) return { key: _cachedKey, cert: _cachedCert }

  const certPath = process.env.SUNAT_CERT_PATH
  const certPass = process.env.SUNAT_CERT_PASS || ''

  if (!certPath) throw new Error('SUNAT_CERT_PATH no configurado')

  const certBuffer = readFileSync(certPath)
  const ext = certPath.toLowerCase()

  if (ext.endsWith('.p12') || ext.endsWith('.pfx')) {
    // ── Extraer del .p12 usando node-forge ────────────────────────
    const p12Der   = forge.util.createBuffer(certBuffer.toString('binary'))
    const p12Asn1  = forge.asn1.fromDer(p12Der)
    const p12      = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, certPass)

    // Clave privada
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
    const keyBag  = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
    if (!keyBag?.key) throw new Error('No se encontró la clave privada en el .p12')
    _cachedKey = forge.pki.privateKeyToPem(keyBag.key)

    // Certificado público
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
    const certBag  = certBags[forge.pki.oids.certBag]?.[0]
    if (!certBag?.cert) throw new Error('No se encontró el certificado en el .p12')
    _cachedCert = forge.pki.certificateToPem(certBag.cert)

  } else {
    // ── Asumir formato PEM directamente ──────────────────────────
    const pem   = certBuffer.toString('utf8')
    _cachedKey  = pem
    _cachedCert = pem
  }

  return { key: _cachedKey, cert: _cachedCert }
}

// ── PASO 1: Obtener token OAuth2 de SUNAT ────────────────────────
export const getTokenSunat = async () => {
  if (tokenCache.token && Date.now() < tokenCache.expira) {
    return tokenCache.token
  }

  const clientId     = process.env.SUNAT_CLIENT_ID
  const clientSecret = process.env.SUNAT_CLIENT_SECRET
  const ruc          = process.env.EMISOR_RUC
  const userSol      = process.env.SUNAT_SOL_USER
  const passSol      = process.env.SUNAT_SOL_PASSWORD

  const url = `${TOKEN_BASE}/${clientId}/openid-connect/token`

  const params = new URLSearchParams({
    grant_type:    'password',
    scope:         'https://api.sunat.gob.pe/v1/contribuyente/contribuyentes',
    client_id:     clientId,
    client_secret: clientSecret,
    username:      `${ruc}${userSol}`,
    password:      passSol,
  })

  const { data } = await axios.post(url, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000,
  })

  tokenCache = {
    token:  data.access_token,
    expira: Date.now() + (data.expires_in - 60) * 1000,
  }

  return tokenCache.token
}

// ── PASO 2: Firmar XML con certificado digital (.p12 o .pem) ─────
export const firmarXml = (xmlString, tipoDoc = '01') => {
  const { key, cert } = getCertPems()

  // El elemento raíz del XML varía según el tipo de comprobante (UBL 2.1):
  //   01 Factura        → Invoice
  //   03 Boleta         → Invoice
  //   07 Nota Crédito   → CreditNote
  //   08 Nota Débito    → DebitNote
  const rootMap = { '07': 'CreditNote', '08': 'DebitNote' }
  const rootElement = rootMap[tipoDoc] || 'Invoice'

  const sig = new SignedXml({
    privateKey:  key,
    publicCert:  cert,
  })

  sig.addReference({
    xpath: `//*[local-name(.)='${rootElement}']`,
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#',
    ],
  })

  sig.signingKey              = key
  sig.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#'
  sig.signatureAlgorithm      = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'

  sig.computeSignature(xmlString)
  return sig.getSignedXml()
}

// ── PASO 3: Convertir XML firmado a Base64 ────────────────────────
// La API REST de SUNAT acepta el XML directamente en Base64.
export const xmlToBase64 = (xmlFirmado) => {
  return Buffer.from(xmlFirmado, 'utf8').toString('base64')
}

// ── PASO 4: Enviar comprobante a SUNAT ────────────────────────────
export const enviarASunat = async (facturaId, factura, items) => {
  let xmlSinFirmar = ''
  let xmlFirmado   = ''

  try {
    // 1. Generar XML según tipo (UBL 2.1)
    if (factura.tipo_doc === '01') {
      xmlSinFirmar = buildXmlFactura(factura, items)
    } else if (factura.tipo_doc === '03') {
      xmlSinFirmar = buildXmlBoleta(factura, items)
    } else if (factura.tipo_doc === '07') {
      xmlSinFirmar = buildXmlNotaCredito(factura, items)
    } else {
      throw new Error(`Tipo de documento no soportado: ${factura.tipo_doc}`)
    }

    // 2. Firmar XML con el tipo_doc correcto (determina el XPath)
    xmlFirmado = firmarXml(xmlSinFirmar, factura.tipo_doc)

    // 3. Base64
    const nombreArchivo = `${factura.emisor_ruc}-${factura.tipo_doc}-${factura.serie}-${String(factura.numero).padStart(8, '0')}`
    const xmlBase64     = xmlToBase64(xmlFirmado)

    // 4. Token OAuth2
    const token = await getTokenSunat()

    // 5. Enviar a SUNAT
    const ruc = process.env.EMISOR_RUC
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

    // 6. Log del evento
    await query(
      `INSERT INTO eventos_sunat (factura_id, accion, response_body, status_code, exitoso, mensaje)
       VALUES ($1, 'ENVIO', $2, 200, $3, $4)`,
      [facturaId, JSON.stringify(data), aceptado, mensaje]
    )

    if (aceptado) {
      const cdrUrl = `https://e-consulta.sunat.gob.pe/ol-ti-itconsultaunificadalibre/consultaComprobantePago/consultarComprobante?ruc=${ruc}&tipoComprobante=${factura.tipo_doc}&serie=${factura.serie}&numero=${factura.numero}`

      await query(
        `UPDATE facturas SET
          estado        = 'Emitida',
          sunat_estado  = 'Aceptado',
          sunat_codigo  = $2,
          sunat_mensaje = $3,
          hash          = $4,
          cdr_url       = $5,
          updated_at    = NOW()
         WHERE id = $1`,
        [facturaId, data.numRspsta, mensaje, data.arcCdr || '', cdrUrl]
      )

      return { ok: true, mensaje: 'Comprobante aceptado por SUNAT', cdrUrl, data }
    } else {
      await query(
        `UPDATE facturas SET estado = 'Rechazada', sunat_mensaje = $2, updated_at = NOW() WHERE id = $1`,
        [facturaId, mensaje]
      )
      throw new Error(`SUNAT rechazó el comprobante: ${mensaje}`)
    }

  } catch (err) {
    const msg = err.response?.data?.desRspsta || err.message || 'Error al enviar a SUNAT'

    await query(
      `INSERT INTO eventos_sunat (factura_id, accion, response_body, status_code, exitoso, mensaje)
       VALUES ($1, 'ERROR', $2, $3, false, $4)`,
      [
        facturaId,
        JSON.stringify(err.response?.data || {}),
        err.response?.status || 500,
        msg,
      ]
    ).catch(() => {})

    throw new Error(msg)
  }
}

// ── Enviar Comunicación de Baja a SUNAT (anulación post-emisión) ──
// SUNAT exige notificar dentro de los 7 días calendario (art. 3°
// R.S. 097-2012/SUNAT). El sistema genera un resumen de bajas tipo
// "RA" y lo envía a la API antes de marcar el comprobante como Anulado.
export const enviarBajaASunat = async (facturaId, factura) => {
  const ruc          = process.env.EMISOR_RUC
  const fechaBaja    = new Date().toISOString().split('T')[0]

  // El nombre del archivo de baja sigue el formato:
  // RUC-RA-YYYYMMDD-001.xml  (RA = Resumen de Anulaciones)
  const idUnico      = String(facturaId).replace(/-/g, '').slice(0, 8)
  const nombreArch   = `${ruc}-RA-${fechaBaja.replace(/-/g, '')}-${idUnico}`

  // XML de Resumen de Bajas (UBL 2.1 — VoidedDocuments)
  const xmlBaja = `<?xml version="1.0" encoding="UTF-8"?>
<VoidedDocuments
  xmlns="urn:oasis:names:specification:ubl:schema:xsd:VoidedDocuments-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>1.0</cbc:CustomizationID>
  <cbc:ID>${nombreArch}</cbc:ID>
  <cbc:ReferenceDate>${fechaBaja}</cbc:ReferenceDate>
  <cbc:IssueDate>${fechaBaja}</cbc:IssueDate>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">${ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${process.env.EMISOR_RAZON_SOCIAL}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:VoidedDocumentsLine>
    <cbc:LineID>1</cbc:LineID>
    <cbc:DocumentTypeCode>${factura.tipo_doc}</cbc:DocumentTypeCode>
    <cbc:DocumentSerialID>${factura.serie}</cbc:DocumentSerialID>
    <cbc:FirstDocumentID>${String(factura.numero).padStart(8, '0')}</cbc:FirstDocumentID>
    <cbc:LastDocumentID>${String(factura.numero).padStart(8, '0')}</cbc:LastDocumentID>
    <cac:VoidReasonDescription>
      <cbc:Description>${factura._motivoBaja || 'Anulado por el usuario'}</cbc:Description>
    </cac:VoidReasonDescription>
  </cac:VoidedDocumentsLine>
</VoidedDocuments>`

  // Firmar con VoidedDocuments como root element
  const xmlFirmado  = firmarXml(xmlBaja, 'RA')
  const xmlBase64   = xmlToBase64(xmlFirmado)
  const token       = await getTokenSunat()

  const { data } = await axios.post(
    `${CPE_BASE}/comprobantes`,
    {
      archivo: {
        nomArchivo: `${nombreArch}.xml`,
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

  await query(
    `INSERT INTO eventos_sunat (factura_id, accion, response_body, status_code, exitoso, mensaje)
     VALUES ($1, 'BAJA', $2, 200, $3, $4)`,
    [facturaId, JSON.stringify(data), data.numRspsta === '0', data.desRspsta || 'Baja procesada']
  )

  if (data.numRspsta !== '0') {
    throw new Error(`SUNAT rechazó la baja: ${data.desRspsta}`)
  }

  return { ok: true, mensaje: 'Baja comunicada a SUNAT', data }
}

// ── Consultar estado de un comprobante en SUNAT ──────────────────
export const consultarEstado = async (tipoDoc, serie, numero) => {
  const token = await getTokenSunat()
  const ruc   = process.env.EMISOR_RUC

  const { data } = await axios.get(
    `${CPE_BASE}/comprobantes/${ruc}/${tipoDoc}/${serie}/${numero}/consultar`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'ruc':         ruc,
      },
      timeout: 15000,
    }
  )
  return data
}
