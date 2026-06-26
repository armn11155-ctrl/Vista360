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
import { useIsDesktop } from "../../../hooks/useIsDesktop";

// ══════════════════════════════════════════════════════════════════
// Estilos de hover — solo aplican en escritorio (clases v360-*-d)
// ══════════════════════════════════════════════════════════════════
const DESKTOP_HOVER_CSS = `
  .v360-metric-d {
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  }
  .v360-metric-d:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 32px -12px rgba(16,22,40,0.22);
    border-color: rgba(37,99,235,0.25);
  }
  .v360-panel-d {
    transition: border-color 0.18s ease;
  }
  .v360-panel-d:hover {
    border-color: rgba(255,255,255,0.16);
  }
  .v360-link-d:hover { color: #8FB8FF !important; }
  .v360-cta-d:hover { background: #1D4FD8 !important; }
  .v360-pill-d:hover { border-color: rgba(255,255,255,0.5) !important; }
`;

function Wave({
  color = T.accent,
  data = [3, 4, 3, 5, 4, 6, 5, 7, 6, 8, 7, 9],
}: {
  color?: string;
  data?: number[];
}) {
  const w = 120,
    h = 30,
    pad = 2;
  const max = Math.max(...data),
    min = Math.min(...data);
  const span = Math.max(0.0001, max - min);
  const pts = data.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (data.length - 1);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y];
  });
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const dArea = d + ` L ${pts[pts.length - 1][0]} ${h} L ${pts[0][0]} ${h} Z`;
  const gid = "sp-" + color.replace("#", "");
  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={dArea} fill={`url(#${gid})`} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════
