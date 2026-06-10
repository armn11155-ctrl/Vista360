-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: tablas faltantes para GRE, Retenciones, Percepciones
-- Ejecutar en PostgreSQL después del schema principal
-- ══════════════════════════════════════════════════════════════════

-- ── GUÍAS DE REMISIÓN ELECTRÓNICA (GRE) ───────────────────────────
CREATE TABLE IF NOT EXISTS guias_remision (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Numeración
  tipo_doc             VARCHAR(5)  NOT NULL, -- 09=Remitente | 31=Transportista
  serie                VARCHAR(5)  NOT NULL, -- T001 | V001
  numero               INTEGER     NOT NULL,
  numero_fmt           VARCHAR(20) GENERATED ALWAYS AS (serie || '-' || LPAD(numero::text, 8, '0')) STORED,

  -- Fechas
  fecha_emision        DATE        NOT NULL DEFAULT CURRENT_DATE,

  -- Emisor
  emisor_ruc           VARCHAR(11) NOT NULL,
  emisor_razon         VARCHAR(250) NOT NULL,

  -- Destinatario
  destinatario_tipo_doc VARCHAR(10) NOT NULL DEFAULT 'RUC',
  destinatario_doc     VARCHAR(20) NOT NULL,
  destinatario_nombre  VARCHAR(250) NOT NULL,

  -- Traslado
  motivo_traslado      VARCHAR(5)  NOT NULL DEFAULT '01', -- catálogo 20: 01=Venta, 04=Traslado, etc.
  modalidad_traslado   VARCHAR(5)  NOT NULL DEFAULT '02', -- 01=Público | 02=Privado
  peso_total           NUMERIC(12,2) DEFAULT 0,
  unidad_peso          VARCHAR(10) DEFAULT 'KGM',
  bultos               INTEGER     DEFAULT 1,

  -- Direcciones
  direccion_partida    VARCHAR(300),
  direccion_llegada    VARCHAR(300),

  -- Transportista (si modalidad=01)
  transportista_ruc    VARCHAR(11),
  transportista_razon  VARCHAR(250),
  placa                VARCHAR(20),
  conductor_doc        VARCHAR(20),

  -- Referencia a factura/comprobante origen
  factura_referencia   VARCHAR(30),

  -- Estado SUNAT
  estado               VARCHAR(30) DEFAULT 'Borrador', -- Borrador|Emitida|Rechazada
  sunat_estado         VARCHAR(50),
  sunat_codigo         VARCHAR(10),
  sunat_mensaje        VARCHAR(500),
  hash                 VARCHAR(200),
  xml_url              VARCHAR(500),

  -- Auditoría
  usuario_id           UUID REFERENCES usuarios(id),
  deleted              BOOLEAN DEFAULT false,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW(),

  UNIQUE(tipo_doc, serie, numero)
);

-- Ítems de la GRE
CREATE TABLE IF NOT EXISTS guia_items (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guia_id        UUID NOT NULL REFERENCES guias_remision(id) ON DELETE CASCADE,
  orden          INTEGER NOT NULL DEFAULT 1,
  descripcion    VARCHAR(300) NOT NULL,
  codigo         VARCHAR(50),
  unidad_medida  VARCHAR(10) DEFAULT 'NIU',  -- NIU=Unidad, KGM=Kilogramo, etc.
  cantidad       NUMERIC(12,4) NOT NULL DEFAULT 1
);

-- ── RETENCIONES (tipo 20) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS retenciones (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  serie                VARCHAR(5)  NOT NULL DEFAULT 'R001',
  numero               INTEGER     NOT NULL,
  fecha_emision        DATE        NOT NULL DEFAULT CURRENT_DATE,
  emisor_ruc           VARCHAR(11) NOT NULL,
  emisor_razon         VARCHAR(250) NOT NULL,
  proveedor_ruc        VARCHAR(11) NOT NULL,
  proveedor_nombre     VARCHAR(250) NOT NULL,
  regimen              VARCHAR(5)  NOT NULL DEFAULT '01', -- 01=3% | 02=6%
  total_comprobantes   NUMERIC(12,2) DEFAULT 0,
  total_retenido       NUMERIC(12,2) DEFAULT 0,
  documentos_json      JSONB NOT NULL DEFAULT '[]',
  estado               VARCHAR(30) DEFAULT 'Borrador',
  sunat_estado         VARCHAR(50),
  sunat_codigo         VARCHAR(10),
  sunat_mensaje        VARCHAR(500),
  hash                 VARCHAR(200),
  usuario_id           UUID REFERENCES usuarios(id),
  deleted              BOOLEAN DEFAULT false,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW(),
  UNIQUE(serie, numero)
);

