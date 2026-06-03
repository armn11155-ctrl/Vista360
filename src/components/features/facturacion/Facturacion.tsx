// @ts-nocheck — migración progresiva a TypeScript estricto
// Los tipos clave ya están definidos abajo; se irán activando archivo por archivo.

// ── TypeScript interfaces para este módulo ────────────────────────
interface ModalDetalleFacturaProps {
  factura: import("../../../types").Factura & {
    cliente_nombre?: string;
    cliente_doc?: string;
    cliente_email?: string;
    cliente_doc_tipo?: string;
    sunat_estado?: string;
    subtotal?: number;
    igv?: number;
    total?: number;
    moneda?: string;
    monto?: number;
    metodo_pago?: string;
    nro_operacion?: string;
    fecha_pago?: string;
    hash?: string;
    pdf_url?: string;
    xml_url?: string;
    periodo_inicio?: string;
    periodo_fin?: string;
    tipo?: string;
    serie?: string;
    numero?: string | number;
  };
  paneles: import("../../../types").Panel[];
  clientes: import("../../../types").Cliente[];
  onClose: () => void;
}

interface ModalPreFacturaProps {
  contrato: import("../../../types").Contrato & { monto?: number; inicio?: string; fin?: string };
  panel: import("../../../types").Panel & { ciudad?: string; tipo?: string; direccion?: string };
  cliente: import("../../../types").Cliente & {
    empresa?: string;
    ruc?: string;
    dni?: string;
    contacto?: string;
    celular?: string;
    telefono?: string;
    direccion?: string;
  };
  onClose: () => void;
}

interface FacturacionProps {
  paneles: import("../../../types").Panel[];
  clientes: import("../../../types").Cliente[];
  contratos: import("../../../types").Contrato[];
}

// ── Constantes de facturación (IGV Perú) ─────────────────────────
const IGV_RATE = 0.18;

/** Ciudades exoneradas de IGV bajo Ley de Amazonía N° 27037 */
const CIUDADES_EXONERADAS_IGV = new Set([
  "Huánuco",
  "Loreto",
  "San Martín",
  "Ucayali",
  "Amazonas",
  "Madre de Dios",
  "Pucallpa",
  "Iquitos",
  "Tarapoto",
  "Tingo María",
  "Puerto Maldonado",
]);

const isExoneradoIGV = (ciudad: string): boolean => CIUDADES_EXONERADAS_IGV.has(ciudad);

/**
 * Logo 8 Millas en base64 (SVG minificado).
 * Si tienes el logo real, reemplaza este valor con el base64 de tu imagen.
 * Puedes obtenerlo con: btoa(String.fromCharCode(...new Uint8Array(buffer)))
 */
