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
                color: "#fff",
                letterSpacing: "-0.03em",
                lineHeight: 1,
                position: "relative",
              }}
            >
              <span style={{ visibility: visible ? "visible" : "hidden" }}>
                {fmt(ingActual)}
              </span>
              {!visible && (
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    fontSize: "1em",
                    fontWeight: "inherit",
                    color: "#fff",
                    letterSpacing: "0.12em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {"S/ " + "•".repeat(Math.max(4, fmt(ingActual).replace("S/ ", "").length))}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: positive ? "#5BD39A" : "#FF7A8A",
              position: "relative", display: "inline-block" }}>
              <span style={{ visibility: visible ? "visible" : "hidden" }}>
                {positive ? "+" : ""}{deltaPct.toFixed(1)}%
              </span>
              {!visible && (
                <span style={{ position: "absolute", left: 0, top: 0, whiteSpace: "nowrap",
                  fontSize: "1em", fontWeight: "inherit" }}>
                  {positive ? "+" : ""}{mask(deltaPct.toFixed(1))}%
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
              }}
            >
              <span style={{ visibility: visible ? "visible" : "hidden" }}>
                {positive ? "+" : "-"}{fmt(Math.abs(delta))}
              </span>
              {!visible && (
                <span style={{ position: "absolute", left: 8, top: "50%",
                  transform: "translateY(-50%)", whiteSpace: "nowrap",
                  fontSize: "1em", fontWeight: "inherit" }}>
                  {positive ? "+" : "-"}{mask(fmt(Math.abs(delta)))}
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
function MetricCardNL({ icon, label, value, sub, waveColor, valueColor }: MetricCardNLProps) {
  return (
    <div
      style={{
        background: T.white,
        borderRadius: 18,
        padding: "14px 12px 12px",
        minWidth: 0,
        border: `1px solid ${T.border}`,
        boxShadow: "0 1px 0 rgba(16,22,40,0.02), 0 6px 24px -16px rgba(16,22,40,0.18)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          background: "linear-gradient(180deg, #0E1A3B 0%, #15265A 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 12, color: T.text, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: valueColor || T.text,
          lineHeight: 1,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.35, minHeight: 28 }}>
        {sub}
      </div>
      <div style={{ marginTop: 4, marginLeft: -2, marginRight: -2 }}>
        <Wave color={waveColor || T.accent} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ACCIONES RECOMENDADAS
// ══════════════════════════════════════════════════════════════════
function AccionesCard({ panalesLibres, setTab }: AccionesCardProps) {
  if (panalesLibres === 0) return null;
  return (
    <div style={{ background: "#0D1020", borderRadius: 20, padding: 18, marginBottom: 20 }}>
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
        <button className="v360-glass-btn"
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
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
        <button className="v360-glass-btn"
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
// ACTIVIDAD RECIENTE (basada en datos reales)
// ══════════════════════════════════════════════════════════════════
function ActividadReciente({ contratos, clientes, paneles }: ActividadRecienteProps) {
  const items = [];
  [...contratos]
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, 3)
    .forEach(c => {
      const cl = clientes.find(x => x.id === c.cliente_id);
      const ts = c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000) : null;
      const diff = ts ? Math.floor((Date.now() - ts) / 3600000) : null;
      const time =
        diff === null
          ? ""
          : diff < 1
            ? "Ahora"
            : diff < 24
              ? `Hace ${diff}h`
              : `Hace ${Math.floor(diff / 24)}d`;
      items.push({ icon: "contrato", title: "Contrato creado", sub: cl?.empresa || "—", time });
    });
  [...clientes]
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, 2)
    .forEach(cl => {
      const ts = cl.createdAt?.seconds ? new Date(cl.createdAt.seconds * 1000) : null;
      const diff = ts ? Math.floor((Date.now() - ts) / 3600000) : null;
      const time =
        diff === null
          ? ""
          : diff < 1
            ? "Ahora"
            : diff < 24
              ? `Hace ${diff}h`
              : `Hace ${Math.floor(diff / 24)}d`;
      items.push({
        icon: "cliente",
        title: "Nuevo cliente agregado",
        sub: cl.empresa || cl.nombre || "—",
        time,
      });
    });
  const sorted = items.sort((a, b) => 0).slice(0, 5);

  const IcoContrato = (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
      <path
        d="M14 2H6C5.448 2 5 2.448 5 3V21C5 21.552 5.448 22 6 22H18C18.552 22 19 21.552 19 21V7L14 2Z"
        stroke="#60A5FA"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="14 2 14 8 19 8"
        stroke="#60A5FA"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="9"
        y1="13"
        x2="15"
        y2="13"
        stroke="#60A5FA"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line
        x1="9"
        y1="17"
        x2="15"
        y2="17"
        stroke="#60A5FA"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
  const IcoCliente = (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
      <path
        d="M20 21V19C20 17.343 18.657 16 17 16H7C5.343 16 4 17.343 4 19V21"
        stroke="#60A5FA"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="8" r="4" stroke="#60A5FA" strokeWidth="1.8" />
    </svg>
  );

  return (
    <div
      style={{
        background: "#0D1020",
        borderRadius: 20,
        padding: "18px 18px",
        marginBottom: 20,
        boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
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
          Actividad reciente
        </span>
        <button className="v360-glass-btn"
          style={{
            background: "none",
            border: "none",
            color: "#60A5FA",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            touchAction: "manipulation",
            fontFamily: "inherit",
          }}
          onClick={() => {
            // navegar a histórico
            const ev = new CustomEvent("vista360_nav", { detail: "historico" });
            window.dispatchEvent(ev);
          }}
        >
          Ver todas ›
        </button>
      </div>

      {sorted.length === 0 ? (
        <div
          style={{
            color: "rgba(255,255,255,0.3)",
            fontSize: 13,
            textAlign: "center",
            padding: "16px 0",
          }}
        >
          Sin actividad reciente
        </div>
      ) : (
        sorted.map((a, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 0",
              borderBottom: i < sorted.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
            }}
          >
            {/* Icono */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                flexShrink: 0,
                background: "rgba(37,99,235,0.15)",
                border: "1px solid rgba(96,165,250,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {a.icon === "contrato" ? IcoContrato : IcoCliente}
            </div>
            {/* Texto */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#fff",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {a.title}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.38)",
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {a.sub}
              </div>
            </div>
            {/* Tiempo */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
                {a.time}
              </span>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                <path
                  d="M9 18l6-6-6-6"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        ))
      )}
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
    <div style={{ paddingBottom: 32 }}>
      <HeroCard
        panalesLibres={panalesLibres}
        contratos={contratos}
        setTab={setTab}
        userName={userName}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
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
        />
        <MetricCardNL
          icon={iPanels}
          label="Paneles libres"
          value={panalesLibres}
          valueColor={T.accent}
          sub="Listos para asignar"
          waveColor={T.accent}
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
        />
        <MetricCardNL
          icon={iCal}
          label="Vencen pronto"
          value={vencenProx}
          sub="Próximos 30 días"
          waveColor={T.accent}
        />
      </div>
      <AccionesCard panalesLibres={panalesLibres} setTab={setTab} />
      <ActividadReciente contratos={contratos} clientes={clientes} paneles={paneles} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════

export default ResumenNuevo;