// HERO CARD — dark con ola azul
// ══════════════════════════════════════════════════════════════════
function HeroCard({
  panalesLibres,
  contratos = [],
  setTab = () => {},
  userName = "",
  isDesktop = false,
}: HeroCardProps) {
  const [visible, setVisible] = React.useState(false);
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";
  const fechaHoy = new Date().toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const fechaCap = fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1);
  const fmt = n =>
    `S/ ${Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  // Reemplaza solo dígitos con • manteniendo separadores (comas, puntos)
  const mask = (s: string) => s.replace(/\d/g, "•");

  // bar chart: últimos 6 meses
  const d = new Date();
  const meses6 = [];
  for (let i = 5; i >= 0; i--) {
    const dd = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const k = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}`;
    const lbl = dd.toLocaleDateString("es-PE", { month: "short" }).replace(".", "");
    const tot = contratos
      .filter(c => c.inicio?.slice(0, 7) <= k && c.fin?.slice(0, 7) >= k)
      .reduce((a, c) => a + Number(c.monto || 0), 0);
    meses6.push({ k, lbl: lbl.charAt(0).toUpperCase() + lbl.slice(1), v: tot });
  }
  const maxV = Math.max(1, ...meses6.map(m => m.v));
  const ingActual = meses6[meses6.length - 1].v;
  const ingPrev = meses6[meses6.length - 2].v;
  const delta = ingActual - ingPrev;
  const deltaPct = ingPrev > 0 ? (delta / ingPrev) * 100 : 0;
  const positive = delta >= 0;

  // ════════════════════════════════════════════════════════════
  // HERO — VERSIÓN ESCRITORIO (layout propio, no es el mobile estirado)
  // ════════════════════════════════════════════════════════════
  if (isDesktop) {
    return (
      <div
        style={{
          position: "relative",
          margin: "0 0 24px",
          padding: "30px 36px 34px",
          borderRadius: 24,
          overflow: "hidden",
          background: "linear-gradient(135deg, #0E1A3B 0%, #142657 55%, #1A2E6E 100%)",
          color: "#fff",
        }}
      >
        <div
          aria-hidden
          style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", borderRadius: 24 }}
        >
          <div
            style={{
              position: "absolute",
              bottom: -160,
              right: -120,
              width: 460,
              height: 460,
              borderRadius: "50%",
              background: "radial-gradient(closest-side, rgba(60,130,255,0.26), rgba(60,130,255,0))",
              filter: "blur(6px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: -140,
              left: "30%",
              width: 320,
              height: 320,
              borderRadius: "50%",
              background: "radial-gradient(closest-side, rgba(80,140,255,0.12), rgba(0,0,0,0))",
            }}
          />
        </div>

        {/* header: saludo + título */}
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 13, color: "rgba(200,212,240,0.72)", fontWeight: 500 }}>
            {saludo}
            {userName ? ", " + userName.split(" ")[0] : ""}
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              marginTop: 4,
            }}
          >
            Resumen
          </div>
          <div style={{ fontSize: 13, color: "rgba(200,212,240,0.5)", marginTop: 4 }}>{fechaCap}</div>
        </div>

        {/* fila: panel de ingreso (ancho fijo) + gráfico (ancho flexible) */}
        <div style={{ position: "relative", marginTop: 28, display: "flex", alignItems: "stretch", gap: 24 }}>
          <div
            className="v360-panel-d"
            style={{
              flex: "0 0 320px",
              background: "linear-gradient(160deg, rgba(28,44,90,0.95) 0%, rgba(14,24,58,0.98) 100%)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 20,
              padding: "22px 24px 22px",
              display: "flex",
              flexDirection: "column",
              boxShadow:
                "0 20px 40px -12px rgba(0,0,0,0.55), 0 2px 0 rgba(255,255,255,0.06) inset, 0 -1px 0 rgba(0,0,0,0.3) inset",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "rgba(200,212,240,0.66)", fontWeight: 500 }}>
                Ingreso del mes
              </span>
              <button
                className="v360-pill-d"
                onClick={() => setVisible(v => !v)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: "transparent",
                  border: `1px solid ${visible ? "#5BD39A" : "#BDD2FF"}`,
                  color: visible ? "#5BD39A" : "#BDD2FF",
                  borderRadius: 999,
                  padding: "4px 9px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {visible ? "Ocultar" : "Mostrar"}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  {visible ? (
                    <g>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </g>
                  ) : (
                    <g>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </g>
                  )}
                </svg>
              </button>
            </div>

            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, marginTop: 14, position: "relative", display: "inline-block" }}>
              <span style={{ color: visible ? "#fff" : "transparent", userSelect: visible ? "auto" : "none" }}>
                {fmt(ingActual)}
              </span>
              {!visible && (
                <span aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-between", color: "#fff", fontSize: "0.55em", pointerEvents: "none" }}>
                  {"S/\u00a0" + "\u25CF".repeat(Math.max(4, fmt(ingActual).replace("S/ ", "").replace(/\D/g, "").length + 1))}
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: positive ? "#5BD39A" : "#FF7A8A",
                  background: positive ? "rgba(91,211,154,0.12)" : "rgba(255,122,138,0.12)",
                  border: `1px solid ${positive ? "rgba(91,211,154,0.25)" : "rgba(255,122,138,0.25)"}`,
                  padding: "3px 8px",
                  borderRadius: 999,
                  position: "relative",
                }}
              >
                <span style={{ color: visible ? "inherit" : "transparent", userSelect: visible ? "auto" : "none" }}>
                  {positive ? "+" : "-"}{fmt(Math.abs(delta))}
                </span>
                {!visible && (
                  <span aria-hidden="true" style={{ position: "absolute", inset: "0 8px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.7em", pointerEvents: "none" }}>
                    {"\u25CF".repeat(Math.max(4, fmt(Math.abs(delta)).replace(/\D/g, "").length + 2))}
                  </span>
                )}
              </span>
              <span style={{ fontSize: 11, color: "rgba(200,212,240,0.55)" }}>vs mes anterior</span>
            </div>

            <div style={{ flex: 1 }} />

            <button
              className="v360-pill-d"
              onClick={() => setTab("contratos")}
              style={{
                marginTop: 16,
                alignSelf: "flex-start",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.28)",
                color: "#fff",
                borderRadius: 999,
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Ver contratos
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </button>
          </div>

          {/* gráfico de 6 meses — usa todo el ancho disponible */}
          <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 13, color: "rgba(200,212,240,0.66)", fontWeight: 500, marginBottom: 18 }}>
              Ingresos · últimos 6 meses
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, minHeight: 140 }}>
              {meses6.map((m, i) => {
                const isHi = i >= meses6.length - 3;
                const h = (m.v / maxV) * 100;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <div
                      style={{
                        width: "56%",
                        height: `${Math.max(h, 6)}%`,
                        minHeight: 5,
                        borderRadius: 6,
                        background: isHi
                          ? "linear-gradient(180deg,#4A8CFF 0%,#1D6BFF 100%)"
                          : "rgba(255,255,255,0.08)",
                        boxShadow: isHi ? "0 0 16px rgba(29,107,255,0.4)" : "none",
                      }}
                    />
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: isHi ? "rgba(189,210,255,0.95)" : "rgba(200,212,240,0.45)",
                        letterSpacing: 0.5,
                        textTransform: "uppercase",
                      }}
                    >
                      {m.lbl}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        margin: "-20px -20px 22px",
        padding: "10px 28px 32px",
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        overflow: "hidden",
        background: "linear-gradient(180deg, #0E1A3B 0%, #0E1A3B 35%, #152458 75%, #1A2E6E 100%)",
        color: "#fff",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: -120,
            right: -100,
            width: 380,
            height: 380,
            borderRadius: "50%",
            background: "radial-gradient(closest-side, rgba(60,130,255,0.28), rgba(60,130,255,0))",
            filter: "blur(6px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -80,
            left: -120,
            width: 280,
            height: 280,
            borderRadius: "50%",
            background: "radial-gradient(closest-side, rgba(80,140,255,0.16), rgba(0,0,0,0))",
          }}
        />
      </div>

      {/* header */}
      <div style={{ position: "relative", marginTop: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "rgba(200,212,240,0.72)", fontWeight: 500 }}>
            {saludo}
            {userName ? ", " + userName.split(" ")[0] : ""}
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              marginTop: 2,
            }}
          >
            Resumen
          </div>
          <div style={{ fontSize: 11, color: "rgba(200,212,240,0.5)", marginTop: 3 }}>
            {fechaCap}
          </div>
        </div>
      </div>

      {/* hero card */}
      <div
        style={{
          position: "relative",
          marginTop: 20,
          background: "linear-gradient(160deg, rgba(28,44,90,0.95) 0%, rgba(14,24,58,0.98) 100%)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 28,
          padding: "18px 18px 20px",
          display: "flex",
          alignItems: "stretch",
          gap: 14,
          boxShadow:
            "0 20px 40px -12px rgba(0,0,0,0.7), 0 2px 0 rgba(255,255,255,0.06) inset, 0 -1px 0 rgba(0,0,0,0.3) inset",
        }}
      >
        <div style={{ flex: "1 1 56%", minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 12, color: "rgba(200,212,240,0.66)", fontWeight: 500 }}>
            Ingreso del mes
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 4,
              marginTop: 6,
            }}
          >
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1,
                position: "relative",
                display: "inline-block",
              }}
            >
              <span style={{ color: visible ? "#fff" : "transparent", userSelect: visible ? "auto" : "none" }}>
                {fmt(ingActual)}
              </span>
              {!visible && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    color: "#fff",
                    fontSize: "0.55em",
                    pointerEvents: "none",
                  }}
                >
                  {"S/\u00a0" + "\u25CF".repeat(Math.max(4, fmt(ingActual).replace("S/ ", "").replace(/\D/g, "").length + 1))}
                </span>
              )}
            </div>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              position: "relative",
              display: "inline-block",
            }}>
              <span style={{ color: visible ? (positive ? "#5BD39A" : "#FF7A8A") : "transparent", userSelect: visible ? "auto" : "none" }}>
                {positive ? "+" : ""}{deltaPct.toFixed(1)}%
              </span>
              {!visible && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    color: positive ? "#5BD39A" : "#FF7A8A",
                    fontSize: "0.7em",
                    pointerEvents: "none",
                  }}
                >
                  {"\u25CF".repeat(Math.max(3, `${positive ? "+" : ""}${deltaPct.toFixed(1)}%`.replace(/\D/g, "").length + 2))}
                </span>
              )}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 5,
              marginTop: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: positive ? "#5BD39A" : "#FF7A8A",
                background: positive ? "rgba(91,211,154,0.12)" : "rgba(255,122,138,0.12)",
                border: `1px solid ${positive ? "rgba(91,211,154,0.25)" : "rgba(255,122,138,0.25)"}`,
                padding: "3px 8px",
                borderRadius: 999,
                position: "relative",
                display: "inline-block",
              }}
            >
              <span style={{ color: visible ? "inherit" : "transparent", userSelect: visible ? "auto" : "none" }}>
                {positive ? "+" : "-"}{fmt(Math.abs(delta))}
              </span>
              {!visible && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: "0 8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "0.7em",
                    pointerEvents: "none",
                  }}
                >
                  {"\u25CF".repeat(Math.max(4, fmt(Math.abs(delta)).replace(/\D/g, "").length + 2))}
                </span>
              )}
            </span>
            <span style={{ fontSize: 11, color: "rgba(200,212,240,0.55)" }}>vs mes anterior</span>
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setTab("contratos")}
            style={{
              marginTop: 14,
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.28)",
              color: "#fff",
              borderRadius: 999,
              padding: "7px 12px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              touchAction: "manipulation",
            }}
          >
            Ver contratos
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </button>
        </div>

        <div style={{ flex: "1 1 44%", minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => setVisible(v => !v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "transparent",
                border: `1px solid ${visible ? "#5BD39A" : "#BDD2FF"}`,
                color: visible ? "#5BD39A" : "#BDD2FF",
                borderRadius: 999,
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                touchAction: "manipulation",
              }}
            >
              {visible ? "Ocultar" : "Mostrar"}
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {visible ? (
                  <g>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </g>
                ) : (
                  <g>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </g>
                )}
              </svg>
            </button>
          </div>
          <div
            style={{
              flex: 1,
              marginTop: 10,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 5,
              height: 90,
            }}
          >
            {meses6.map((m, i) => {
              const isHi = i >= meses6.length - 3;
              const h = (m.v / maxV) * 100;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 5,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: "68%",
                      height: `${Math.max(h, 6)}%`,
                      minHeight: 5,
                      borderRadius: 4,
                      background: isHi
                        ? "linear-gradient(180deg,#4A8CFF 0%,#1D6BFF 100%)"
                        : "rgba(255,255,255,0.08)",
                      boxShadow: isHi ? "0 0 14px rgba(29,107,255,0.45)" : "none",
                    }}
                  />
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      color: isHi ? "rgba(189,210,255,0.95)" : "rgba(200,212,240,0.45)",
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                    }}
                  >
                    {m.lbl}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// METRIC CARD