const DRAWER_LOGO_B64 =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgNDAiPjx0ZXh0IHg9IjAiIHk9IjMwIiBmb250LXNpemU9IjI4IiBmb250LXdlaWdodD0iOTAwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZmlsbD0iI2ZmZiI+OCBNaWxsYXM8L3RleHQ+PC9zdmc+";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../../config/firebase";
import { getAuth, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import type { Panel, Cliente, Contrato, Gasto, Proveedor, Factura, Sueldo } from "../../../types";
import { fb } from "../../../services/firestore";
import { T, tCol, catCol } from "../../../config/theme";
import { toast, confirmAsync } from "../../../context/UIContext";
import { fmt, fmtF, dias, mesHoy, mesLabel, hoy, validate, haptic } from "../../../lib/utils";
import { toNumber, toDate } from "../../../lib/converters";
import {
  CIUDADES,
  CAT_GASTOS,
  CAT_PROVE,
  SECTORES,
  ESTADOS_CLI,
  ESTADOS_PRO,
  EMOJIS,
  EMISOR,
} from "../../../config/constants";
import {
  Modal,
  FieldGroup,
  Badge,
  Tag,
  Card,
  SecTit,
  PgTit,
  Pagination,
  Spinner,
  SwipeRow,
  SkCard,
  SkPulse,
} from "../../ui";
import { usePagination } from "../../../hooks/usePagination";

// ── Helpers de formato ──
function fmtMes(ym: string): string {
  if (!ym) return ym;
  const [y, m] = ym.split("-");
  const meses = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  return `${meses[parseInt(m, 10) - 1] ?? m} ${y}`;
}

// ── Constantes de estados de factura ──
// Estados reales del flujo SUNAT — el usuario solo puede crear Borradores.
// SUNAT asigna: Emitida/Aceptada/Rechazada. El usuario cobra: Cobrada.
// Anulada también va por API. Nunca se edita el estado manualmente.
const EST_FAC = [
  "Borrador",
  "Emitida",
  "Aceptada",
  "Pendiente de cobro",
  "Cobrada",
  "Pagada",
  "Vencida",
  "Anulada",
  "Rechazada",
];

// Solo estos estados son asignados por el usuario (el resto los pone SUNAT o el sistema)
const EST_USUARIO = ["Borrador", "Cobrada", "Anulada"];

const EST_FAC_COL: Record<string, string> = {
  Borrador: "#94A3B8",
  Emitida: "#2563EB",
  Aceptada: "#0891B2",
  Pendiente: "#F59E0B",
  Cobrada: "#10B981",
  Pagada: "#10B981",
  Vencida: "#EF4444",
  Anulada: "#64748B",
  Rechazada: "#EF4444",
};

function ModalDetalleFactura({ factura, paneles, clientes, onClose }: ModalDetalleFacturaProps) {
  // Cliente: prefiere campos directos del API, cae a lookup en CRM por ID
  const cli = factura.cliente_nombre
    ? { empresa: factura.cliente_nombre, ruc: factura.cliente_doc, email: factura.cliente_email }
    : clientes.find(c => c.id === factura.cliente_id);
  const pan = paneles.find(p => p.id === factura.panel_id);

  // Montos: prefiere campos del API, cae a "monto" legacy
  const subtotal = factura.subtotal != null ? Number(factura.subtotal) : null;
  const igv = factura.igv != null ? Number(factura.igv) : null;
  const total = factura.total != null ? Number(factura.total) : Number(factura.monto || 0);
  const monedaSimbolo = factura.moneda === "USD" ? "US$" : "S/";

  const estadoColor = EST_FAC_COL[factura.estado] || T.muted;
  const numeroFmt = factura.numero?.toString().padStart(8, "0") || factura.numero;

  const isCobrada = factura.estado === "Cobrada" || factura.estado === "Pagada";

  // Estado para el visor PDF inline
  const [mostrarPDF, setMostrarPDF] = useState(false);
  const [pdfCargando, setPdfCargando] = useState(false);

  const tipoLabel =
    {
      FACTURA: "Factura electrónica",
      BOLETA: "Boleta de venta",
      NOTA_CREDITO: "↩️ Nota de crédito",
      NOTA_DEBITO: "Nota de débito",
    }[factura.tipo] ||
    factura.tipo ||
    "Comprobante";

  const nombreArchivo = `${factura.serie || "FAC"}-${numeroFmt || factura.numero || "00000001"}.pdf`;

  const verXML = () => {
    if (!factura.xml_url) return;
    window.open(factura.xml_url, "_blank", "noopener,noreferrer");
  };

  // Descarga directa del PDF
  const descargarPDF = async () => {
    if (!factura.pdf_url) {
      toast.info("Este comprobante aún no tiene PDF disponible.");
      return;
    }
    try {
      const resp = await fetch(factura.pdf_url);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Si el fetch falla por CORS, abrir en nueva pestaña como fallback
      window.open(factura.pdf_url, "_blank", "noopener,noreferrer");
    }
  };

  const toggleVisorPDF = () => {
    if (!factura.pdf_url) {
      toast.info("Este comprobante aún no tiene PDF disponible.");
      return;
    }
    if (!mostrarPDF) setPdfCargando(true);
    setMostrarPDF(v => !v);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        zIndex: 300,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: "22px 22px 0 0",
          padding: "10px 20px 24px",
          width: "100%",
          maxHeight: "92vh",
          overflowY: "auto",
          overscrollBehavior: "none",
          paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
          boxShadow: "0 -10px 40px rgba(0,0,0,0.7)",
        }}
      >
        {/* Drag handle iOS */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border }} />
        </div>
        {/* Header con tipo + serie/número + estado */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 18,
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.muted,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                marginBottom: 4,
              }}
            >
              {tipoLabel}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: T.white,
                fontFamily: "monospace",
                letterSpacing: "-0.5px",
              }}
            >
              {factura.serie}-{numeroFmt}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {/* Estado interno — solo Borrador/Emitida/Cobrada/Anulada/Rechazada */}
              <span
                style={{
                  background: estadoColor + "22",
                  color: estadoColor,
                  border: `1px solid ${estadoColor}55`,
                  borderRadius: 8,
                  padding: "3px 11px",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {factura.estado}
              </span>
              {factura.sunat_estado && (
                <span
                  style={{
                    background: T.cyan + "18",
                    color: T.cyan,
                    border: `1px solid ${T.cyan}44`,
                    borderRadius: 8,
                    padding: "3px 11px",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  SUNAT: {factura.sunat_estado}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: T.border,
              border: "none",
              borderRadius: 8,
              padding: "5px 11px",
              color: T.muted,
              cursor: "pointer",
              touchAction: "manipulation",
              fontSize: 15,
              flexShrink: 0,
            }}
          ></button>
        </div>

        {/* CLIENTE */}
        <div
          style={{
            background: T.surface,
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 10,
            border: `1px solid ${T.border}`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: T.muted,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            Cliente
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 3 }}>
            {cli?.empresa || factura.cliente_nombre || "—"}
          </div>
          {(cli?.ruc || factura.cliente_doc) && (
            <div style={{ fontSize: 12, color: T.muted, fontFamily: "monospace" }}>
              {factura.cliente_doc_tipo ||
                ((cli?.ruc || factura.cliente_doc)?.length === 11 ? "RUC" : "DNI")}
              : {cli?.ruc || factura.cliente_doc}
            </div>
          )}
          {(cli?.email || factura.cliente_email) && (
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
              {cli?.email || factura.cliente_email}
            </div>
          )}
        </div>

        {/* PANEL / CONCEPTO */}
        {(pan || factura.concepto) && (
          <div
            style={{
              background: T.surface,
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 10,
              border: `1px solid ${T.border}`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: T.muted,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              Concepto
            </div>
            <div style={{ fontSize: 13, color: T.white, marginBottom: 3 }}>
              {factura.concepto || "Arrendamiento de Panel Publicitario"}
            </div>
            {pan && (
              <div style={{ fontSize: 12, color: T.muted }}>
                Panel: <strong style={{ color: T.text }}>{pan.nombre}</strong>
                {pan.ciudad ? ` · ${pan.ciudad}` : ""}
              </div>
            )}
            {(factura.periodo_inicio || factura.periodo_fin) && (
              <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                Período: {fmtF(factura.periodo_inicio)} → {fmtF(factura.periodo_fin)}
              </div>
            )}
          </div>
        )}

        {/* MONTOS */}
        <div
          style={{
            background: T.surface,
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 10,
            border: `1px solid ${T.border}`,
          }}
        >
          {subtotal != null && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                color: T.muted,
                marginBottom: 5,
              }}
            >
              <span>Subtotal</span>
              <span style={{ fontFamily: "monospace", color: T.text }}>
                {monedaSimbolo} {subtotal.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          {igv != null && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                color: T.muted,
                marginBottom: 8,
              }}
            >
              <span>IGV {igv === 0 ? "(Exonerado)" : "18%"}</span>
              <span style={{ fontFamily: "monospace", color: igv === 0 ? T.green : T.text }}>
                {monedaSimbolo} {igv.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 17,
              fontWeight: 800,
              color: T.green,
              borderTop: subtotal != null ? `1px solid ${T.border}` : "none",
              paddingTop: subtotal != null ? 8 : 0,
            }}
          >
            <span>TOTAL</span>
            <span style={{ fontFamily: "monospace" }}>
              {monedaSimbolo} {total.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* FECHAS */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <div
            style={{
              background: T.surface,
              borderRadius: 12,
              padding: "10px 14px",
              border: `1px solid ${T.border}`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: T.muted,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 3,
              }}
            >
              Emisión
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>
              {fmtF(factura.fecha_emision)}
            </div>
          </div>
          <div
            style={{
              background: T.surface,
              borderRadius: 12,
              padding: "10px 14px",
              border: `1px solid ${T.border}`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: T.muted,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 3,
              }}
            >
              Vencimiento
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>
              {fmtF(factura.fecha_vencimiento)}
            </div>
          </div>
        </div>

        {/* PAGO (si está cobrada y vino info de pago del API) */}
        {isCobrada && (factura.metodo_pago || factura.fecha_pago || factura.nro_operacion) && (
          <div
            style={{
              background: T.green + "10",
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 10,
              border: `1px solid ${T.green}33`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: T.green,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              Pago registrado
            </div>
            {factura.metodo_pago && (
              <div style={{ fontSize: 12, color: T.text, marginBottom: 2 }}>
                Método: <strong>{factura.metodo_pago}</strong>
              </div>
            )}
            {factura.nro_operacion && (
              <div style={{ fontSize: 12, color: T.muted, fontFamily: "monospace" }}>
                Op. N° {factura.nro_operacion}
              </div>
            )}
            {factura.fecha_pago && (
              <div style={{ fontSize: 12, color: T.muted }}>Fecha: {fmtF(factura.fecha_pago)}</div>
            )}
          </div>
        )}

        {/* HASH SUNAT (si vino del API) */}
        {factura.hash && (
          <div
            style={{
              background: T.surface,
              borderRadius: 12,
              padding: "10px 14px",
              marginBottom: 10,
              border: `1px solid ${T.border}`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: T.muted,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 4,
              }}
            >
              Hash SUNAT
            </div>
            <div
              style={{
                fontSize: 11,
                color: T.muted,
                fontFamily: "monospace",
                wordBreak: "break-all",
                lineHeight: 1.4,
              }}
            >
              {factura.hash}
            </div>
          </div>
        )}

        {/* ── VISOR PDF INLINE ── */}
        {factura.pdf_url && mostrarPDF && (
          <div
            style={{
              marginBottom: 12,
              borderRadius: 14,
              overflow: "hidden",
              border: `1px solid ${T.accent}44`,
              background: "#0D1421",
              position: "relative",
            }}
          >
            {/* Barra superior del visor */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: "rgba(37,99,235,0.12)",
                borderBottom: `1px solid ${T.accent}33`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{ fontSize: 12, fontWeight: 700, color: T.white, fontFamily: "monospace" }}
                >
                  {nombreArchivo}
                </span>
              </div>
              <button
                onClick={() => setMostrarPDF(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: T.muted,
                  cursor: "pointer",
                  touchAction: "manipulation",
                  fontSize: 16,
                  lineHeight: 1,
                }}
              ></button>
            </div>

            {/* Spinner mientras carga el iframe */}
            {pdfCargando && (
              <div
                style={{
                  position: "absolute",
                  inset: "48px 0 0 0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#0D1421",
                  zIndex: 2,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 10,
                    color: T.muted,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      border: `2px solid ${T.border}`,
                      borderTopColor: T.accent,
                      borderRadius: "50%",
                      animation: "spin .7s linear infinite",
                    }}
                  />
                  <span style={{ fontSize: 12 }}>Cargando PDF...</span>
                </div>
              </div>
            )}

            {/* iFrame del PDF */}
            <iframe
              src={factura.pdf_url}
              title={nombreArchivo}
              onLoad={() => setPdfCargando(false)}
              style={{
                width: "100%",
                height: 480,
                border: "none",
                display: "block",
                background: "#fff",
              }}
            />
          </div>
        )}

        {/* BOTONES PDF */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 18 }}>
          {/* Botón Ver PDF (abre visor inline) */}
          <button
            onClick={toggleVisorPDF}
            disabled={!factura.pdf_url}
            style={{
              width: "100%",
              padding: 13,
              background: factura.pdf_url
                ? mostrarPDF
                  ? `linear-gradient(135deg,#7B5FFF,${T.accent})`
                  : `linear-gradient(135deg,${T.accent},#7B5FFF)`
                : T.border,
              border: "none",
              borderRadius: 11,
              color: T.white,
              fontWeight: 700,
              fontSize: 14,
              cursor: factura.pdf_url ? "pointer" : "not-allowed",
              opacity: factura.pdf_url ? 1 : 0.5,
              boxShadow: factura.pdf_url ? `0 4px 16px ${T.accent}44` : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {factura.pdf_url ? (mostrarPDF ? " Ocultar PDF" : "️ Ver PDF") : "PDF no disponible"}
          </button>

          {/* Botón Descargar PDF */}
          {factura.pdf_url && (
            <button
              onClick={descargarPDF}
              style={{
                width: "100%",
                padding: "13px 22px",
                background: "linear-gradient(135deg,#1E35C8 0%,#3854EE 100%)",
                border: "none",
                borderRadius: 50,
                color: T.white,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                touchAction: "manipulation",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 4px 22px rgba(30,53,200,0.45), inset 0 1px 0 rgba(255,255,255,0.22)",
                minHeight: 46,
                fontFamily: "inherit",
                letterSpacing: "0.01em",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <polyline points="9 15 12 18 15 15" />
              </svg>
              Descargar PDF
            </button>
          )}

          {factura.xml_url && (
            <button
              onClick={verXML}
              style={{
                width: "100%",
                padding: 11,
                background: "transparent",
                border: `1px solid ${T.border}`,
                borderRadius: 11,
                color: T.muted,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                touchAction: "manipulation",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              Descargar XML firmado
            </button>
          )}

          <button
            onClick={onClose}
            style={{
              width: "100%",
              padding: 11,
              background: "transparent",
              border: `1px solid ${T.border}`,
              borderRadius: 11,
              color: T.muted,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              touchAction: "manipulation",
            }}
          >
            Cerrar
          </button>
        </div>

        {/* Nota informativa */}
        <div
          style={{
            marginTop: 14,
            padding: "8px 12px",
            background: T.accent + "08",
            borderRadius: 8,
            border: `1px solid ${T.accent}22`,
          }}
        >
          <div style={{ fontSize: 10.5, color: T.muted, lineHeight: 1.5 }}>
            Comprobante emitido por tu sistema de facturación externo. La app solo muestra los datos
            en modo lectura.
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// FACTURACIÓN — VISOR DE SOLO LECTURA
// ──────────────────────────────────────────────────────────────────
// Vista360 NO crea ni edita comprobantes.
// Solo muestra lo que facturacion-web guardó en Firestore.
// Ambas apps comparten el mismo proyecto Firebase.
// ──────────────────────────────────────────────────────────────────

// ── Facturacion usa onSnapshot para actualizaciones en tiempo real ──
// Cuando facturacion-web emite o cobra un comprobante, Vista360 lo
// refleja automáticamente sin necesidad de refrescar la pantalla.


// ── KPI CARD — mismo diseño que Contratos (dark navy + wave) ─────────────────
const KPIDark = ({
  label,
  value,
  valueColor = T.white,
  sub,
  accent = T.accent,
  icon,
}: {
  label: string;
  value: string | number;
  valueColor?: string;
  sub?: string;
  accent?: string;
  icon?: React.ReactNode;
}) => {
  const waveId = `kd-${(accent || "").replace("#", "")}-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(145deg,#0E1835 0%,#0A1228 100%)",
        border: "1px solid rgba(79,124,255,0.18)",
        borderRadius: 18,
        padding: "16px 16px 18px",
        boxShadow: "0 8px 24px rgba(8,12,28,0.45),inset 0 1px 0 rgba(255,255,255,0.04)",
        minHeight: 138,
      }}
    >
      <svg
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          left: 0, right: 0, bottom: 0,
          width: "100%", height: 80,
          pointerEvents: "none", opacity: 0.35,
        }}
      >
        <defs>
          <linearGradient id={waveId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={accent} stopOpacity="0" />
            <stop offset="0.5" stopColor={accent} stopOpacity="0.55" />
            <stop offset="1" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 60 Q100 20 200 50 T400 40" stroke={`url(#${waveId})`} strokeWidth="1.2" fill="none" />
        <path d="M0 80 Q120 40 240 70 T400 60" stroke={`url(#${waveId})`} strokeWidth="0.8" fill="none" opacity="0.7" />
        <path d="M0 100 Q140 60 280 90 T400 80" stroke={`url(#${waveId})`} strokeWidth="0.6" fill="none" opacity="0.5" />
      </svg>
      <div style={{ position: "relative", zIndex: 2 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div
            style={{
              fontSize: 9.5, fontWeight: 800, color: "#5B7FCC",
              letterSpacing: 1.4, flex: 1, lineHeight: 1.3, textTransform: "uppercase",
            }}
          >
            {label}
          </div>
          <div
            style={{
              width: 38, height: 38, borderRadius: 10,
              border: `1px solid ${
                accent === T.green  ? "rgba(16,185,129,0.4)"  :
                accent === T.white  ? "rgba(245,158,11,0.4)"  :
                accent === T.red    ? "rgba(239,68,68,0.4)"   :
                                      "rgba(255,255,255,0.18)"
              }`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            {icon}
          </div>
        </div>
        <div
          style={{
            fontSize: 26, fontWeight: 900, color: valueColor,
            letterSpacing: "-0.8px", lineHeight: 1, marginBottom: 8,
            fontVariantNumeric: "tabular-nums", wordBreak: "break-word",
          }}
        >
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: 10.5, color: "rgba(160,180,220,0.65)", fontWeight: 500 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
};

function Facturacion({ paneles, clientes, contratos }: FacturacionProps) {
  // contratos se recibe pero no se usa (compat con la firma anterior)
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalDetalle, setModalDetalle] = useState<Factura | null>(null);
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroMes, setFiltroMes] = useState("Todos");
  const [filtroCliente, setFiltroCliente] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState("lista");

  const conectado = true; // siempre conectado via Firebase

  // ── Suscripción en tiempo real a Firestore ─────────────────────
  // onSnapshot mantiene la lista sincronizada automáticamente:
  // cualquier cambio desde facturacion-web aparece al instante.
  useEffect(() => {
    setLoading(true);
    setError("");
    const q = query(collection(db, "facturas"), orderBy("fecha_emision", "desc"));
    const unsub = onSnapshot(
      q,
      snap => {
        setFacturas(snap.docs.map(d => ({ id: d.id, ...d.data() })) as unknown as Factura[]);
        setLoading(false);
      },
      err => {
        setError(err instanceof Error ? err.message : "Error al cargar comprobantes");
        setFacturas([]);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  // Helpers para acceder a campos con fallback (formato API o legacy)
  const totalDe = f => Number(f.total ?? f.monto ?? 0);
  const clienteNombreDe = f => {
    if (f.cliente_nombre) return f.cliente_nombre;
    const c = clientes.find(cl => cl.id === f.cliente_id);
    return c?.empresa || "—";
  };

  // Meses disponibles
  const meses = useMemo(() => {
    const s = new Set(facturas.map(f => f.fecha_emision?.slice(0, 7)).filter(Boolean));
    return ["Todos", ...Array.from(s).sort().reverse()];
  }, [facturas]);

  // Filtrado
  const facsFiltradas = useMemo(() => {
    return facturas.filter(f => {
      if (filtroEstado !== "Todos" && f.estado !== filtroEstado) return false;
      if (filtroMes !== "Todos" && f.fecha_emision?.slice(0, 7) !== filtroMes) return false;
      if (filtroCliente !== "Todos" && f.cliente_id !== filtroCliente) return false;
      if (busqueda) {
        const cli = clienteNombreDe(f);
        const pan = paneles.find(p => p.id === f.panel_id);
        const q = busqueda.toLowerCase();
        const txt =
          `${f.serie}-${f.numero} ${cli} ${pan?.nombre || ""} ${f.concepto || ""} ${f.cliente_doc || ""}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facturas, filtroEstado, filtroMes, filtroCliente, busqueda, clientes, paneles]);

  // KPIs
  const kpis = useMemo(() => {
    const all = facturas.filter(f => f.estado !== "Anulada" && f.estado !== "Rechazada");
    const total = all.reduce((a, f) => a + totalDe(f), 0);
    const cobradas = all
      .filter(f => f.estado === "Cobrada" || f.estado === "Pagada")
      .reduce((a, f) => a + totalDe(f), 0);
    const pendientes = all
      .filter(f => ["Emitida", "Aceptada", "Pendiente"].includes(f.estado))
      .reduce((a, f) => a + totalDe(f), 0);
    const vencidas = all.filter(f => f.estado === "Vencida").reduce((a, f) => a + totalDe(f), 0);
    return { total, cobradas, pendientes, vencidas, count: all.length };
  }, [facturas]);

  const numeroFmt = (n: string | number | null | undefined) => String(n ?? "").padStart(8, "0");

  // ── DECORACIONES (líneas onduladas en cards oscuras) ──
  const WaveDeco = ({ color = T.accent }) => {
    const id = `fwv-${color.replace("#", "")}-${Math.random().toString(36).slice(2, 7)}`;
    return (
      <svg
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: 80,
          pointerEvents: "none",
          opacity: 0.35,
        }}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={color} stopOpacity="0" />
            <stop offset="0.5" stopColor={color} stopOpacity="0.55" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 60 Q100 20 200 50 T400 40" stroke={`url(#${id})`} strokeWidth="1.2" fill="none" />
        <path d="M0 80 Q120 40 240 70 T400 60" stroke={`url(#${id})`} strokeWidth="0.8" fill="none" opacity="0.7" />
        <path d="M0 100 Q140 60 280 90 T400 80" stroke={`url(#${id})`} strokeWidth="0.6" fill="none" opacity="0.5" />
      </svg>
    );
  };

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* ── HEADER ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 20,
          background: "linear-gradient(135deg,#0F1729 0%,#1E3A8A 100%)",
          borderRadius: 18,
          padding: "16px 20px",
          boxShadow: "0 6px 24px rgba(15,23,41,0.32)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "50%",
            background: "linear-gradient(180deg,rgba(255,255,255,0.06) 0%,transparent 100%)",
            borderRadius: "18px 18px 0 0",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: "rgba(255,255,255,0.14)",
            border: "1px solid rgba(255,255,255,0.22)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            position: "relative",
            zIndex: 1,
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <rect x="5" y="3" width="14" height="18" rx="1.5" />
            <line x1="8" y1="8" x2="16" y2="8" />
            <line x1="8" y1="12" x2="16" y2="12" />
            <line x1="8" y1="16" x2="12" y2="16" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
          <div
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-0.3px",
              lineHeight: 1.2,
            }}
          >
            Facturación
          </div>
          <div
            style={{ fontSize: 12, color: "rgba(180,200,255,0.7)", fontWeight: 500, marginTop: 3 }}
          >
            {loading
              ? "Cargando..."
              : `${facturas.length} comprobante${facturas.length !== 1 ? "s" : ""} registrado${facturas.length !== 1 ? "s" : ""}`}
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: T.red + "12",
            border: `1px solid ${T.red}44`,
            borderRadius: 12,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 12,
            color: T.red,
          }}
        >
          {error}
        </div>
      )}

      {/* ── KPIs (4 cards oscuras estilo dashboard) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[
          {
            label: "TOTAL FACTURADO",
            val: fmt(kpis.total),
            valueColor: T.white,
            labelColor: "#5B7FCC",
            sub: `${kpis.count} comprobante${kpis.count !== 1 ? "s" : ""}`,
            accent: T.accent,
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <rect
                  x="3"
                  y="6"
                  width="18"
                  height="13"
                  rx="2"
                  stroke={T.white}
                  strokeWidth="1.6"
                />
                <line x1="3" y1="10" x2="21" y2="10" stroke={T.white} strokeWidth="1.6" />
                <line
                  x1="6.5"
                  y1="14.5"
                  x2="9.5"
                  y2="14.5"
                  stroke={T.white}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            ),
          },
          {
            label: "COBRADO",
            val: fmt(kpis.cobradas),
            valueColor: T.green,
            labelColor: "#5B7FCC",
            sub: `${facturas.filter(f => f.estado === "Cobrada" || f.estado === "Pagada").length} cobrada${facturas.filter(f => f.estado === "Cobrada" || f.estado === "Pagada").length !== 1 ? "s" : ""}`,
            accent: T.green,
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke={T.green} strokeWidth="1.6" />
                <polyline
                  points="8 12 11 15 16 9"
                  stroke={T.green}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            ),
          },
          {
            label: "PENDIENTE COBRO",
            val: fmt(kpis.pendientes),
            valueColor: T.white,
            labelColor: "#5B7FCC",
            sub: `${facturas.filter(f => ["Emitida", "Aceptada", "Pendiente"].includes(f.estado)).length} emitida${facturas.filter(f => ["Emitida", "Aceptada", "Pendiente"].includes(f.estado)).length !== 1 ? "s" : ""}`,
            accent: T.white,
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 2H18M6 22H18M6 2V8C6 10 9 12 12 12C15 12 18 10 18 8V2M6 22V16C6 14 9 12 12 12C15 12 18 14 18 16V22"
                  stroke={T.white}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ),
          },
          {
            label: "VENCIDAS",
            val: fmt(kpis.vencidas),
            valueColor: T.white,
            labelColor: "#5B7FCC",
            sub: `${facturas.filter(f => f.estado === "Vencida").length} sin cobrar`,
            accent: T.red,
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 4C9 4 7 6 7 9V13L5 16H19L17 13V9C17 6 15 4 12 4Z"
                  stroke={T.white}
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="9" r="0.8" fill={T.white} />
                <line
                  x1="12"
                  y1="11"
                  x2="12"
                  y2="13"
                  stroke={T.white}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M10 19C10 20 11 21 12 21C13 21 14 20 14 19"
                  stroke={T.white}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            ),
          },
        ].map((k, i) => (
          <KPIDark
            key={i}
            label={k.label}
            value={k.val}
            valueColor={k.valueColor}
            sub={k.sub}
            accent={k.accent}
            icon={k.icon}
          />
        ))}
      </div>

      {/* ── Botón Nueva Factura + Buscador ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <button
          onClick={() => {
            // Vista360 es solo-lectura para facturas. Si VITE_FACTURACION_WEB_URL
            // está configurada, abrimos directamente la app de facturación.
            const facUrl = import.meta.env.VITE_FACTURACION_WEB_URL;
            if (facUrl) {
              window.open(`${facUrl}/nueva-factura`, "_blank", "noopener");
            } else {
              toast.info(
                "Las facturas se crean desde tu sistema de facturación web. Vista360 las muestra automáticamente desde Firestore.",
              );
            }
          }}
          style={{
            background: T.accent,
            border: "none",
            borderRadius: 12,
            padding: "12px 18px",
            color: T.white,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            touchAction: "manipulation",
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: 6,
            boxShadow: "0 4px 14px rgba(37,99,235,0.32)",
          }}
        >
          + Nueva Factura
        </button>
        <div style={{ flex: 1, position: "relative" }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          >
            <circle cx="11" cy="11" r="7" stroke="#94A3B8" strokeWidth="2" />
            <line
              x1="21"
              y1="21"
              x2="16"
              y2="16"
              stroke="#94A3B8"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por cliente, panel, serie..."
            style={{
              width: "100%",
              background: T.white,
              border: "1px solid #E5E7EB",
              borderRadius: 12,
              padding: "12px 14px 12px 38px",
              color: T.text,
              fontSize: 13,
              outline: "none",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* ── Filtros (3 dropdowns + 2 botones de vista) ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, alignItems: "center" }}>
        <div
          style={{ display: "flex", gap: 8, flex: 1, overflowX: "auto", scrollbarWidth: "none" }}
        >
          {[
            {
              value: filtroEstado,
              onChange: setFiltroEstado,
              label: "Todos los estados",
              options: [
                "Todos",
                "Borrador",
                "Emitida",
                "Aceptada",
                "Cobrada",
                "Vencida",
                "Anulada",
                "Rechazada",
              ],
            },
            {
              value: filtroMes,
              onChange: setFiltroMes,
              label: "Todos los meses",
              options: meses,
              fmt: m => (m === "Todos" ? "Todos los meses" : fmtMes(m)),
            },
            {
              value: filtroCliente,
              onChange: setFiltroCliente,
              label: "Todos los clientes",
              options: ["Todos", ...clientes.map(c => c.id)],
              fmt: id =>
                id === "Todos"
                  ? "Todos los clientes"
                  : clientes.find(c => c.id === id)?.empresa || "—",
            },
          ].map((f, i) => (
            <div key={i} style={{ position: "relative", flexShrink: 0 }}>
              <select
                value={f.value}
                onChange={e => f.onChange(e.target.value)}
                style={{
                  background: T.white,
                  border: "1px solid #E5E7EB",
                  borderRadius: 10,
                  padding: "10px 32px 10px 14px",
                  color: T.text,
                  fontSize: 12,
                  fontWeight: 600,
                  outline: "none",
                  fontFamily: "inherit",
                  appearance: "none",
                  cursor: "pointer",
                  touchAction: "manipulation",
                  boxShadow: "0 1px 3px rgba(15,23,41,0.04)",
                }}
              >
                {f.options.map(opt => (
                  <option key={opt} value={opt}>
                    {f.fmt ? f.fmt(opt) : opt === "Todos" ? f.label : opt}
                  </option>
                ))}
              </select>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
              >
                <polyline
                  points="6 9 12 15 18 9"
                  stroke="#0F1729"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => setVista("lista")}
            style={{
              width: 42,
              height: 40,
              borderRadius: 10,
              border: vista === "lista" ? "1px solid rgba(37,99,235,0.4)" : "1px solid #E5E7EB",
              background: vista === "lista" ? "rgba(37,99,235,0.08)" : T.white,
              cursor: "pointer",
              touchAction: "manipulation",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <line
                x1="8"
                y1="6"
                x2="20"
                y2="6"
                stroke={vista === "lista" ? T.accent : "#0F1729"}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="8"
                y1="12"
                x2="20"
                y2="12"
                stroke={vista === "lista" ? T.accent : "#0F1729"}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="8"
                y1="18"
                x2="20"
                y2="18"
                stroke={vista === "lista" ? T.accent : "#0F1729"}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="4" cy="6" r="1.2" fill={vista === "lista" ? T.accent : "#0F1729"} />
              <circle cx="4" cy="12" r="1.2" fill={vista === "lista" ? T.accent : "#0F1729"} />
              <circle cx="4" cy="18" r="1.2" fill={vista === "lista" ? T.accent : "#0F1729"} />
            </svg>
          </button>
          <button
            onClick={() => setVista("resumen")}
            style={{
              width: 42,
              height: 40,
              borderRadius: 10,
              border: vista === "resumen" ? "1px solid rgba(37,99,235,0.4)" : "1px solid #E5E7EB",
              background: vista === "resumen" ? "rgba(37,99,235,0.08)" : T.white,
              cursor: "pointer",
              touchAction: "manipulation",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect
                x="4"
                y="13"
                width="3"
                height="8"
                fill={vista === "resumen" ? T.accent : "#0F1729"}
              />
              <rect
                x="10.5"
                y="9"
                width="3"
                height="12"
                fill={vista === "resumen" ? T.accent : "#0F1729"}
              />
              <rect
                x="17"
                y="5"
                width="3"
                height="16"
                fill={vista === "resumen" ? T.accent : "#0F1729"}
              />
            </svg>
          </button>
        </div>
      </div>

      {/* ── VISTA RESUMEN ── */}
      {vista === "resumen" && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
          <Card>
            <SecTit ch="Pipeline de Cobros" />
            {(() => {
              const estadosVis = EST_FAC.filter(
                e => !["Anulada", "Rechazada", "Borrador"].includes(e),
              );
              const totales = estadosVis.map(e =>
                facturas.filter(f => f.estado === e).reduce((a, f) => a + totalDe(f), 0),
              );
              const maxT = Math.max(...totales, 1);
              return estadosVis.map((est, i) => {
                const facs = facturas.filter(f => f.estado === est);
                if (facs.length === 0) return null;
                const total = totales[i];
                const col = EST_FAC_COL[est] || T.muted;
                return (
                  <div key={est} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 5,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: col,
                            display: "inline-block",
                          }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{est}</span>
                        <span style={{ fontSize: 11, color: T.muted }}>
                          {facs.length} comprobantes
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: col,
                          fontFamily: "monospace",
                        }}
                      >
                        {fmt(total)}
                      </span>
                    </div>
                    <div
                      style={{
                        background: T.border,
                        borderRadius: 6,
                        height: 6,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${(total / maxT) * 100}%`,
                          background: col,
                          borderRadius: 6,
                          transition: "width .6s",
                        }}
                      />
                    </div>
                  </div>
                );
              });
            })()}
          </Card>

          <Card>
            <SecTit ch="Top Clientes" />
            {(() => {
              const map = new Map();
              facturas
                .filter(f => f.estado !== "Anulada" && f.estado !== "Rechazada")
                .forEach(f => {
                  const key = f.cliente_id || f.cliente_nombre || "—";
                  const nombre = clienteNombreDe(f);
                  if (!map.has(key)) map.set(key, { nombre, total: 0, cobrado: 0, count: 0 });
                  const e = map.get(key);
                  e.total += totalDe(f);
                  if (f.estado === "Cobrada" || f.estado === "Pagada") e.cobrado += totalDe(f);
                  e.count++;
                });
              const top = Array.from(map.values()).sort((a, b) => b.total - a.total);
              if (top.length === 0)
                return (
                  <div
                    style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: "12px 0" }}
                  >
                    Sin datos para mostrar
                  </div>
                );
              return top.map((c, i) => {
                const pct = c.total > 0 ? Math.round((c.cobrado / c.total) * 100) : 0;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 0",
                      borderBottom: i < top.length - 1 ? `1px solid ${T.border}` : "none",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: T.white,
                          marginBottom: 3,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {c.nombre}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div
                          style={{
                            background: T.border,
                            borderRadius: 4,
                            height: 4,
                            flex: 1,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              background: T.green,
                              borderRadius: 4,
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 11, color: T.muted, flexShrink: 0 }}>
                          {pct}% cobrado
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: T.text,
                          fontFamily: "monospace",
                        }}
                      >
                        {fmt(c.total)}
                      </div>
                      <div style={{ fontSize: 11, color: T.muted }}>{c.count} comp.</div>
                    </div>
                  </div>
                );
              });
            })()}
          </Card>
        </div>
      )}

      {/* ── LISTA ── */}
      {vista === "lista" && (
        <>
          {loading ? (
            <Spinner />
          ) : facsFiltradas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: T.muted }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}></div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: T.text }}>
                {facturas.length === 0 ? "No hay comprobantes aún" : "Sin resultados"}
              </div>
              <div style={{ fontSize: 13 }}>
                {facturas.length === 0
                  ? conectado
                    ? "Tu sistema externo aún no ha emitido comprobantes"
                    : "Aún no hay datos de prueba en Firebase"
                  : "Prueba ajustando los filtros"}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {facsFiltradas.map(f => {
                const cli = clienteNombreDe(f);
                const pan = paneles.find(p => p.id === f.panel_id);
                const estadoCol = EST_FAC_COL[f.estado] || T.muted;
                const isVencida = f.estado === "Vencida";
                const isCobrada = f.estado === "Cobrada" || f.estado === "Pagada";
                const isBorrador = f.estado === "Borrador";
                const isEmitible = isBorrador;
                const isCobrable = ["Emitida", "Aceptada", "Pendiente"].includes(f.estado);
                const total = totalDe(f);
                const fechaCorta = f.fecha_emision
                  ? new Date(f.fecha_emision).toLocaleDateString("es-PE", {
                      day: "numeric",
                      month: "numeric",
                      year: "numeric",
                    })
                  : "";
                return (
                  <div
                    key={f.id}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      background: "linear-gradient(145deg,#0E1835 0%,#0A1228 100%)",
                      border: `1px solid ${isVencida ? "rgba(239,68,68,0.35)" : "rgba(79,124,255,0.14)"}`,
                      borderRadius: 18,
                      padding: "14px 16px",
                      boxShadow:
                        "0 6px 20px rgba(8,12,28,0.4),inset 0 1px 0 rgba(255,255,255,0.04)",
                    }}
                  >
                    <WaveDeco color={isVencida ? T.red : isCobrada ? T.green : T.accent} />
                    <div style={{ position: "relative", zIndex: 2 }}>
                      {/* Top row: icon + serie/chip + total */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          marginBottom: 10,
                        }}
                      >
                        <div
                          onClick={() => setModalDetalle(f)}
                          style={{
                            flexShrink: 0,
                            width: 44,
                            height: 52,
                            borderRadius: 8,
                            background: T.white,
                            border: "1px solid #E5E7EB",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            touchAction: "manipulation",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                          }}
                        >
                          <svg width="26" height="32" viewBox="0 0 24 28" fill="none">
                            <rect
                              x="3"
                              y="2"
                              width="18"
                              height="24"
                              rx="1"
                              fill={T.white}
                              stroke="#0F1729"
                              strokeWidth="1.2"
                            />
                            <text
                              x="5"
                              y="5.5"
                              fontSize="2.2"
                              fontWeight="900"
                              fill="#0F1729"
                              fontFamily="sans-serif"
                            >
                              FACTURA
                            </text>
                            <line
                              x1="5"
                              y1="10"
                              x2="19"
                              y2="10"
                              stroke="#94A3B8"
                              strokeWidth="0.7"
                            />
                            <line
                              x1="5"
                              y1="13"
                              x2="19"
                              y2="13"
                              stroke="#94A3B8"
                              strokeWidth="0.7"
                            />
                            <line
                              x1="5"
                              y1="16"
                              x2="19"
                              y2="16"
                              stroke="#94A3B8"
                              strokeWidth="0.7"
                            />
                            <line
                              x1="5"
                              y1="19"
                              x2="14"
                              y2="19"
                              stroke="#94A3B8"
                              strokeWidth="0.7"
                            />
                            <line
                              x1="5"
                              y1="22"
                              x2="19"
                              y2="22"
                              stroke="#0F1729"
                              strokeWidth="0.9"
                            />
                          </svg>
                        </div>
                        <div
                          onClick={() => setModalDetalle(f)}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            cursor: "pointer",
                            touchAction: "manipulation",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "monospace",
                                fontSize: 16,
                                fontWeight: 900,
                                color: T.white,
                                letterSpacing: "-0.2px",
                              }}
                            >
                              {f.serie}-{numeroFmt(f.numero)}
                            </span>
                            <span
                              style={{
                                background: estadoCol + "26",
                                color: estadoCol,
                                border: `1px solid ${estadoCol}55`,
                                borderRadius: 8,
                                padding: "2px 9px",
                                fontSize: 10.5,
                                fontWeight: 700,
                              }}
                            >
                              {f.estado}
                            </span>
                            <span
                              style={{
                                fontSize: 10.5,
                                color: "#5B7FCC",
                                fontWeight: 700,
                                letterSpacing: 0.6,
                              }}
                            >
                              {f.tipo || "FACTURA"}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              color: T.white,
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              marginBottom: 2,
                            }}
                          >
                            {cli}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "rgba(160,180,220,0.6)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {pan?.nombre || f.concepto || "—"}
                            {fechaCorta ? ` · ${fechaCorta}` : ""}
                          </div>
                        </div>
                        <div
                          onClick={() => setModalDetalle(f)}
                          style={{
                            flexShrink: 0,
                            textAlign: "right",
                            cursor: "pointer",
                            touchAction: "manipulation",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 18,
                              fontWeight: 900,
                              color: isCobrada ? T.green : isVencida ? T.red : T.white,
                              fontFamily: "monospace",
                              letterSpacing: "-0.3px",
                            }}
                          >
                            {fmt(total)}
                          </div>
                        </div>
                      </div>
                      {/* Action buttons */}
                      {(isEmitible || isCobrable || f.pdf_url) && (
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            justifyContent: "flex-end",
                            flexWrap: "wrap",
                          }}
                        >
                          {isEmitible && (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                toast.info(
                                  "Abre tu sistema de facturación, selecciona este borrador y presiona Emitir a SUNAT. El estado se actualizará automáticamente.",
                                );
                              }}
                              style={{
                                background: "rgba(37,99,235,0.12)",
                                border: "1px solid rgba(37,99,235,0.45)",
                                borderRadius: 10,
                                padding: "7px 14px",
                                color: "#5A9BFF",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                                touchAction: "manipulation",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontFamily: "inherit",
                              }}
                            >
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#5A9BFF"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                              </svg>
                              Emitir
                            </button>
                          )}
                          {isCobrable && (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                toast.info(
                                  "Para registrar el cobro, hazlo desde tu sistema de facturación web. Vista360 lo reflejará automáticamente.",
                                );
                              }}
                              style={{
                                background: "rgba(16,185,129,0.12)",
                                border: "1px solid rgba(16,185,129,0.45)",
                                borderRadius: 10,
                                padding: "7px 14px",
                                color: T.green,
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                                touchAction: "manipulation",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontFamily: "inherit",
                              }}
                            >
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke={T.green}
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Cobrar
                            </button>
                          )}
                          {f.pdf_url && (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                window.open(f.pdf_url, "_blank", "noopener,noreferrer");
                              }}
                              style={{
                                background: "linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)",
                                border: "none",
                                borderRadius: 10,
                                padding: "7px 14px",
                                color: T.white,
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                                touchAction: "manipulation",
                                display: "flex",
                                alignItems: "center",
                                gap: 7,
                                fontFamily: "inherit",
                                boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
                              }}
                            >
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                              >
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="12" y1="18" x2="12" y2="12" />
                                <polyline points="9 15 12 18 15 15" />
                              </svg>
                              Ver PDF
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && facsFiltradas.length > 0 && (
            <div
              style={{
                marginTop: 14,
                background: "#EEF2FF",
                border: "1px solid rgba(37,99,235,0.18)",
                borderRadius: 18,
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: "0 2px 8px rgba(37,99,235,0.08)",
              }}
            >
              <span style={{ fontSize: 12, color: "#1E3A8A", fontWeight: 600 }}>
                {facsFiltradas.length} comprobante{facsFiltradas.length > 1 ? "s" : ""} mostrado
                {facsFiltradas.length > 1 ? "s" : ""}
              </span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#1E3A8A",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ color: "#3B6FCC", fontWeight: 600 }}>Total:</span>
                <span style={{ fontFamily: "monospace", letterSpacing: "-0.3px" }}>
                  {fmt(facsFiltradas.reduce((a, f) => a + totalDe(f), 0))}
                </span>
              </span>
            </div>
          )}
        </>
      )}

      {/* Modal de detalle (solo lectura) */}
      {modalDetalle && (
        <ModalDetalleFactura
          factura={modalDetalle}
          paneles={paneles}
          clientes={clientes}
          onClose={() => setModalDetalle(null)}
        />
      )}
    </div>
  );
}

const ICONS = {
  mapa: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  ),
  paneles: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  contratos: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  crm: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  resultados: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  reportes: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  gastos: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  ),
  perfil: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  hoy: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  ranking: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  historico: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 8 12 12 14 14" />
      <path d="M3.05 11a9 9 0 1 1 .5 4" />
      <polyline points="3 16 3 11 8 11" />
    </svg>
  ),
  facturacion: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <line x1="6" y1="15" x2="10" y2="15" />
      <line x1="14" y1="15" x2="18" y2="15" />
    </svg>
  ),
};

// ── Sidebar icon button ──

// ══════════════════════════════════════════════════════════════════
// HOY — Acciones recomendadas del día
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// GENERADOR DE COMPROBANTE PDF — Vista360 Perú
// ══════════════════════════════════════════════════════════════════
function ModalPreFactura({ contrato, panel, cliente, onClose }: ModalPreFacturaProps) {
  const [tipo, setTipo] = useState("FACTURA");
  const [serie, setSerie] = useState("F001");
  const [numero, setNumero] = useState("1");

  const monto = Number(contrato.monto || 0);
  const exonerado = isExoneradoIGV(panel?.ciudad || EMISOR.ciudad);
  const igvRate = exonerado ? 0 : IGV_RATE;
  const subtotal = exonerado ? monto : Math.round((monto / 1.18) * 100) / 100;
  const igv = exonerado ? 0 : Math.round((monto - subtotal) * 100) / 100;
  const hoy = new Date().toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const generarHTML = () => {
    const s = tipo === "FACTURA" ? serie : serie.replace(/^F/, "B");
    const numPad = numero.padStart(8, "0");
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>${tipo} ${s}-${numPad} — 8 Millas</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:A4;margin:14mm 14mm 14mm 14mm}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#111;font-size:13px}
  .doc{background:#fff;max-width:100%;margin:0 auto}
  .header{background:linear-gradient(135deg,#1E3A8A,#2563EB);color:#fff;padding:20px 26px;display:flex;justify-content:space-between;align-items:flex-start;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .logo{font-size:24px;font-weight:900;letter-spacing:-1px}.logo span{color:#93C5FD}
  .logo-img{height:54px;width:auto;object-fit:contain;display:block;margin-bottom:4px}
  .logo-sub{font-size:11px;opacity:.75;margin-top:3px}
  .emisor-data{font-size:11px;opacity:.9;margin-top:10px;line-height:1.7}
  .emisor-data strong{font-size:12px}
  .tipo-doc{text-align:right}
  .tipo-doc .tipo{font-size:18px;font-weight:900}
  .tipo-doc .serie{font-size:14px;font-family:monospace;margin-top:4px;opacity:.9}
  .tipo-doc .fecha{font-size:11px;opacity:.75;margin-top:6px;line-height:1.6}
  .body{padding:18px 26px}
  .section{margin-bottom:16px}
  .section-title{font-size:10px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px;padding-bottom:5px;border-bottom:2px solid #E5E7EB}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .field label{font-size:9px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.8px;display:block;margin-bottom:2px}
  .field .value{font-size:13px;font-weight:600;color:#111827}
  .field .value.mono{font-family:monospace}
  table{width:100%;border-collapse:collapse}
  thead th{background:#1E3A8A;color:#fff;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;text-align:left;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  tbody td{padding:10px;font-size:12px;color:#374151;border-bottom:1px solid #F3F4F6}
  .totales{display:flex;flex-direction:column;align-items:flex-end;gap:4px;margin-top:12px}
  .tot-row{display:flex;gap:32px;font-size:12px;color:#6B7280}
  .tot-row .lbl{min-width:120px;text-align:right}
  .tot-row .val{font-weight:700;color:#374151;min-width:110px;text-align:right;font-family:monospace}
  .total-final{display:flex;gap:14px;background:linear-gradient(135deg,#1E3A8A,#2563EB);color:#fff;border-radius:8px;padding:12px 16px;margin-top:8px;align-items:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .total-final .lbl{font-size:13px;font-weight:700;flex:1}
  .total-final .val{font-size:22px;font-weight:900;font-family:monospace}
  .footer{border-top:2px solid #1E3A8A;padding:10px 26px;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#6B7280;margin-top:10px}
  .footer strong{color:#1E3A8A}
</style>
</head>
<body>
<div class="doc">
  <div class="header">
    <div>
      <img class="logo-img" src="${DRAWER_LOGO_B64}" alt="8 Millas"/>
      <div class="logo-sub">8 MILLAS · Publicidad Exterior</div>
      <div class="emisor-data">
        <strong>RUC: ${EMISOR.ruc}</strong><br/>
        ${EMISOR.razonSocial}<br/>
        ${EMISOR.direccion}<br/>
        Actividad: ${EMISOR.actividad}
 ${exonerado ? `<br/><span style="display:inline-block;margin-top:6px;background:#D1FAE5;color:#065F46;border-radius:4px;padding:2px 8px;font-size:10px;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact"> EXONERADO IGV — LEY AMAZONÍA N° 27037</span>` : ""}
      </div>
    </div>
    <div class="tipo-doc">
      <div class="tipo">${tipo} ELECTRÓNICA</div>
      <div class="serie">${s}-${numPad}</div>
      <div class="fecha">Fecha: ${hoy}</div>
    </div>
  </div>

  <div class="body">
    <div class="section">
 <div class="section-title"> Datos del ${tipo === "FACTURA" ? "Adquirente" : "Receptor"}</div>
      <div class="grid2">
        <div class="field">
          <label>${tipo === "FACTURA" ? "Razón Social" : "Apellidos y Nombres"}</label>
          <div class="value">${cliente.empresa || "—"}</div>
        </div>
        <div class="field">
          <label>${tipo === "FACTURA" ? "RUC" : "DNI / CE"}</label>
          <div class="value mono">${cliente.ruc || cliente.dni || "Sin documento"}</div>
        </div>
        <div class="field"><label>Contacto</label><div class="value">${cliente.contacto || "—"}</div></div>
        <div class="field"><label>Teléfono</label><div class="value mono">${cliente.celular || cliente.telefono || "—"}</div></div>
        <div class="field" style="grid-column:1/-1"><label>Dirección</label><div class="value">${cliente.direccion || "—"}</div></div>
      </div>
    </div>

    <div class="section">
 <div class="section-title"> Detalle del Servicio</div>
      <table>
        <thead><tr><th style="width:40px">Cant.</th><th>Descripción</th><th style="width:110px">Período</th><th style="text-align:right;width:110px">V. Unit. S/IGV</th><th style="text-align:right;width:110px">Total S/IGV</th></tr></thead>
        <tbody>
          <tr>
            <td style="text-align:center;font-weight:700">1</td>
            <td>
              <strong>Arrendamiento de Panel Publicitario</strong><br/>
              <span style="font-size:11px;color:#6B7280">${panel.nombre}${panel.tipo ? " · " + panel.tipo : ""}${panel.ciudad ? " · " + panel.ciudad : ""}</span>
 ${panel.direccion ? `<br/><span style="font-size:10px;color:#9CA3AF"> ${panel.direccion}</span>` : ""}
            </td>
            <td style="font-size:11px;color:#6B7280;white-space:nowrap">${fmtF(contrato.inicio)}<br/>al ${fmtF(contrato.fin)}</td>
            <td style="text-align:right;font-family:monospace;font-weight:600">S/ ${subtotal.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</td>
            <td style="text-align:right;font-family:monospace;font-weight:700">S/ ${subtotal.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>
      <div class="totales">
        <div class="tot-row"><span class="lbl">${exonerado ? "Op. Inafecta" : "Valor Venta (sin IGV)"}</span><span class="val">S/ ${subtotal.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span></div>
        <div class="tot-row"><span class="lbl">${exonerado ? "IGV 0% (Exonerado — Ley Amazonía N° 27037)" : "IGV 18%"}</span><span class="val">S/ ${igv.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span></div>
        ${exonerado ? `<div class="tot-row" style="font-size:10px"><span class="lbl" style="color:#059669">Base legal</span><span style="font-size:10px;color:#059669;min-width:220px;text-align:right">Art. 13° Ley N° 27037 — Zona Amazónica Huánuco</span></div>` : ""}
        <div class="total-final"><span class="lbl">IMPORTE TOTAL A PAGAR</span><span class="val">S/ ${monto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span></div>
      </div>
    </div>
  </div>

  <div class="footer">
    <div><strong>8 Millas</strong> · RUC ${EMISOR.ruc} · ${EMISOR.direccion}</div>
    <div>Emitido: ${new Date().toLocaleString("es-PE")}</div>
  </div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},350);};</script>
</body>
</html>`;
  };

  const descargar = () => {
    const s = tipo === "FACTURA" ? serie : serie.replace(/^F/, "B");
    const titulo = `${tipo}-${s}-${numero.padStart(8, "0")}-${(cliente.empresa || "cliente").replace(/\s+/g, "-")}`;
    const html = generarHTML();
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `${titulo}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const inpStyle = {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: "9px 12px",
    color: T.text,
    fontSize: 13,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.9)",
        zIndex: 500,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#0B1324",
          border: "1px solid #1E3050",
          borderRadius: "22px 22px 0 0",
          width: "100%",
          maxWidth: 560,
          maxHeight: "92vh",
          overflowY: "auto",
          paddingBottom: 32,
        }}
      >
        <div
          style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 6 }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "#2D4060" }} />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 22px 18px",
          }}
        >
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.white }}>
              Generar Comprobante PDF
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
              RUC {EMISOR.ruc} · 8 Millas · Huánuco
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "#1E3050",
              border: "none",
              color: T.muted,
              cursor: "pointer",
              touchAction: "manipulation",
              fontSize: 15,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          ></button>
        </div>

        <div style={{ padding: "0 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.muted,
                textTransform: "uppercase",
                letterSpacing: 1.2,
                marginBottom: 8,
              }}
            >
              Tipo de Comprobante
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["FACTURA", "BOLETA"].map(t => (
                <button
                  key={t}
                  onClick={() => {
                    setTipo(t);
                    setSerie(t === "FACTURA" ? "F001" : "B001");
                  }}
                  style={{
                    flex: 1,
                    padding: "11px",
                    borderRadius: 10,
                    cursor: "pointer",
                    touchAction: "manipulation",
                    border: `1px solid ${tipo === t ? T.accent + "66" : T.border}`,
                    background: tipo === t ? T.accent + "18" : "transparent",
                    color: tipo === t ? T.white : T.muted,
                    fontWeight: 700,
                    fontSize: 13,
                    transition: "background .08s",
                  }}
                >
                  {t === "FACTURA" ? " Factura" : " Boleta"}
                  <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.7 }}>
                    {t === "FACTURA" ? "Con RUC del cliente" : "Con DNI / Consumidor final"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.muted,
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                  marginBottom: 6,
                }}
              >
                Serie
              </div>
              <input
                value={serie}
                onChange={e => setSerie(e.target.value.toUpperCase())}
                style={inpStyle}
                placeholder="F001"
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.muted,
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                  marginBottom: 6,
                }}
              >
                Número
              </div>
              <input
                value={numero}
                onChange={e => setNumero(e.target.value.replace(/\D/g, ""))}
                style={inpStyle}
                placeholder="1"
              />
            </div>
          </div>

          <div
            style={{
              background: T.surface,
              border: `1px solid ${exonerado ? T.green : T.border}`,
              borderRadius: 12,
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.muted,
                textTransform: "uppercase",
                letterSpacing: 1.2,
                marginBottom: 10,
              }}
            >
              Resumen del Comprobante
            </div>
            {exonerado && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                  padding: "6px 10px",
                  background: T.green + "18",
                  borderRadius: 8,
                  border: `1px solid ${T.green}44`,
                }}
              >
                <span style={{ fontSize: 13 }}></span>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.green }}>
                  Exonerado de IGV — Ley Amazonía N° 27037 (Huánuco)
                </span>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { l: "Emisor", v: `${EMISOR.razonSocial} — ${EMISOR.ruc}`, c: T.accent },
                { l: "Cliente", v: cliente.empresa || "—", c: T.white },
                {
                  l: tipo === "FACTURA" ? "RUC" : "DNI",
                  v: cliente.ruc || cliente.dni || "Sin documento",
                  c: cliente.ruc || cliente.dni ? T.text : T.muted,
                },
                { l: "Panel", v: `${panel.nombre} · ${panel.ciudad || ""}`, c: T.text },
                { l: "Período", v: `${fmtF(contrato.inicio)} → ${fmtF(contrato.fin)}`, c: T.muted },
                {
                  l: exonerado ? "Op. Inafecta" : "Valor s/IGV",
                  v: `S/ ${subtotal.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`,
                  c: T.text,
                },
                {
                  l: exonerado ? "IGV (0% — Exonerado)" : "IGV 18%",
                  v: `S/ ${igv.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`,
                  c: exonerado ? T.green : T.text,
                },
                { l: "TOTAL", v: fmt(contrato.monto), c: T.green, bold: true },
              ].map(({ l, v, c, bold }) => (
                <div
                  key={l}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingBottom: 4,
                    borderBottom: `1px solid ${T.border}22`,
                  }}
                >
                  <span style={{ fontSize: 11, color: T.muted }}>{l}</span>
                  <span
                    style={{
                      fontSize: bold ? 14 : 12,
                      fontWeight: bold ? 800 : 600,
                      color: c,
                      fontFamily: bold ? "monospace" : "inherit",
                    }}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={onClose}
              style={{
                padding: "13px 18px",
                background: "transparent",
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                color: T.muted,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                touchAction: "manipulation",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={descargar}
              style={{
                flex: 1,
                padding: "13px 22px",
                background: "linear-gradient(135deg,#1E35C8 0%,#3854EE 100%)",
                border: "none",
                borderRadius: 50,
                color: T.white,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                touchAction: "manipulation",
                boxShadow: "0 4px 22px rgba(30,53,200,0.45), inset 0 1px 0 rgba(255,255,255,0.22)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                minHeight: 46,
                fontFamily: "inherit",
                letterSpacing: "0.01em",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <polyline points="9 15 12 18 15 15" />
              </svg>
              Descargar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MÓDULO PRINCIPAL — REPORTES

// ── Sparkline wave decorativa en cards ───────────────────────
const CardWave = ({ color = "#4F7CFF" }: { color?: string }) => (
  <svg
    width="120"
    height="30"
    viewBox="0 0 120 30"
    style={{ position: "absolute", bottom: 0, right: 0, opacity: 0.18 }}
    preserveAspectRatio="none"
  >
    <polyline
      points="0,25 15,18 30,22 45,10 60,15 75,8 90,14 105,6 120,12"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ── Card mensual con estado expandible (extraído para poder usar useState) ──
function MesCard({
  m,
  anio,
  contratos,
  paneles,
  clientes,
  exportMesPDF,
}: {
  m: {
    mes: string;
    label: string;
    ingPagado: number;
    ingTotal: number;
    gastosMes: number;
    utilidad: number;
    contrActivos: number;
  };
  anio: number;
  contratos: Contrato[];
  paneles: Panel[];
  clientes: Cliente[];
  exportMesPDF: (m: unknown) => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const monthShort = new Date(m.mes + "-02")
    .toLocaleDateString("es-PE", { month: "short" })
    .toUpperCase()
    .replace(".", "");
  const pendiente = m.ingTotal - m.ingPagado;
  const margen =
    m.ingPagado > 0 ? Math.round(((m.ingPagado - m.gastosMes) / m.ingPagado) * 100) : 0;
  const ctrsConDetalle = contratos
    .filter(c => c.inicio && c.fin && c.inicio.slice(0, 7) <= m.mes && c.fin.slice(0, 7) >= m.mes)
    .map(c => ({
      ...c,
      panel: paneles.find(p => p.id === c.panel_id),
      cliente: clientes.find(cl => cl.id === c.cliente_id),
    }))
    .filter(c => c.panel && c.cliente);

  return (
    <div
      id={`mes-${m.mes}`}
      style={{
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(145deg,#0E1835 0%,#0A1228 100%)",
        border: "1px solid rgba(79,124,255,0.14)",
        borderRadius: 18,
        padding: "14px 16px",
        boxShadow: "0 6px 20px rgba(8,12,28,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <CardWave color={T.accent} />
      <div style={{ position: "relative", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          {/* Thumbnail mes */}
          <div
            style={{
              flexShrink: 0,
              width: 50,
              height: 60,
              borderRadius: 8,
              background: T.white,
              border: "1px solid #E5E7EB",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
              lineHeight: 1,
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 800, color: T.accent, letterSpacing: 0.6 }}>
              {anio}
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 900,
                color: T.text,
                marginTop: 3,
                letterSpacing: "-0.5px",
              }}
            >
              {monthShort}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Cabecera */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{ fontSize: 15, fontWeight: 900, color: T.white, letterSpacing: "-0.2px" }}
              >
                {mesLabel(m.mes)}
              </span>
              <span
                style={{
                  background: "rgba(37,99,235,0.18)",
                  color: "#7FAEFF",
                  border: "1px solid rgba(37,99,235,0.4)",
                  borderRadius: 8,
                  padding: "2px 9px",
                  fontSize: 10.5,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                {m.contrActivos} CONTRATO{m.contrActivos !== 1 ? "S" : ""}
              </span>
              {margen > 0 && (
                <span
                  style={{
                    background: margen >= 50 ? "rgba(16,185,129,0.18)" : "rgba(245,158,11,0.18)",
                    color: margen >= 50 ? T.green : T.white,
                    border: `1px solid ${margen >= 50 ? "rgba(16,185,129,0.4)" : "rgba(245,158,11,0.4)"}`,
                    borderRadius: 8,
                    padding: "2px 9px",
                    fontSize: 10.5,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {margen}% margen
                </span>
              )}
              <button
                onClick={() => exportMesPDF(m)}
                style={{
                  marginLeft: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "7px 14px",
                  borderRadius: 50,
                  border: "none",
                  background: "linear-gradient(135deg,#1E35C8 0%,#3854EE 100%)",
                  color: T.white,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  touchAction: "manipulation",
                  fontFamily: "inherit",
                  boxShadow:
                    "0 3px 14px rgba(30,53,200,0.45), inset 0 1px 0 rgba(255,255,255,0.22)",
                  letterSpacing: "0.01em",
                  minHeight: 32,
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <polyline points="9 15 12 18 15 15" />
                </svg>
                PDF
              </button>
            </div>
            {/* 4 columnas */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr",
                gap: 6,
                marginBottom: 10,
              }}
            >
              {[
                { l: "COBRADO", v: fmt(m.ingPagado), c: T.green },
                {
                  l: "PENDIENTE",
                  v: fmt(pendiente),
                  c: pendiente > 0 ? T.white : "rgba(160,180,220,0.4)",
                },
                { l: "GASTOS", v: fmt(m.gastosMes), c: T.red },
                { l: "UTILIDAD", v: fmt(m.utilidad), c: m.utilidad >= 0 ? T.green : T.red },
              ].map(k => (
                <div key={k.l}>
                  <div
                    style={{ fontSize: 8.5, fontWeight: 700, color: "#5B7FCC", letterSpacing: 0.8 }}
                  >
                    {k.l}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 900,
                      color: k.c,
                      fontFamily: "monospace",
                      marginTop: 2,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {k.v}
                  </div>
                </div>
              ))}
            </div>
            {/* Barra cobrado/facturado */}
            {m.ingTotal > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span
                    style={{ fontSize: 9.5, color: "rgba(160,180,220,0.6)", letterSpacing: 0.4 }}
                  >
                    COBRADO / FACTURADO
                  </span>
                  <span style={{ fontSize: 9.5, color: T.white, fontWeight: 700 }}>
                    {Math.round((m.ingPagado / m.ingTotal) * 100)}%
                  </span>
                </div>
                <div
                  style={{
                    height: 4,
                    background: "rgba(255,255,255,0.08)",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 3,
                      width: `${Math.round((m.ingPagado / m.ingTotal) * 100)}%`,
                      background: T.green,
                    }}
                  />
                </div>
              </div>
            )}
            {/* Barra gastos/cobrado */}
            {m.ingPagado > 0 && m.gastosMes > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span
                    style={{ fontSize: 9.5, color: "rgba(160,180,220,0.6)", letterSpacing: 0.4 }}
                  >
                    GASTOS / COBRADO
                  </span>
                  <span style={{ fontSize: 9.5, color: T.white, fontWeight: 700 }}>
                    {Math.min(100, Math.round((m.gastosMes / m.ingPagado) * 100))}%
                  </span>
                </div>
                <div
                  style={{
                    height: 4,
                    background: "rgba(255,255,255,0.08)",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 3,
                      width: `${Math.min(100, Math.round((m.gastosMes / m.ingPagado) * 100))}%`,
                      background: T.white,
                    }}
                  />
                </div>
              </div>
            )}
            {/* Expandir contratos */}
            {ctrsConDetalle.length > 0 && (
              <button
                onClick={() => setExpandido(e => !e)}
                style={{
                  width: "100%",
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(79,124,255,0.08)",
                  border: "1px solid rgba(79,124,255,0.18)",
                  borderRadius: 10,
                  padding: "7px 12px",
                  cursor: "pointer",
                  touchAction: "manipulation",
                  fontFamily: "inherit",
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 600, color: "#7FAEFF" }}>
                  {expandido ? "Ocultar" : "Ver"} contratos del mes ({ctrsConDetalle.length})
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#7FAEFF"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  style={{
                    transform: expandido ? "rotate(180deg)" : "none",
                    transition: "transform .2s",
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            )}
            {/* Lista contratos */}
            {expandido && ctrsConDetalle.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
                {ctrsConDetalle.map(c => (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 9,
                      padding: "8px 11px",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: T.white,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c.cliente?.empresa || "—"}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(160,180,220,0.6)", marginTop: 1 }}>
                        {c.panel?.nombre || "—"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: c.pagado ? T.green : T.white,
                          fontFamily: "monospace",
                        }}
                      >
                        {fmt(c.monto)}
                      </div>
                      <div
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          color: c.pagado ? T.green : T.white,
                          marginTop: 1,
                        }}
                      >
                        {c.pagado ? "Cobrado" : "Pendiente"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Facturacion;