-- ── PERCEPCIONES (tipo 40) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS percepciones (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  serie                VARCHAR(5)  NOT NULL DEFAULT 'P001',
  numero               INTEGER     NOT NULL,
  fecha_emision        DATE        NOT NULL DEFAULT CURRENT_DATE,
  emisor_ruc           VARCHAR(11) NOT NULL,
  emisor_razon         VARCHAR(250) NOT NULL,
  cliente_ruc          VARCHAR(11) NOT NULL,
  cliente_nombre       VARCHAR(250) NOT NULL,
  regimen              VARCHAR(5)  NOT NULL DEFAULT '02', -- 01=1% | 02=2% | 03=3.5%
  total_comprobantes   NUMERIC(12,2) DEFAULT 0,
  total_percibido      NUMERIC(12,2) DEFAULT 0,
  documentos_json      JSONB NOT NULL DEFAULT '[]',
  estado               VARCHAR(30) DEFAULT 'Borrador',
  sunat_estado         VARCHAR(50),
  sunat_codigo         VARCHAR(10),
  sunat_mensaje        VARCHAR(500),
  hash                 VARCHAR(200),
  usuario_id           UUID REFERENCES usuarios(id),
  deleted              BOOLEAN DEFAULT false,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW(),
  UNIQUE(serie, numero)
);

-- ── COMPRAS (para registro de compras / PLE 8.1) ──────────────────
CREATE TABLE IF NOT EXISTS compras (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo_doc             VARCHAR(5)  NOT NULL DEFAULT '01',
  serie                VARCHAR(10),
  numero               VARCHAR(20) NOT NULL,
  fecha_emision        DATE        NOT NULL,
  fecha_vencimiento    DATE,
  proveedor_tipo_doc   VARCHAR(10) DEFAULT 'RUC',
  proveedor_doc        VARCHAR(20) NOT NULL,
  proveedor_nombre     VARCHAR(250) NOT NULL,
  moneda               VARCHAR(3)  DEFAULT 'PEN',
  tipo_cambio          NUMERIC(8,4) DEFAULT 1,
  op_gravada           NUMERIC(12,2) DEFAULT 0,
  op_exonerada         NUMERIC(12,2) DEFAULT 0,
  op_inafecta          NUMERIC(12,2) DEFAULT 0,
  op_no_gravada        NUMERIC(12,2) DEFAULT 0,
  igv                  NUMERIC(12,2) DEFAULT 0,
  total                NUMERIC(12,2) NOT NULL DEFAULT 0,
  descripcion          VARCHAR(500),
  categoria            VARCHAR(100),
  -- Derecho a crédito fiscal
  credito_fiscal       BOOLEAN DEFAULT true,
  usuario_id           UUID REFERENCES usuarios(id),
  deleted              BOOLEAN DEFAULT false,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW()
);

-- ── SERIES para nuevos tipos ───────────────────────────────────────
-- GRE Remitente (09) serie T001
INSERT INTO series (tipo_doc, serie, correlativo) VALUES
  ('09', 'T001', 0),
  ('31', 'V001', 0),
  ('20', 'R001', 0),
  ('40', 'P001', 0)
ON CONFLICT (tipo_doc, serie) DO NOTHING;

-- ── ÍNDICES ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_guias_estado   ON guias_remision(estado);
CREATE INDEX IF NOT EXISTS idx_guias_fecha    ON guias_remision(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_guias_dest     ON guias_remision(destinatario_doc);
CREATE INDEX IF NOT EXISTS idx_guia_items     ON guia_items(guia_id);
CREATE INDEX IF NOT EXISTS idx_retenciones    ON retenciones(proveedor_ruc, fecha_emision);
CREATE INDEX IF NOT EXISTS idx_percepciones   ON percepciones(cliente_ruc, fecha_emision);
CREATE INDEX IF NOT EXISTS idx_compras_fecha  ON compras(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_compras_prv    ON compras(proveedor_doc);