// ══════════════════════════════════════════════════════════════════
function MetricCardNL({ icon, label, value, sub, waveColor, valueColor, isDesktop = false }: MetricCardNLProps) {
  return (
    <div
      className={isDesktop ? "v360-metric-d" : undefined}
      style={{
        background: T.white,
        borderRadius: isDesktop ? 18 : 18,
        padding: isDesktop ? "20px 20px 18px" : "14px 12px 12px",
        minWidth: 0,
        border: `1px solid ${T.border}`,
        boxShadow: "0 1px 0 rgba(16,22,40,0.02), 0 6px 24px -16px rgba(16,22,40,0.18)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          width: isDesktop ? 42 : 38,
          height: isDesktop ? 42 : 38,
          borderRadius: isDesktop ? 13 : 11,
          background: "linear-gradient(180deg, #0E1A3B 0%, #15265A 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: isDesktop ? 16 : 12,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 12, color: isDesktop ? T.muted : T.text, fontWeight: 600, marginBottom: isDesktop ? 6 : 4, textTransform: isDesktop ? "uppercase" : "none", letterSpacing: isDesktop ? 0.4 : 0 }}>{label}</div>
      <div
        style={{
          fontSize: isDesktop ? 28 : 26,
          fontWeight: 800,
          color: valueColor || T.text,
          lineHeight: 1,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.35, minHeight: isDesktop ? 18 : 28 }}>
        {sub}
      </div>
      <div style={{ marginTop: isDesktop ? 10 : 4, marginLeft: -2, marginRight: -2 }}>
        <Wave color={waveColor || T.accent} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ACCIONES RECOMENDADAS
// ══════════════════════════════════════════════════════════════════
function AccionesCard({ panalesLibres, setTab, isDesktop = false }: AccionesCardProps) {
  if (panalesLibres === 0) return null;
  return (
    <div
      className={isDesktop ? "v360-panel-d" : undefined}
      style={{
        background: "#0D1020",
        borderRadius: 20,
        padding: isDesktop ? "22px 22px" : 18,
        marginBottom: isDesktop ? 0 : 20,
        border: isDesktop ? "1px solid rgba(255,255,255,0.06)" : "none",
        height: isDesktop ? "100%" : "auto",
        display: isDesktop ? "flex" : "block",
        flexDirection: isDesktop ? "column" : undefined,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#60A5FA",
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          Acciones recomendadas
        </span>
        <button className={isDesktop ? "v360-glass-btn v360-link-d" : "v360-glass-btn"}
          style={{
            background: "none",
            border: "none",
            color: "#60A5FA",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            touchAction: "manipulation",
          }}
        >
          Ver todas ›
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: isDesktop ? "wrap" : "nowrap", flex: isDesktop ? 1 : undefined }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            background: "rgba(37,99,235,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
            <path
              d="M17 21V19C17 17.343 15.657 16 14 16H10C8.343 16 7 17.343 7 19V21M12 13C14.209 13 16 11.209 16 9C16 6.791 14.209 5 12 5C9.791 5 8 6.791 8 9C8 11.209 9.791 13 12 13Z"
              stroke="#60A5FA"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
              Asignar panel a cliente
            </span>
            <span
              style={{
                background: "rgba(29,107,255,0.18)",
                color: "#7FAEFF",
                border: "1px solid rgba(127,174,255,0.35)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.6,
                padding: "2px 7px",
                borderRadius: 6,
              }}
            >
              ALTA
            </span>
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
            Tienes {panalesLibres} paneles listos para asignar.
          </div>
        </div>
        <button className={isDesktop ? "v360-glass-btn v360-cta-d" : "v360-glass-btn"}
          onClick={() => setTab("paneles")}
          style={{
            background: T.accent,
            border: "none",
            borderRadius: 50,
            padding: "9px 16px",
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            touchAction: "manipulation",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Asignar ahora ›
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// RESUMEN HOY — nuevo diseño con datos reales
// ══════════════════════════════════════════════════════════════════
function ResumenNuevo({
  clientes,
  contratos,
  paneles,
  gastos,
  setTab,
  userName = "",
}: ResumenNuevoProps) {
  const isDesktop = useIsDesktop();
  const hoyStr = new Date().toISOString().slice(0, 10);
  const ocupadosHoy = new Set(
    contratos
      .filter(c => !c.deleted && c.inicio && c.fin && c.inicio <= hoyStr && c.fin >= hoyStr)
      .map(c => c.panel_id),
  );
  const panalesLibres = paneles.filter(
    p => !ocupadosHoy.has(p.id) && p.estado !== "Inactivo",
  ).length;
  const mesActual = (() => {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
  })();
  // Ingreso cobrado este mes (pagosMeses[mes] === true)
  const ingreso = contratos
    .filter(c => {
      if (!c.inicio || !c.fin || c.deleted) return false;
      const ini = c.inicio.slice(0, 7);
      const fin = c.fin.slice(0, 7);
      return ini <= mesActual && fin >= mesActual && c.pagosMeses?.[mesActual] === true;
    })
    .reduce((s, c) => s + Number(c.monto || 0), 0);
  // Por cobrar: contratos activos este mes aún sin pago marcado
  const porcobrar = contratos
    .filter(c => {
      if (!c.inicio || !c.fin || c.deleted) return false;
      const ini = c.inicio.slice(0, 7);
      const fin = c.fin.slice(0, 7);
      return ini <= mesActual && fin >= mesActual && !c.pagosMeses?.[mesActual];
    })
    .reduce((s, c) => s + Number(c.monto || 0), 0);
  const vencenProx = contratos.filter(c => {
    if (!c.fin) return false;
    const d = Math.ceil((new Date(c.fin).getTime() - Date.now()) / 86400000);
    return d >= 0 && d <= 30;
  }).length;
  const fmtS = (n: number | null | undefined) =>
    `$${Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 0 })}`;

  const iDollar = (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 2V22M17 5H9.5C8.12 5 7 6.12 7 7.5S8.12 10 9.5 10h5C15.88 10 17 11.12 17 12.5S15.88 15 14.5 15H7"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
  const iPanels = (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="white" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="white" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="white" strokeWidth="2" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="white" strokeWidth="2" />
    </svg>
  );
  const iClock = (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" />
      <path d="M12 7V12L15 15" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
  const iCal = (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="white" strokeWidth="2" />
      <path d="M3 9H21M8 2V6M16 2V6" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  return (
    <div style={{ paddingBottom: 32, maxWidth: isDesktop ? 1180 : undefined, margin: isDesktop ? "0 auto" : undefined }}>
      {isDesktop && <style>{DESKTOP_HOVER_CSS}</style>}
      <HeroCard
        panalesLibres={panalesLibres}
        contratos={contratos}
        setTab={setTab}
        userName={userName}
        isDesktop={isDesktop}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "1fr 1fr",
          gap: isDesktop ? 18 : 10,
          marginBottom: isDesktop ? 24 : 20,
        }}
      >
        <MetricCardNL
          icon={iDollar}
          label="Cobrado este mes"
          value={fmtS(ingreso)}
          sub={`${
            contratos.filter(c => {
              if (!c.inicio || !c.fin || c.deleted) return false;
              const ini = c.inicio.slice(0, 7),
                fin = c.fin.slice(0, 7);
              return ini <= mesActual && fin >= mesActual && c.pagosMeses?.[mesActual] === true;
            }).length
          } contratos pagados`}
          waveColor={T.accent}
          isDesktop={isDesktop}
        />
        <MetricCardNL
          icon={iPanels}
          label="Paneles libres"
          value={panalesLibres}
          valueColor={T.accent}
          sub="Listos para asignar"
          waveColor={T.accent}
          isDesktop={isDesktop}
        />
        <MetricCardNL
          icon={iClock}
          label="Por cobrar"
          value={fmtS(porcobrar)}
          valueColor={T.accent}
          sub={`${
            contratos.filter(c => {
              if (!c.inicio || !c.fin || c.deleted) return false;
              const ini = c.inicio.slice(0, 7),
                fin = c.fin.slice(0, 7);
              return ini <= mesActual && fin >= mesActual && !c.pagosMeses?.[mesActual];
            }).length
          } contratos pendientes`}
          waveColor={T.accent}
          isDesktop={isDesktop}
        />
        <MetricCardNL
          icon={iCal}
          label="Vencen pronto"
          value={vencenProx}
          sub="Próximos 30 días"
          waveColor={T.accent}
          isDesktop={isDesktop}
        />
      </div>
      <AccionesCard panalesLibres={panalesLibres} setTab={setTab} isDesktop={isDesktop} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════

export default ResumenNuevo;
