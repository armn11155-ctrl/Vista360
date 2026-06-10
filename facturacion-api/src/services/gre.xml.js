// ══════════════════════════════════════════════════════════════════
// GRE — Guía de Remisión Electrónica (UBL 2.1)
// Tipo 09 = Remitente | Tipo 31 = Transportista
// Serie obligatoria: T001 (Remitente) / V001 (Transportista)
// Obligatorio con sanción desde julio 2026 (R.S. 000255-2021/SUNAT)
// ══════════════════════════════════════════════════════════════════

const pad = (n) => String(n).padStart(8, '0')

/**
 * Construye el XML de Guía de Remisión (DespatchAdvice UBL 2.1)
 *
 * @param {Object} gre       - Datos de la GRE
 * @param {Array}  items     - Líneas de la GRE (productos/bultos)
 */
export const buildXmlGRE = (gre, items) => {
  const ruc        = process.env.EMISOR_RUC
  const razon      = process.env.EMISOR_RAZON_SOCIAL
  const serie      = gre.serie   // T001 (remitente) | V001 (transportista)
  const numero     = pad(gre.numero)
  const fecha      = gre.fecha_emision || new Date().toISOString().split('T')[0]
  const tipo       = gre.tipo_doc   // '09' remitente | '31' transportista

  // Motivos de traslado (catálogo 20 SUNAT)
  // 01=Venta, 02=Compra, 04=Traslado entre establecimientos, 08=Importación, 09=Exportación, 13=Otros
  const motivoCode = gre.motivo_traslado || '01'
  const motivoDesc = {
    '01': 'VENTA',
    '02': 'COMPRA',
    '04': 'TRASLADO ENTRE ESTABLECIMIENTOS',
    '08': 'IMPORTACION',
    '09': 'EXPORTACION',
    '13': 'OTROS',
  }[motivoCode] || 'OTROS'

  // Modalidad de traslado: 01=Transporte público | 02=Transporte privado
  const modalidad = gre.modalidad_traslado || '02'

  const lineas = items.map((item, i) => `
  <despatch:DespatchLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:DeliveredQuantity unitCode="${item.unidad_medida || 'NIU'}">${Number(item.cantidad).toFixed(2)}</cbc:DeliveredQuantity>
    <cac:OrderLineReference>
      <cbc:LineID>${i + 1}</cbc:LineID>
    </cac:OrderLineReference>
    <cac:Item>
      <cbc:Description><![CDATA[${item.descripcion}]]></cbc:Description>
      <cac:SellersItemIdentification>
        <cbc:ID>${item.codigo || String(i + 1).padStart(3, '0')}</cbc:ID>
      </cac:SellersItemIdentification>
    </cac:Item>
  </despatch:DespatchLine>`).join('')

  // Datos del transportista (obligatorio si modalidad=01)
  const transportistaXml = gre.transportista_ruc ? `
  <cac:ShipmentStage>
    <cbc:ID>1</cbc:ID>
    <cbc:TransportModeCode listAgencyName="PE:SUNAT" listName="Modalidad de traslado">${modalidad}</cbc:TransportModeCode>
    <cac:CarrierParty>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">${gre.transportista_ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[${gre.transportista_razon || ''}]]></cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:CarrierParty>
    ${gre.placa ? `<cac:TransportMeans>
      <cac:RoadTransport>
        <cbc:LicensePlateID>${gre.placa}</cbc:LicensePlateID>
      </cac:RoadTransport>
    </cac:TransportMeans>` : ''}
    ${gre.conductor_doc ? `<cac:DriverPerson>
      <cbc:ID schemeID="1">${gre.conductor_doc}</cbc:ID>
    </cac:DriverPerson>` : ''}
  </cac:ShipmentStage>` : `
  <cac:ShipmentStage>
    <cbc:ID>1</cbc:ID>
    <cbc:TransportModeCode listAgencyName="PE:SUNAT" listName="Modalidad de traslado">${modalidad}</cbc:TransportModeCode>
  </cac:ShipmentStage>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<DespatchAdvice
  xmlns="urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:despatch="urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>1.0</cbc:CustomizationID>
  <cbc:ID>${serie}-${numero}</cbc:ID>
  <cbc:IssueDate>${fecha}</cbc:IssueDate>
  <cbc:DespatchAdviceTypeCode>${tipo}</cbc:DespatchAdviceTypeCode>
  <cbc:Note><![CDATA[${motivoDesc}]]></cbc:Note>

  <cac:DespatchSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">${ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[${razon}]]></cbc:RegistrationName>
        <cac:RegistrationAddress>
          <cbc:AddressLine>
            <cbc:Line><![CDATA[${process.env.EMISOR_DIRECCION || ''}]]></cbc:Line>
          </cbc:AddressLine>
          <cac:Country>
            <cbc:IdentificationCode>PE</cbc:IdentificationCode>
          </cac:Country>
        </cac:RegistrationAddress>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:DespatchSupplierParty>

  <cac:DeliveryCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${gre.destinatario_tipo_doc === 'DNI' ? '1' : '6'}">${gre.destinatario_doc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[${gre.destinatario_nombre}]]></cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:DeliveryCustomerParty>

  <cac:Shipment>
    <cbc:ID>1</cbc:ID>
    <cbc:HandlingCode listAgencyName="PE:SUNAT" listName="Motivo de traslado">${motivoCode}</cbc:HandlingCode>
    <cbc:Information><![CDATA[${motivoDesc}]]></cbc:Information>
    <cbc:GrossWeightMeasure unitCode="${gre.unidad_peso || 'KGM'}">${Number(gre.peso_total || 0).toFixed(2)}</cbc:GrossWeightMeasure>
    <cbc:TotalTransportHandlingUnitQuantity>${gre.bultos || 1}</cbc:TotalTransportHandlingUnitQuantity>
    ${transportistaXml}
    <cac:Delivery>
      <cac:DeliveryAddress>
        <cbc:AddressLine>
          <cbc:Line><![CDATA[${gre.direccion_llegada || ''}]]></cbc:Line>
        </cbc:AddressLine>
        <cac:Country>
          <cbc:IdentificationCode>PE</cbc:IdentificationCode>
        </cac:Country>
      </cac:DeliveryAddress>
    </cac:Delivery>
    <cac:TransportHandlingUnit>
      <cbc:ID>1</cbc:ID>
      <cbc:TransportHandlingUnitTypeCode>${tipo === '09' ? 'BULTO' : 'UNIDAD'}</cbc:TransportHandlingUnitTypeCode>
      <cbc:QuantityDespatched>${gre.bultos || 1}</cbc:QuantityDespatched>
    </cac:TransportHandlingUnit>
    <cac:OriginAddress>
      <cbc:AddressLine>
        <cbc:Line><![CDATA[${gre.direccion_partida || process.env.EMISOR_DIRECCION || ''}]]></cbc:Line>
      </cbc:AddressLine>
      <cac:Country>
        <cbc:IdentificationCode>PE</cbc:IdentificationCode>
      </cac:Country>
    </cac:OriginAddress>
    ${gre.factura_referencia ? `<cac:OrderReference>
      <cbc:ID>${gre.factura_referencia}</cbc:ID>
    </cac:OrderReference>` : ''}
  </cac:Shipment>
${lineas}
</DespatchAdvice>`
}
