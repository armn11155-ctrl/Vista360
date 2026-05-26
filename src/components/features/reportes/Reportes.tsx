// @ts-nocheck — legacy file: migrating to strict TypeScript gradually
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
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
                    color: margen >= 50 ? T.green : T.amber,
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
                  c: pendiente > 0 ? T.amber : "rgba(160,180,220,0.4)",
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
                  <span style={{ fontSize: 9.5, color: T.amber, fontWeight: 700 }}>
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
                      background: T.amber,
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
                          color: c.pagado ? T.green : T.amber,
                          fontFamily: "monospace",
                        }}
                      >
                        {fmt(c.monto)}
                      </div>
                      <div
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          color: c.pagado ? T.green : T.amber,
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

// ══════════════════════════════════════════════════════════════════
// RESULTADOS — Estado de Resultados anual (P&L)
// ══════════════════════════════════════════════════════════════════
interface ResultadosProps {
  contratos: Contrato[];
  paneles: Panel[];
  clientes: Cliente[];
  gastos: Gasto[];
  loading: boolean;
}

function Resultados({ contratos, paneles, clientes, gastos, loading }: ResultadosProps) {
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const anos = [anio - 1, anio, anio + 1].filter(a => a <= new Date().getFullYear());

  const meses = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = `${anio}-${String(i + 1).padStart(2, "0")}`;
      const ctrsMes = contratos.filter(
        c => !c.deleted && c.inicio && c.fin && c.inicio.slice(0, 7) <= m && c.fin.slice(0, 7) >= m,
      );
      const ingresos = ctrsMes.filter(c => c.pagado).reduce((a, c) => a + Number(c.monto || 0), 0);
      const porCobrar = ctrsMes
        .filter(c => !c.pagado)
        .reduce((a, c) => a + Number(c.monto || 0), 0);
      const egresos = gastos
        .filter(g => (g.fecha || "").startsWith(m))
        .reduce((a, g) => a + Number(g.monto || 0), 0);
      return {
        label: new Date(m + "-02").toLocaleDateString("es-PE", { month: "short" }).toUpperCase(),
        ingresos,
        porCobrar,
        egresos,
        utilidad: ingresos - egresos,
      };
    });
  }, [contratos, gastos, anio]);

  const totales = useMemo(
    () => ({
      ingresos: meses.reduce((a, m) => a + m.ingresos, 0),
      porCobrar: meses.reduce((a, m) => a + m.porCobrar, 0),
      egresos: meses.reduce((a, m) => a + m.egresos, 0),
      utilidad: meses.reduce((a, m) => a + m.utilidad, 0),
    }),
    [meses],
  );

  const DARK = "#0E1A3B";
  const col = (v: number) => (v >= 0 ? T.green : T.red);

  if (loading)
    return <div style={{ padding: 24, color: T.muted, textAlign: "center" }}>Cargando…</div>;

  return (
    <div style={{ padding: "0 0 32px" }}>
      {/* Selector de año */}
      {/* Filtros de fecha */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255,255,255,0.45)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Año
          </span>
          <input
            type="number"
            value={anio}
            min={2000}
            max={2100}
            onChange={e => {
              const v = parseInt(e.target.value);
              if (!isNaN(v) && v >= 2000 && v <= 2100) setAnio(v);
            }}
            style={{
              width: 86,
              padding: "5px 10px",
              borderRadius: 10,
              border: "1.5px solid rgba(79,124,255,0.4)",
              background: "rgba(30,52,200,0.18)",
              color: "#93C5FD",
              fontWeight: 800,
              fontSize: 14,
              textAlign: "center" as const,
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          {[new Date().getFullYear() - 1, new Date().getFullYear()].map(a => (
            <button
              key={a}
              onClick={() => setAnio(a)}
              style={{
                padding: "5px 14px",
                borderRadius: 20,
                border: "none",
                background: a === anio ? T.accent : "rgba(255,255,255,0.08)",
                color: a === anio ? "#fff" : "rgba(255,255,255,0.55)",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {a}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255,255,255,0.45)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Período
          </span>
          <input
            type="month"
            value={mesFilter}
            onChange={e => {
              setMesFilter(e.target.value);
              setFechaDesde("");
              setFechaHasta("");
            }}
            title="Mes específico"
            style={{
              padding: "5px 10px",
              borderRadius: 10,
              border: "1.5px solid rgba(79,124,255,0.3)",
              background: "rgba(255,255,255,0.07)",
              color: mesFilter ? "#93C5FD" : "rgba(255,255,255,0.35)",
              fontSize: 12,
              outline: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>o rango</span>
          <input
            type="date"
            value={fechaDesde}
            onChange={e => {
              setFechaDesde(e.target.value);
              setMesFilter("");
            }}
            title="Desde"
            style={{
              padding: "5px 10px",
              borderRadius: 10,
              border: "1.5px solid rgba(79,124,255,0.3)",
              background: "rgba(255,255,255,0.07)",
              color: fechaDesde ? "#93C5FD" : "rgba(255,255,255,0.35)",
              fontSize: 12,
              outline: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          />
          <input
            type="date"
            value={fechaHasta}
            onChange={e => {
              setFechaHasta(e.target.value);
              setMesFilter("");
            }}
            title="Hasta"
            style={{
              padding: "5px 10px",
              borderRadius: 10,
              border: "1.5px solid rgba(79,124,255,0.3)",
              background: "rgba(255,255,255,0.07)",
              color: fechaHasta ? "#93C5FD" : "rgba(255,255,255,0.35)",
              fontSize: 12,
              outline: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          />
          {tieneFiltroDeFecha && (
            <button
              onClick={() => {
                setMesFilter("");
                setFechaDesde("");
                setFechaHasta("");
              }}
              style={{
                padding: "5px 14px",
                borderRadius: 20,
                border: "1px solid rgba(239,68,68,0.4)",
                background: "rgba(239,68,68,0.12)",
                color: "#FCA5A5",
                fontWeight: 700,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Limpiar ×
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Ingresos cobrados", val: totales.ingresos, color: T.green },
          { label: "Por cobrar", val: totales.porCobrar, color: T.amber },
          { label: "Egresos", val: totales.egresos, color: T.red },
          { label: "Utilidad neta", val: totales.utilidad, color: col(totales.utilidad) },
        ].map(({ label, val, color }) => (
          <div
            key={label}
            style={{
              background: DARK,
              border: "1px solid rgba(79,124,255,0.15)",
              borderRadius: 16,
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.5)",
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              {label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color }}>{fmt(val)}</div>
          </div>
        ))}
      </div>

      {/* Tabla mensual */}
      <div
        style={{
          background: DARK,
          border: "1px solid rgba(79,124,255,0.15)",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 2fr 2fr 2fr 2fr",
            padding: "10px 14px",
            background: "rgba(255,255,255,0.04)",
            fontSize: 10,
            fontWeight: 700,
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <span>Mes</span>
          <span style={{ textAlign: "right" }}>Ingresado</span>
          <span style={{ textAlign: "right" }}>Por cobrar</span>
          <span style={{ textAlign: "right" }}>Egreso</span>
          <span style={{ textAlign: "right" }}>Utilidad</span>
        </div>
        {meses.map((m, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 2fr 2fr 2fr 2fr",
              padding: "10px 14px",
              borderTop: "1px solid rgba(255,255,255,0.04)",
              fontSize: 12,
              alignItems: "center",
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{m.label}</span>
            <span style={{ textAlign: "right", color: T.green, fontWeight: 600 }}>
              {fmt(m.ingresos)}
            </span>
            <span style={{ textAlign: "right", color: T.amber }}>{fmt(m.porCobrar)}</span>
            <span style={{ textAlign: "right", color: T.red }}>{fmt(m.egresos)}</span>
            <span style={{ textAlign: "right", color: col(m.utilidad), fontWeight: 700 }}>
              {fmt(m.utilidad)}
            </span>
          </div>
        ))}
        {/* Total row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 2fr 2fr 2fr 2fr",
            padding: "12px 14px",
            borderTop: "1px solid rgba(255,255,255,0.12)",
            fontSize: 12,
            fontWeight: 800,
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <span style={{ color: "#fff" }}>TOTAL</span>
          <span style={{ textAlign: "right", color: T.green }}>{fmt(totales.ingresos)}</span>
          <span style={{ textAlign: "right", color: T.amber }}>{fmt(totales.porCobrar)}</span>
          <span style={{ textAlign: "right", color: T.red }}>{fmt(totales.egresos)}</span>
          <span style={{ textAlign: "right", color: col(totales.utilidad) }}>
            {fmt(totales.utilidad)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Reportes({ contratos, paneles, clientes, gastos, initialSeccion }: ReportesProps) {
  const [seccion, setSeccion] = useState(initialSeccion || "resumen");
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [modalFactura, setModalFactura] = useState<Factura | null>(null);
  const [mesFilter, setMesFilter] = useState<string>(""); // "YYYY-MM" o ""
  const [fechaDesde, setFechaDesde] = useState<string>(""); // "YYYY-MM-DD"
  const [fechaHasta, setFechaHasta] = useState<string>(""); // "YYYY-MM-DD"
  const tieneFiltroDeFecha = mesFilter || fechaDesde || fechaHasta;

  // ── Datos por año ─────────────────────────────────────────────
  const mesesAnio = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = `${anio}-${String(i + 1).padStart(2, "0")}`;
      const ctrsMes = contratos.filter(
        c => c.inicio && c.fin && c.inicio.slice(0, 7) <= m && c.fin.slice(0, 7) >= m,
      );
      const ingPagado = ctrsMes.filter(c => c.pagado).reduce((a, c) => a + Number(c.monto || 0), 0);
      const ingTotal = ctrsMes.reduce((a, c) => a + Number(c.monto || 0), 0);
      const gastosMes = gastos
        .filter(g => g.fecha?.startsWith(m))
        .reduce((a, g) => a + Number(g.monto || 0), 0);
      const utilidad = ingPagado - gastosMes;
      const contrActivos = ctrsMes.length;
      return {
        mes: m,
        label: new Date(m + "-02").toLocaleDateString("es-PE", { month: "short" }).toUpperCase(),
        ingPagado,
        ingTotal,
        gastosMes,
        utilidad,
        contrActivos,
      };
    });
  }, [contratos, gastos, anio]);

  // Meses filtrados según selección de fecha
  const mesesFiltrados = useMemo(() => {
    if (!tieneFiltroDeFecha) return mesesAnio;
    return mesesAnio.filter(m => {
      if (mesFilter && m.mes !== mesFilter) return false;
      if (fechaDesde && m.mes < fechaDesde.slice(0, 7)) return false;
      if (fechaHasta && m.mes > fechaHasta.slice(0, 7)) return false;
      return true;
    });
  }, [mesesAnio, mesFilter, fechaDesde, fechaHasta, tieneFiltroDeFecha]);

  // Contratos y gastos filtrados por rango de fecha
  const contratosFiltrados = useMemo(() => {
    if (!tieneFiltroDeFecha) return contratos;
    return contratos.filter(c => {
      if (mesFilter) return c.inicio?.slice(0, 7) <= mesFilter && c.fin?.slice(0, 7) >= mesFilter;
      if (fechaDesde && c.fin && c.fin < fechaDesde) return false;
      if (fechaHasta && c.inicio && c.inicio > fechaHasta) return false;
      return true;
    });
  }, [contratos, mesFilter, fechaDesde, fechaHasta, tieneFiltroDeFecha]);

  const gastosFiltrados = useMemo(() => {
    if (!tieneFiltroDeFecha) return gastos;
    return gastos.filter(g => {
      if (mesFilter) return g.fecha?.startsWith(mesFilter);
      if (fechaDesde && g.fecha && g.fecha < fechaDesde) return false;
      if (fechaHasta && g.fecha && g.fecha > fechaHasta) return false;
      return true;
    });
  }, [gastos, mesFilter, fechaDesde, fechaHasta, tieneFiltroDeFecha]);

  const maxIngreso = Math.max(...mesesAnio.map(m => m.ingTotal), 1);

  const kpis = useMemo(() => {
    const totalIngPagado = mesesFiltrados.reduce((a, m) => a + m.ingPagado, 0);
    const totalIngTotal = mesesFiltrados.reduce((a, m) => a + m.ingTotal, 0);
    const totalGastos = mesesFiltrados.reduce((a, m) => a + m.gastosMes, 0);
    const totalUtilidad = totalIngPagado - totalGastos;
    const pendiente = totalIngTotal - totalIngPagado;
    const mesTop = [...mesesFiltrados].sort((a, b) => b.ingPagado - a.ingPagado)[0];
    return { totalIngPagado, totalIngTotal, totalGastos, totalUtilidad, pendiente, mesTop };
  }, [mesesAnio]);

  const rentPaneles = useMemo(() => {
    return paneles
      .map(p => {
        const ctrs = contratos.filter(c => c.panel_id === p.id);
        const ingreso = ctrs.filter(c => c.pagado).reduce((a, c) => a + Number(c.monto || 0), 0);
        const pendiente = ctrs.filter(c => !c.pagado).reduce((a, c) => a + Number(c.monto || 0), 0);
        const gastP = gastos
          .filter(g => g.panel_id === p.id)
          .reduce((a, g) => a + Number(g.monto || 0), 0);
        const utilidad = ingreso - gastP;
        const ocupPct = (() => {
          const hoyD = new Date();
          let activo = 0,
            total = 0;
          ctrs.forEach(c => {
            if (!c.inicio || !c.fin) return;
            const ini = new Date(c.inicio),
              fin = new Date(c.fin);
            if (fin < ini) return;
            total += Math.ceil((Math.min(fin, hoyD) - ini) / 86400000);
            if (ini <= hoyD) activo += Math.ceil((Math.min(fin, hoyD) - ini) / 86400000);
          });
          return total > 0 ? Math.round((activo / total) * 100) : 0;
        })();
        return { ...p, ingreso, pendiente, gastP, utilidad, numCtrs: ctrs.length, ocupPct };
      })
      .sort((a, b) => b.ingreso - a.ingreso);
  }, [paneles, contratos, gastos]);

  const contratosFact = useMemo(() => {
    return contratos
      .map(c => ({
        ...c,
        panel: paneles.find(p => p.id === c.panel_id),
        cliente: clientes.find(cl => cl.id === c.cliente_id),
      }))
      .filter(c => c.panel && c.cliente)
      .sort((a, b) => new Date(b.inicio || 0) - new Date(a.inicio || 0));
  }, [contratos, paneles, clientes]);

  const secciones = [
    { id: "resumen", label: "Estado de Resultados" },
    { id: "mensual", label: "Por Mes" },
  ];

  // ── Colores dark (inline con C) ──────────────────────────────
  const D = {
    bg: "linear-gradient(145deg,rgba(14,24,42,0.97) 0%,rgba(8,14,26,0.99) 100%)",
    border: "rgba(79,124,255,0.15)",
    text: T.white,
    muted: "#8892A4",
    green: T.green,
    amber: T.amber,
    red: T.red,
    accent: "#4F7CFF",
    surface: "rgba(255,255,255,0.05)",
  };

  const cardStyle = {
    background: T.bg,
    border: `1px solid ${T.border}`,
    borderRadius: 20,
    padding: "20px 18px",
    boxShadow: "0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
    position: "relative",
    overflow: "hidden",
  };

  // ── EXPORT PDF RESUMEN ────────────────────────────────────────
  const exportResumenPDF = () => {
    const DARK = "#0D1B3E";
    const BLUE = "#1A3066";
    const ACC = "#1E4D9B";
    const LB = "#D6E4F7";
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Reporte Anual ${anio}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:14mm}
body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#fff;color:#1a1a1a;font-size:12.5px}
.header{background:linear-gradient(135deg,${DARK} 0%,${BLUE} 60%,${ACC} 100%);color:#fff;padding:22px 28px;display:flex;justify-content:space-between;align-items:flex-start;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.h-left .ruc{font-size:11px;opacity:.75;margin-top:4px;letter-spacing:.5px}
.h-left .empresa{font-size:20px;font-weight:900;letter-spacing:.5px}
.h-left .logo-img{height:56px;width:auto;object-fit:contain;margin-bottom:6px;display:block}
.h-right{text-align:right}
.h-right .titulo{font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:.8px}
.h-right .anio{font-size:28px;font-weight:900;color:#93C5FD;font-family:'Courier New',monospace}
.h-right .fecha{font-size:10px;opacity:.7;margin-top:4px}
.divider{height:4px;background:linear-gradient(90deg,${ACC},${DARK},${ACC});-webkit-print-color-adjust:exact;print-color-adjust:exact}
.body{padding:18px 28px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.kpi{background:${LB};border-radius:8px;padding:14px 12px;text-align:center;border-left:4px solid ${ACC};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.kpi .ic{font-size:22px;margin-bottom:4px}
.kpi .lb{font-size:9px;font-weight:700;color:${ACC};text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px}
.kpi .vl{font-size:14px;font-weight:900;color:#0f172a}
.kpi .sl{font-size:9px;color:#64748B;margin-top:2px}
.section-title{font-size:9.5px;font-weight:700;color:${ACC};text-transform:uppercase;letter-spacing:1.8px;margin-bottom:10px;padding-bottom:5px;border-bottom:2px solid ${ACC};-webkit-print-color-adjust:exact;print-color-adjust:exact}
table{width:100%;border-collapse:collapse;border:1px solid #CBD5E1;margin-bottom:20px}
thead th{background:${DARK};color:#fff;padding:9px 11px;font-size:9.5px;font-weight:700;text-transform:uppercase;text-align:left;letter-spacing:.5px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
tbody tr:nth-child(even){background:#F8FAFC}
tbody td{padding:9px 11px;font-size:11px;color:#1e293b;border-bottom:1px solid #E2E8F0}
.num{text-align:right;font-family:'Courier New',monospace}
.pos{color:#065F46;font-weight:700} .neg{color:#991B1B;font-weight:700}
.best-mes{background:linear-gradient(135deg,${DARK},${ACC});color:#fff;border-radius:8px;padding:14px 18px;display:flex;align-items:center;gap:14px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.best-mes .ic{font-size:32px}
.best-mes .lb{font-size:10px;opacity:.75;text-transform:uppercase;letter-spacing:.8px}
.best-mes .nm{font-size:16px;font-weight:800}
.best-mes .vl{font-size:22px;font-weight:900;color:#FCD34D;font-family:'Courier New',monospace}
.footer{border-top:2px solid ${DARK};padding:10px 28px;display:flex;justify-content:space-between;font-size:9px;color:#64748B;margin-top:16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>
<div class="header">
  <div class="h-left">
    <img class="logo-img" src="${DRAWER_LOGO_B64}" alt="8 Millas"/>
    <div class="ruc">RUC: ${EMISOR.ruc} · ${EMISOR.ciudad}</div>
    <div class="ruc">${EMISOR.actividad}</div>
  </div>
  <div class="h-right">
    <div class="titulo">Reporte Anual</div>
    <div class="anio">${anio}</div>
    <div class="fecha">Generado: ${new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}</div>
  </div>
</div>
<div class="divider"></div>
<div class="body">
  <div class="kpis">
    <div class="kpi"><div class="lb">Ingresos Cobrados</div><div class="vl" style="color:#065F46">${fmt(kpis.totalIngPagado)}</div><div class="sl">Contratos pagados</div></div>
    <div class="kpi"><div class="lb">Por Cobrar</div><div class="vl" style="color:#92400E">${fmt(kpis.pendiente)}</div><div class="sl">Pendientes</div></div>
    <div class="kpi"><div class="lb">Gastos Totales</div><div class="vl" style="color:#991B1B">${fmt(kpis.totalGastos)}</div><div class="sl">Todos los gastos</div></div>
    <div class="kpi"><div class="lb">Utilidad Neta</div><div class="vl" style="color:${kpis.totalUtilidad >= 0 ? "#065F46" : "#991B1B"}">${fmt(kpis.totalUtilidad)}</div><div class="sl">Cobrado − Gastos</div></div>
  </div>

  <div class="section-title">Detalle Mensual ${anio}</div>
  <table>
    <thead><tr><th>Mes</th><th>Contratos</th><th class="num">Cobrado</th><th class="num">Gastos</th><th class="num">Utilidad</th><th class="num">% Cobrado</th></tr></thead>
    <tbody>
      ${mesesAnio
        .map(
          m => `<tr>
        <td><strong>${mesLabel(m.mes)}</strong></td>
        <td style="text-align:center">${m.contrActivos}</td>
        <td class="num pos">${fmt(m.ingPagado)}</td>
        <td class="num neg">${fmt(m.gastosMes)}</td>
        <td class="num ${m.utilidad >= 0 ? "pos" : "neg"}">${fmt(m.utilidad)}</td>
        <td class="num">${m.ingTotal > 0 ? Math.round((m.ingPagado / m.ingTotal) * 100) : 0}%</td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>

  ${
    kpis.mesTop && kpis.mesTop.ingPagado > 0
      ? `
  <div class="section-title">Mejor Mes del Año</div>
  <div class="best-mes">
    <div>
      <div class="lb">Mejor rendimiento en ${anio}</div>
      <div class="nm">${mesLabel(kpis.mesTop.mes)}</div>
      <div class="vl">${fmt(kpis.mesTop.ingPagado)}</div>
      <div style="font-size:10px;opacity:.75;margin-top:3px">${kpis.mesTop.contrActivos} contrato(s) activos</div>
    </div>
  </div>`
      : ""
  }
</div>
<div class="footer">
  <span>8 MILLAS · RUC ${EMISOR.ruc} · ${EMISOR.ciudad}</span>
  <span>Reporte Anual ${anio} — Sistema Vista360</span>
  <span>Generado ${new Date().toLocaleDateString("es-PE")}</span>
</div>
<script>window.onload=function(){setTimeout(function(){window.print()},350)}</script>
</body></html>`;
    const w = window.open("", "_blank", "width=900,height=700");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  // ── EXPORT PDF ANUAL MENSUAL (todos los meses del año) ────────
  const exportAnualMensualPDF = () => {
    const DARK = "#0D1B3E";
    const BLUE = "#1A3066";
    const ACC = "#1E4D9B";
    const LB = "#D6E4F7";

    // Construir detalle de contratos por mes
    const mesesConDetalle = mesesAnio.map(m => {
      const ctrsDelMes = contratos
        .map(c => ({
          ...c,
          panel: paneles.find(p => p.id === c.panel_id),
          cliente: clientes.find(cl => cl.id === c.cliente_id),
        }))
        .filter(
          c =>
            c.panel &&
            c.cliente &&
            c.inicio &&
            c.fin &&
            c.inicio.slice(0, 7) <= m.mes &&
            c.fin.slice(0, 7) >= m.mes,
        );
      const gastosDelMes = gastos.filter(g => g.fecha?.startsWith(m.mes));
      return { ...m, ctrsDelMes, gastosDelMes };
    });

    const totalIng = kpis.totalIngPagado;
    const totalGast = kpis.totalGastos;
    const totalUtil = kpis.totalUtilidad;
    const mesTopLabel = kpis.mesTop?.ingPagado > 0 ? mesLabel(kpis.mesTop.mes) : "—";
    const mesTopVal = kpis.mesTop?.ingPagado > 0 ? fmt(kpis.mesTop.ingPagado) : "—";

    const filasMeses = mesesAnio
      .map(m => {
        const pct = m.ingTotal > 0 ? Math.round((m.ingPagado / m.ingTotal) * 100) : 0;
        return `<tr>
        <td><strong>${mesLabel(m.mes)}</strong></td>
        <td style="text-align:center">${m.contrActivos}</td>
        <td class="num pos">${fmt(m.ingPagado)}</td>
        <td class="num" style="color:#92400E">${fmt(m.ingTotal - m.ingPagado)}</td>
        <td class="num neg">${fmt(m.gastosMes)}</td>
        <td class="num ${m.utilidad >= 0 ? "pos" : "neg"}">${fmt(m.utilidad)}</td>
        <td class="num">${pct}%</td>
      </tr>`;
      })
      .join("");

    // Detalle expandido por mes (solo los que tienen datos)
    const detalleMeses = mesesConDetalle
      .filter(m => m.ingPagado > 0 || m.gastosMes > 0)
      .map(m => {
        const filasCtrs =
          m.ctrsDelMes.length > 0
            ? m.ctrsDelMes
                .map(
                  c => `<tr>
              <td>${c.cliente?.empresa || c.cliente?.nombre || "—"}</td>
              <td>${c.panel?.nombre || "—"}</td>
              <td>${fmtF(c.inicio)} → ${fmtF(c.fin)}</td>
              <td class="num">${fmt(c.monto)}</td>
              <td class="num ${c.pagado ? "pag" : "pend"}">${c.pagado ? "Pagado" : "Pendiente"}</td>
            </tr>`,
                )
                .join("")
            : `<tr><td colspan="5" style="text-align:center;color:#94A3B8;font-style:italic">Sin contratos activos este mes</td></tr>`;

        const filasGastos =
          m.gastosDelMes.length > 0
            ? m.gastosDelMes
                .map(
                  g => `<tr>
              <td>${g.descripcion || "—"}</td>
              <td>${g.categoria || "—"}</td>
              <td>${fmtF(g.fecha)}</td>
              <td class="num neg">${fmt(g.monto)}</td>
            </tr>`,
                )
                .join("")
            : `<tr><td colspan="4" style="text-align:center;color:#94A3B8;font-style:italic">Sin gastos registrados</td></tr>`;

        return `
          <div class="mes-block">
            <div class="mes-header">
              <div class="mes-cal">
                <div class="mes-anio">${anio}</div>
                <div class="mes-nombre">${new Date(m.mes + "-02").toLocaleDateString("es-PE", { month: "short" }).toUpperCase().replace(".", "")}</div>
              </div>
              <div class="mes-info">
                <div class="mes-titulo">${mesLabel(m.mes)}</div>
                <div class="mes-kpis">
                  <span class="mk pos">Ing: ${fmt(m.ingPagado)}</span>
                  <span class="mk neg">Gas: ${fmt(m.gastosMes)}</span>
                  <span class="mk ${m.utilidad >= 0 ? "pos" : "neg"}">Util: ${fmt(m.utilidad)}</span>
                </div>
              </div>
            </div>
            <div class="sec">Contratos activos · ${m.contrActivos}</div>
            <table>
              <thead><tr><th>Cliente</th><th>Panel</th><th>Período</th><th class="num">Monto</th><th class="num">Estado</th></tr></thead>
              <tbody>${filasCtrs}</tbody>
            </table>
            <div class="sec">Gastos del mes · ${m.gastosDelMes.length} registro(s)</div>
            <table>
              <thead><tr><th>Descripción</th><th>Categoría</th><th>Fecha</th><th class="num">Monto</th></tr></thead>
              <tbody>${filasGastos}</tbody>
            </table>
          </div>`;
      })
      .join("");

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Reporte Anual Detallado ${anio} — 8 Millas</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:13mm}
body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#fff;color:#1a1a1a;font-size:11.5px}
.header{background:linear-gradient(135deg,${DARK} 0%,${BLUE} 60%,${ACC} 100%);color:#fff;padding:20px 28px;display:flex;justify-content:space-between;align-items:flex-start;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.h-left .logo-img{height:52px;width:auto;object-fit:contain;margin-bottom:5px;display:block}
.h-left .ruc{font-size:10px;opacity:.75;margin-top:3px;letter-spacing:.3px}
.h-right{text-align:right}
.h-right .titulo{font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:.6px}
.h-right .subtitulo{font-size:11px;opacity:.8;margin-top:3px}
.h-right .anio{font-size:32px;font-weight:900;color:#93C5FD;font-family:'Courier New',monospace;line-height:1}
.divider{height:5px;background:linear-gradient(90deg,${ACC},#3B82F6,${ACC});-webkit-print-color-adjust:exact;print-color-adjust:exact}
.body{padding:16px 28px}
/* KPI resumen */
.kpis-wrap{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
.kpi{background:${LB};border-radius:8px;padding:13px 11px;text-align:center;border-left:4px solid ${ACC};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.kpi .ic{font-size:20px;margin-bottom:3px}
.kpi .lb{font-size:8.5px;font-weight:700;color:${ACC};text-transform:uppercase;letter-spacing:.7px;margin-bottom:3px}
.kpi .vl{font-size:14px;font-weight:900}
.kpi .sl{font-size:8.5px;color:#64748B;margin-top:2px}
/* Tabla resumen */
.section-title{font-size:9px;font-weight:700;color:${ACC};text-transform:uppercase;letter-spacing:1.8px;margin-bottom:8px;padding-bottom:4px;border-bottom:2px solid ${ACC};-webkit-print-color-adjust:exact;print-color-adjust:exact;margin-top:14px}
table{width:100%;border-collapse:collapse;border:1px solid #CBD5E1;margin-bottom:12px;font-size:10.5px}
thead th{background:${DARK};color:#fff;padding:8px 10px;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;text-align:left;-webkit-print-color-adjust:exact;print-color-adjust:exact}
tbody tr:nth-child(even){background:#F8FAFC}
tbody td{padding:7px 10px;color:#1e293b;border-bottom:1px solid #E2E8F0}
.num{text-align:right;font-family:'Courier New',monospace}
.pos{color:#065F46;font-weight:700} .neg{color:#991B1B;font-weight:700} .pag{color:#065F46;font-weight:700} .pend{color:#92400E}
/* Bloque best mes */
.best{background:linear-gradient(135deg,${DARK},${ACC});color:#fff;border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:14px;margin-bottom:14px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.best .ic{font-size:28px}
.best .lb{font-size:9px;opacity:.75;text-transform:uppercase;letter-spacing:.7px}
.best .nm{font-size:14px;font-weight:800}
.best .vl{font-size:20px;font-weight:900;color:#FCD34D;font-family:'Courier New',monospace}
/* Bloques por mes */
.mes-block{border:1px solid #CBD5E1;border-radius:8px;margin-bottom:16px;overflow:hidden;page-break-inside:avoid}
.mes-header{background:${DARK};color:#fff;padding:11px 14px;display:flex;align-items:center;gap:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.mes-cal{width:44px;height:52px;background:#fff;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0}
.mes-anio{font-size:8px;font-weight:800;color:${ACC};letter-spacing:.4px}
.mes-nombre{font-size:15px;font-weight:900;color:#0F1729;margin-top:2px}
.mes-info{flex:1}
.mes-titulo{font-size:14px;font-weight:800;letter-spacing:-.2px}
.mes-kpis{display:flex;gap:12px;margin-top:5px;flex-wrap:wrap}
.mk{font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px;background:rgba(255,255,255,0.12)}
.sec{font-size:8.5px;font-weight:700;color:${ACC};text-transform:uppercase;letter-spacing:1.4px;padding:8px 14px 5px;border-bottom:1px solid #E5E7EB;background:#F8FAFC;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.mes-block table{border:none;margin-bottom:0}
.mes-block thead th{font-size:8px;padding:6px 10px}
.mes-block tbody td{font-size:10px;padding:6px 10px}
/* Footer */
.footer{border-top:2px solid ${DARK};padding:9px 28px;display:flex;justify-content:space-between;font-size:8.5px;color:#64748B;margin-top:14px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>
<div class="header">
  <div class="h-left">
    <img class="logo-img" src="${DRAWER_LOGO_B64}" alt="8 Millas"/>
    <div class="ruc">RUC: ${EMISOR.ruc} · ${EMISOR.direccion}</div>
    <div class="ruc">${EMISOR.actividad}</div>
  </div>
  <div class="h-right">
    <div class="titulo">Reporte Anual Detallado</div>
    <div class="subtitulo">Ingresos · Gastos · Utilidad por mes</div>
    <div class="anio">${anio}</div>
    <div class="ruc" style="color:rgba(255,255,255,0.65);margin-top:4px">Generado: ${new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}</div>
  </div>
</div>
<div class="divider"></div>
<div class="body">

  <div class="section-title">Resumen del año ${anio}</div>
  <div class="kpis-wrap">
    <div class="kpi"><div class="lb">Total Cobrado</div><div class="vl" style="color:#065F46">${fmt(totalIng)}</div><div class="sl">Contratos pagados</div></div>
    <div class="kpi"><div class="lb">Por Cobrar</div><div class="vl" style="color:#92400E">${fmt(kpis.pendiente)}</div><div class="sl">Pendientes</div></div>
    <div class="kpi"><div class="lb">Total Gastos</div><div class="vl" style="color:#991B1B">${fmt(totalGast)}</div><div class="sl">Todos los gastos</div></div>
    <div class="kpi"><div class="lb">Utilidad Neta</div><div class="vl" style="color:${totalUtil >= 0 ? "#065F46" : "#991B1B"}">${fmt(totalUtil)}</div><div class="sl">Cobrado − Gastos</div></div>
  </div>

  ${
    kpis.mesTop?.ingPagado > 0
      ? `
  <div class="best">
    <div>
      <div class="lb">Mejor mes del año</div>
      <div class="nm">${mesTopLabel}</div>
      <div class="vl">${mesTopVal}</div>
    </div>
  </div>`
      : ""
  }

  <div class="section-title">Cuadro consolidado por mes</div>
  <table>
    <thead>
      <tr><th>Mes</th><th style="text-align:center">Contratos</th><th class="num">Cobrado</th><th class="num">Pendiente</th><th class="num">Gastos</th><th class="num">Utilidad</th><th class="num">% Cobro</th></tr>
    </thead>
    <tbody>
      ${filasMeses}
      <tr style="background:#F1F5F9">
        <td><strong>TOTAL ${anio}</strong></td>
        <td style="text-align:center"></td>
        <td class="num pos"><strong>${fmt(totalIng)}</strong></td>
        <td class="num" style="color:#92400E"><strong>${fmt(kpis.pendiente)}</strong></td>
        <td class="num neg"><strong>${fmt(totalGast)}</strong></td>
        <td class="num ${totalUtil >= 0 ? "pos" : "neg"}"><strong>${fmt(totalUtil)}</strong></td>
        <td class="num"></td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">Detalle expandido por mes</div>
  ${detalleMeses || `<p style="color:#94A3B8;font-style:italic;text-align:center;padding:20px">No hay datos registrados para ${anio}</p>`}

</div>
<div class="footer">
  <span>8 MILLAS · RUC ${EMISOR.ruc} · ${EMISOR.ciudad}</span>
  <span>Reporte Anual Detallado ${anio} — Vista360</span>
  <span>Generado ${new Date().toLocaleDateString("es-PE")}</span>
</div>
<script>window.onload=function(){setTimeout(function(){window.print()},400)}</script>
</body></html>`;

    const w = window.open("", "_blank", "width=960,height=750");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  // ── EXPORT PDF MES ────────────────────────────────────────────
  const exportMesPDF = m => {
    const DARK = "#0D1B3E";
    const BLUE = "#1A3066";
    const ACC = "#1E4D9B";
    const LB = "#D6E4F7";
    const ctrsDelMes = contratos
      .map(c => ({
        ...c,
        panel: paneles.find(p => p.id === c.panel_id),
        cliente: clientes.find(cl => cl.id === c.cliente_id),
      }))
      .filter(
        c =>
          c.panel &&
          c.cliente &&
          c.inicio &&
          c.fin &&
          c.inicio.slice(0, 7) <= m.mes &&
          c.fin.slice(0, 7) >= m.mes,
      );
    const gastosDelMes = gastos.filter(g => g.fecha?.startsWith(m.mes));

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Reporte ${mesLabel(m.mes)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:14mm}
body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#fff;color:#1a1a1a;font-size:12px}
.header{background:linear-gradient(135deg,${DARK} 0%,${BLUE} 60%,${ACC} 100%);color:#fff;padding:20px 28px;display:flex;justify-content:space-between;align-items:flex-start;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.h-left .empresa{font-size:18px;font-weight:900} .h-left .ruc{font-size:10px;opacity:.75;margin-top:3px} .h-left .logo-img{height:48px;width:auto;object-fit:contain;margin-bottom:5px;display:block}
.h-right{text-align:right} .h-right .mes-titulo{font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:.5px} .h-right .anio{font-size:12px;opacity:.75;margin-top:3px}
.divider{height:4px;background:linear-gradient(90deg,${ACC},${DARK},${ACC});-webkit-print-color-adjust:exact;print-color-adjust:exact}
.body{padding:16px 28px}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px}
.kpi{background:${LB};border-radius:8px;padding:13px 11px;text-align:center;border-left:4px solid ${ACC};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.kpi .lb{font-size:8.5px;font-weight:700;color:${ACC};text-transform:uppercase;letter-spacing:.7px;margin-bottom:3px}
.kpi .vl{font-size:16px;font-weight:900}
.sec{font-size:9.5px;font-weight:700;color:${ACC};text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;padding-bottom:5px;border-bottom:2px solid ${ACC};margin-top:16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
table{width:100%;border-collapse:collapse;border:1px solid #CBD5E1;margin-bottom:14px}
thead th{background:${DARK};color:#fff;padding:8px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
tbody tr:nth-child(even){background:#F8FAFC}
tbody td{padding:8px 10px;font-size:11px;color:#1e293b;border-bottom:1px solid #E2E8F0}
.num{text-align:right;font-family:'Courier New',monospace}
.pag{color:#065F46;font-weight:700} .pend{color:#92400E} .neg{color:#991B1B}
.bar-wrap{background:#E5E7EB;border-radius:4px;height:8px;overflow:hidden;margin-top:4px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bar-fill{height:100%;border-radius:4px;background:${DARK};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.footer{border-top:2px solid ${DARK};padding:10px 28px;display:flex;justify-content:space-between;font-size:9px;color:#64748B;margin-top:14px}
</style></head><body>
<div class="header">
  <div class="h-left">
    <img class="logo-img" src="${DRAWER_LOGO_B64}" alt="8 Millas"/>
    <div class="ruc">RUC: ${EMISOR.ruc} · ${EMISOR.ciudad}</div>
  </div>
  <div class="h-right">
    <div class="mes-titulo">${mesLabel(m.mes)}</div>
    <div class="anio">Reporte Mensual · ${new Date().toLocaleDateString("es-PE")}</div>
  </div>
</div>
<div class="divider"></div>
<div class="body">
  <div class="kpis">
    <div class="kpi"><div class="lb">Cobrado</div><div class="vl" style="color:#065F46">${fmt(m.ingPagado)}</div></div>
    <div class="kpi"><div class="lb">Gastos</div><div class="vl" style="color:#991B1B">${fmt(m.gastosMes)}</div></div>
    <div class="kpi"><div class="lb">Utilidad Neta</div><div class="vl" style="color:${m.utilidad >= 0 ? "#065F46" : "#991B1B"}">${fmt(m.utilidad)}</div></div>
  </div>
  ${m.ingTotal > 0 ? `<div style="margin-bottom:16px;font-size:11px;color:#475569">Cobrado vs Total Facturado: <strong>${Math.round((m.ingPagado / m.ingTotal) * 100)}%</strong> (${fmt(m.ingPagado)} de ${fmt(m.ingTotal)})<div class="bar-wrap"><div class="bar-fill" style="width:${Math.round((m.ingPagado / m.ingTotal) * 100)}%"></div></div></div>` : ""}

  ${
    ctrsDelMes.length > 0
      ? `
  <div class="sec">Contratos del mes (${ctrsDelMes.length})</div>
  <table>
    <thead><tr><th>Cliente</th><th>Panel</th><th>Estado</th><th class="num">Monto/mes</th><th>Período</th></tr></thead>
    <tbody>
      ${ctrsDelMes
        .map(
          c => `<tr>
        <td><strong>${c.cliente?.empresa || "—"}</strong>${c.cliente?.ruc ? `<br/><span style="font-size:9px;color:#64748B">RUC: ${c.cliente.ruc}</span>` : ""}</td>
        <td>${c.panel?.nombre || "—"}</td>
        <td class="${c.pagado ? "pag" : "pend"}">${c.pagado ? "Pagado" : "Pendiente"}</td>
        <td class="num">${fmt(c.monto)}</td>
        <td style="font-size:10px;color:#64748B">${fmtF(c.inicio)}<br/>${fmtF(c.fin)}</td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>`
      : "<div style='color:#64748B;font-style:italic;margin-bottom:14px'>Sin contratos en este mes.</div>"
  }

  ${
    gastosDelMes.length > 0
      ? `
  <div class="sec">Gastos del mes (${gastosDelMes.length})</div>
  <table>
    <thead><tr><th>Descripción</th><th>Categoría</th><th class="num">Monto</th><th>Fecha</th></tr></thead>
    <tbody>
      ${gastosDelMes
        .map(
          g => `<tr>
        <td>${g.descripcion || "—"}</td>
        <td>${g.categoria || "—"}</td>
        <td class="num neg">${fmt(g.monto)}</td>
        <td style="font-size:10px;color:#64748B">${fmtF(g.fecha)}</td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>`
      : ""
  }
</div>
<div class="footer">
  <span>8 MILLAS · RUC ${EMISOR.ruc}</span>
  <span>Reporte: ${mesLabel(m.mes)}</span>
  <span>Sistema Vista360</span>
</div>
<script>window.onload=function(){setTimeout(function(){window.print()},350)}</script>
</body></html>`;
    const w = window.open("", "_blank", "width=900,height=700");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  return (
    <div style={{ color: T.text }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          background: "linear-gradient(135deg,#0F1729 0%,#1E3A8A 100%)",
          borderRadius: 18,
          padding: "16px 20px",
          marginBottom: 20,
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
            flexShrink: 0,
            position: "relative",
            zIndex: 1,
            background: "rgba(255,255,255,0.14)",
            border: "1px solid rgba(255,255,255,0.22)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        </div>
        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-0.3px",
              lineHeight: 1.2,
            }}
          >
            Reportes & Facturación
          </div>
          <div
            style={{ fontSize: 12, color: "rgba(180,200,255,0.7)", marginTop: 3, fontWeight: 500 }}
          >
            Análisis financiero · RUC {EMISOR.ruc}
          </div>
        </div>
      </div>

      {/* Tabs — 2 botones, fondo blanco */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 22 }}>
        {secciones.map(s => {
          const active = seccion === s.id;
          const iconMap = {
            resumen: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            ),
            mensual: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            ),
          };
          return (
            <button
              key={s.id}
              onClick={() => setSeccion(s.id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "14px 10px",
                borderRadius: 16,
                border: "none",
                cursor: "pointer",
                touchAction: "manipulation",
                background: active ? "linear-gradient(135deg,#0F1729,#1E3A8A)" : "#fff",
                color: active ? "#fff" : "#0F172A",
                fontWeight: 700,
                fontSize: 13,
                boxShadow: active
                  ? "0 6px 20px rgba(15,23,41,0.35)"
                  : "0 1px 6px rgba(15,23,41,0.12)",
                border: active ? "none" : "1.5px solid #CBD5E1",
                fontFamily: "inherit",
                transition: "all .15s",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: active ? "rgba(255,255,255,0.15)" : "#DBEAFE",
                  color: active ? "#fff" : "#1D4ED8",
                }}
              >
                {iconMap[s.id]}
              </div>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ════════ RESUMEN = ESTADO DE RESULTADOS ════════ */}
      {seccion === "resumen" && (
        <div>
          <Resultados
            contratos={contratos}
            paneles={paneles}
            clientes={clientes}
            gastos={gastos}
            loading={false}
          />
        </div>
      )}

      {/* ════════ POR MES ════════ */}
      {seccion === "mensual" && (
        <div>
          {/* ── Barra de año con logo 8 Millas ── */}
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              background: "linear-gradient(145deg,#0E1835 0%,#0A1228 100%)",
              border: "1px solid rgba(79,124,255,0.18)",
              borderRadius: 18,
              padding: "14px 18px",
              marginBottom: 12,
              boxShadow: "0 6px 20px rgba(8,12,28,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <CardWave color={T.accent} />
            <div
              style={{
                position: "relative",
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{ fontSize: 10, fontWeight: 800, color: "#5B7FCC", letterSpacing: 1.4 }}
                >
                  DETALLE MENSUAL
                </div>
                <div style={{ fontSize: 13, color: "rgba(160,180,220,0.7)", marginTop: 2 }}>
                  {mesesAnio.filter(m => m.ingPagado > 0 || m.gastosMes > 0).length} mes(es) con
                  datos
                </div>
              </div>
            </div>
            <div
              style={{
                position: "relative",
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <button
                onClick={() => setAnio(a => a - 1)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#fff",
                  cursor: "pointer",
                  touchAction: "manipulation",
                  fontSize: 16,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ‹
              </button>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#fff",
                  fontFamily: "monospace",
                  letterSpacing: "-0.5px",
                  minWidth: 60,
                  textAlign: "center",
                }}
              >
                {anio}
              </div>
              <button
                onClick={() => setAnio(a => a + 1)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#fff",
                  cursor: "pointer",
                  touchAction: "manipulation",
                  fontSize: 16,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ›
              </button>
            </div>
          </div>

          {/* ── Selector rápido de meses ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6,1fr)",
              gap: 5,
              marginBottom: 14,
            }}
          >
            {mesesAnio.map((m, idx) => {
              const tieneData = m.ingPagado > 0 || m.gastosMes > 0;
              const mShort = new Date(m.mes + "-02")
                .toLocaleDateString("es-PE", { month: "short" })
                .toUpperCase()
                .replace(".", "");
              const hoyM = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
              const esHoy = m.mes === hoyM;
              return (
                <a
                  key={m.mes}
                  href={`#mes-${m.mes}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "7px 4px",
                    borderRadius: 10,
                    textDecoration: "none",
                    cursor: "pointer",
                    touchAction: "manipulation",
                    background: esHoy
                      ? "linear-gradient(135deg,rgba(16,185,129,0.28),rgba(5,150,105,0.18))"
                      : tieneData
                        ? "rgba(79,124,255,0.1)"
                        : "rgba(255,255,255,0.03)",
                    border: esHoy
                      ? "1px solid rgba(16,185,129,0.45)"
                      : tieneData
                        ? "1px solid rgba(79,124,255,0.2)"
                        : "1px solid rgba(255,255,255,0.05)",
                    transition: "background .08s",
                  }}
                >
                  <div
                    style={{ fontSize: 9.5, fontWeight: 800, color: "#FFFFFF", letterSpacing: 0.4 }}
                  >
                    {mShort}
                  </div>
                  {tieneData && (
                    <div
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: m.utilidad >= 0 ? T.green : T.red,
                        marginTop: 3,
                      }}
                    />
                  )}
                </a>
              );
            })}
          </div>

          {/* ── Botón exportar PDF anual ── */}
          <button
            onClick={exportAnualMensualPDF}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "13px 24px",
              borderRadius: 50,
              marginBottom: 14,
              cursor: "pointer",
              touchAction: "manipulation",
              background: "linear-gradient(135deg,#1E35C8 0%,#3854EE 100%)",
              border: "none",
              color: T.white,
              fontWeight: 700,
              fontSize: 14,
              fontFamily: "inherit",
              boxShadow: "0 4px 22px rgba(30,53,200,0.45), inset 0 1px 0 rgba(255,255,255,0.22)",
              letterSpacing: "0.01em",
              minHeight: 48,
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
            Generar PDF Anual {anio} — Detalle completo por mes
          </button>

          {/* ── Cards mensuales estilo factura ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {mesesAnio.map(m => (
              <MesCard
                key={m.mes}
                m={m}
                anio={anio}
                contratos={contratos}
                paneles={paneles}
                clientes={clientes}
                exportMesPDF={exportMesPDF}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modal comprobante */}
      {modalFactura && (
        <ModalPreFactura
          contrato={modalFactura.contrato}
          panel={modalFactura.panel}
          cliente={modalFactura.cliente}
          onClose={() => setModalFactura(null)}
        />
      )}
    </div>
  );
}

// ── Sidebar icon button ──

// ══════════════════════════════════════════════════════════════════
// APP ROOT
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// NUEVA PALETA — Light theme (reemplaza la oscura de arriba)
// Se declara como NL (New Light) para no colisionar con C original
// ══════════════════════════════════════════════════════════════════
// WAVE — mini sparkline decorativa
// ══════════════════════════════════════════════════════════════════

export default Reportes;
