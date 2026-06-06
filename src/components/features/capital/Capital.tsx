// @ts-nocheck — legacy file: migrating to strict TypeScript gradually
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../../config/firebase";
import type { User } from "firebase/auth";
import type { Panel, Cliente, Contrato, Gasto, Proveedor, Factura, Sueldo } from "../../../types";
import { fb } from "../../../services/firestore";
import { T, tCol, catCol } from "../../../config/theme";
import { toast, confirmAsync } from "../../../context/UIContext";
import {
  fmt,
  fmtS2,
  fmtK,
  fmtF,
  dias,
  mesHoy,
  mesLabel,
  validate,
  haptic,
} from "../../../lib/utils";
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

function CapModal({ open, onClose, title, subtitle, children }: CapModalProps) {
  if (!open) return null;
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        zIndex: 700,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 540,
          background: T.dark,
          borderRadius: "24px 24px 0 0",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 -12px 48px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div
            style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }}
          />
        </div>
        <div style={{ padding: "8px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 12, color: "rgba(148,175,255,0.5)", marginTop: 3 }}>
              {subtitle}
            </div>
          )}
        </div>
        <div
          style={{
            overflowY: "auto",
            flex: 1,
            padding: "16px 20px",
            paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function DarkInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  prefix,
  suffix,
}: DarkInputProps) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "rgba(148,175,255,0.5)",
            letterSpacing: 1.2,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          padding: "0 14px",
          gap: 8,
        }}
      >
        {prefix && (
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
            {prefix}
          </span>
        )}
        <input
          type={type}
          inputMode={type === "number" ? "decimal" : "text"}
          value={value}
          onChange={onChange}
          placeholder={placeholder || ""}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            padding: "13px 0",
            fontFamily: "inherit",
          }}
        />
        {suffix && (
          <span style={{ fontSize: 12, color: "rgba(148,175,255,0.4)", flexShrink: 0 }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function DarkSelect({ label, value, onChange, options }: DarkSelectProps) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "rgba(148,175,255,0.5)",
            letterSpacing: 1.2,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {label}
        </div>
      )}
      <select
        value={value}
        onChange={onChange}
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          padding: "13px 14px",
          color: "#fff",
          fontSize: 14,
          fontFamily: "inherit",
          outline: "none",
          appearance: "none",
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: T.dark }}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Tarjeta navy premium con ondas ──
function CapCard({ children, accent = "#3B6EFF", noWave, style = {} }: CapCardProps) {
  const wid = `cw${Math.random().toString(36).slice(2, 7)}`;
  return (
    <div
      style={{
        position: "relative",
        background: "linear-gradient(145deg,#0E1B38 0%,#0A1428 60%,#070E1E 100%)",
        border: `1px solid rgba(255,255,255,0.07)`,
        borderRadius: 22,
        boxShadow: "0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)",
        overflow: "hidden",
        ...style,
      }}
    >
      {!noWave && (
        <svg
          viewBox="0 0 400 140"
          preserveAspectRatio="xMidYMid slice"
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: "70%",
            height: "100%",
            pointerEvents: "none",
            opacity: 0.55,
          }}
        >
          <defs>
            <linearGradient id={wid} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={accent} stopOpacity="0" />
              <stop offset="50%" stopColor={accent} stopOpacity="0.5" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4, 5].map(i => {
            const t = i / 5;
            return (
              <path
                key={i}
                d={`M${380 - t * 40} ${140} C ${310 - t * 30} ${100} ${230 - t * 20} ${60} ${130 - t * 15} ${30} S ${20 - t * 10} ${10} ${-10} ${25}`}
                fill="none"
                stroke={`url(#${wid})`}
                strokeWidth={1.2 - t * 0.15}
                opacity={0.25 + t * 0.5}
              />
            );
          })}
        </svg>
      )}
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

function Sparkline({ data, color = "#60A5FA", height = 36 }: SparklineProps) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1),
    W = 200,
    H = height;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - (v / max) * (H - 6) - 3,
  }));
  const line = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const gid = `sp${color.replace("#", "")}`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3.5" fill={color} />
    </svg>
  );
}

function ProgressBar({
  pct,
  color = "#60A5FA",
  height = 8,
  bg = "rgba(255,255,255,0.08)",
}: ProgressBarProps) {
  return (
    <div style={{ height, borderRadius: 99, background: bg, overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          width: `${Math.min(pct, 100)}%`,
          background: color,
          borderRadius: 99,
          transition: "width .6s cubic-bezier(.4,0,.2,1)",
        }}
      />
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CAPITAL — componente principal
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Capital({ paneles, contratos, gastos, proveedores }: CapitalProps) {
  // ── State persistido en Firebase ──
  const [data, setData] = useState({
    cuentas: [], // {id,nombre,banco,saldo,tipo}
    caja: 0, // efectivo físico
    activos: [], // {id,nombre,categoria,valor,fecha,rentabilidad}
    deudas: [], // {id,nombre,monto,vence}
    fondos: [
      // porcentajes estratégicos
      { id: "operacion", label: "Operación", color: "#3B82F6", pct: 30 },
      { id: "expansion", label: "Expansión", color: "#3B82F6", pct: 25 },
      { id: "inversion", label: "Inversión", color: "#818CF8", pct: 25 },
      { id: "personal", label: "Personal", color: "#94A3B8", pct: 20 },
    ],
    objetivos: [], // {id,nombre,meta,actual,fecha}
  });
  const [loaded, setLoaded] = useState(false);
  const [section, setSection] = useState("patrimonio"); // tab activo

  // Modales
  const [modal, setModal] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  // ── Cargar de Firebase ──
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "configuracion", "capitalv2"));
        if (snap.exists()) setData(d => ({ ...d, ...snap.data() }));
      } catch (e) {
        console.error("[Capital] Error cargando configuracion/capitalv2:", e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const saveData = async patch => {
    const next = { ...data, ...patch };
    setData(next);
    try {
      await setDoc(doc(db, "configuracion", "capitalv2"), next, { merge: true });
    } catch (e) {
      console.error("[Capital] Error guardando configuracion:", e);
    }
  };

  // ── Cálculos financieros ──
  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const mesPasado = (() => {
    const d = new Date(hoy);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const ingMes = contratos
    .filter(c => {
      if (c.deleted || !c.inicio || !c.fin) return false;
      const ini = c.inicio.slice(0, 7);
      const fin = c.fin.slice(0, 7);
      return ini <= mesActual && fin >= mesActual && c.pagosMeses?.[mesActual] === true;
    })
    .reduce((s, c) => s + Number(c.monto || 0), 0);
  const ingPrev = contratos
    .filter(c => {
      if (c.deleted || !c.inicio || !c.fin) return false;
      const ini = c.inicio.slice(0, 7);
      const fin = c.fin.slice(0, 7);
      return ini <= mesPasado && fin >= mesPasado && c.pagosMeses?.[mesPasado] === true;
    })
    .reduce((s, c) => s + Number(c.monto || 0), 0);
  const gastosMes = gastos
    .filter(g => !g.deleted && (g.fecha || "").slice(0, 7) === mesActual)
    .reduce((s, g) => s + Number(g.monto || 0), 0);
  const porCobrar = contratos
    .filter(c => {
      if (c.deleted || !c.inicio || !c.fin) return false;
      const ini = c.inicio.slice(0, 7);
      const fin = c.fin.slice(0, 7);
      return ini <= mesActual && fin >= mesActual && !c.pagosMeses?.[mesActual];
    })
    .reduce((s, c) => s + Number(c.monto || 0), 0);

  const totalCuentas = data.cuentas.reduce((s, c) => s + Number(c.saldo || 0), 0);
  const totalLiquidez = totalCuentas + Number(data.caja || 0);
  const totalActivos = data.activos.reduce((s, a) => s + Number(a.valor || 0), 0);
  const totalDeudas = data.deudas.reduce((s, d) => s + Number(d.monto || 0), 0);
  const patrimonio = totalLiquidez + totalActivos - totalDeudas;
  const liquidezNeta = totalLiquidez - gastosMes;

  // Sparkline 6 meses de ingresos
  const spark6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return contratos
      .filter(c => {
        if (c.deleted || !c.inicio || !c.fin) return false;
        const ini = c.inicio.slice(0, 7);
        const fin = c.fin.slice(0, 7);
        return ini <= k && fin >= k && c.pagosMeses?.[k] === true;
      })
      .reduce((s, c) => s + Number(c.monto || 0), 0);
  });

  // Variación patrimonio estimada
  const patrimonioMesAnt = patrimonio - ingMes + ingPrev;
  const patrimonioChange =
    patrimonioMesAnt > 0
      ? Math.round(((patrimonio - patrimonioMesAnt) / patrimonioMesAnt) * 100)
      : 0;

  // Proyección: cuándo se alcanza el siguiente objetivo
  const objPendiente = data.objetivos.find(o => Number(o.actual || 0) < Number(o.meta || 0));
  const nFaltan = objPendiente ? Number(objPendiente.meta) - Number(objPendiente.actual) : 0;
  const ingresoMensualNeto = ingMes - gastosMes;
  const mesesProyeccion = ingresoMensualNeto > 0 ? Math.ceil(nFaltan / ingresoMensualNeto) : null;

  // Insights inteligentes
  const insights = [];
  if (patrimonioChange > 0)
    insights.push({
      icon: "↑",
      text: `Tu patrimonio aumentó ${patrimonioChange}% este mes`,
      color: "#60A5FA",
    });
  if (totalLiquidez > gastosMes * 3)
    insights.push({
      icon: "◈",
      text: "Liquidez saludable — más de 3 meses cubiertos",
      color: "#3B82F6",
    });
  if (mesesProyeccion)
    insights.push({
      icon: "◎",
      text: `Podrías cumplir "${objPendiente.nombre}" en ~${mesesProyeccion} mes${mesesProyeccion !== 1 ? "es" : ""}`,
      color: "#3B82F6",
    });
  if (totalActivos > totalDeudas * 2)
    insights.push({
      icon: "◆",
      text: "Tus activos duplican tus deudas — solidez financiera",
      color: "#60A5FA",
    });
  if (ingMes > gastosMes * 1.5)
    insights.push({
      icon: "◆",
      text: "Flujo positivo: ingresas más del doble de lo que gastas",
      color: "#60A5FA",
    });

  // ── Colores por sección ──
  const CAP_COLORS = {
    liquidez: "#3B82F6", // blue
    activos: "#10B981", // green
    deudas: "#EF4444", // red
    fondos: "#8B5CF6", // purple
    objetivos: "#06B6D4", // cyan
  };

  // ── UI helpers ──
  const TABS = [
    {
      id: "patrimonio",
      label: "Patrimonio",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      id: "liquidez",
      label: "Liquidez",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M12 2C6 8 4 12 4 15a8 8 0 0016 0c0-3-2-7-8-13z" />
        </svg>
      ),
    },
    {
      id: "activos",
      label: "Activos",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
        </svg>
      ),
    },
    {
      id: "fondos",
      label: "Fondos",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        </svg>
      ),
    },
    {
      id: "objetivos",
      label: "Objetivos",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      ),
    },
  ];

  // ── CRUD helpers ──
  const openAdd = type => {
    setModal(type);
    setEditItem(null);
    setForm({});
  };
  const openEdit = (type, item) => {
    setModal(type);
    setEditItem(item);
    setForm({ ...item });
  };
  const closeModal = () => {
    setModal(null);
    setEditItem(null);
    setForm({});
  };

  const saveItem = async collection => {
    setSaving(true);
    const id = editItem?.id || `${collection}_${Date.now()}`;
    const item = { ...form, id };
    const list = [...(data[collection] || [])];
    const idx = list.findIndex(x => x.id === id);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    await saveData({ [collection]: list });
    setSaving(false);
    haptic(editItem ? "save" : "create");
    closeModal();
  };

  const deleteItem = async (collection, id) => {
    const list = (data[collection] || []).filter(x => x.id !== id);
    await saveData({ [collection]: list });
    haptic("delete");
  };

  const saveFondos = async () => {
    setSaving(true);
    await saveData({
      fondos: data.fondos.map((f, i) => ({ ...f, pct: Number(form[`pct_${i}`] ?? f.pct) })),
    });
    setSaving(false);
    haptic("save");
    closeModal();
  };

  if (!loaded)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 300,
          color: "rgba(148,175,255,0.45)",
          fontSize: 14,
        }}
      >
        Cargando...
      </div>
    );

  // ━━ RENDER SECCIONES ━━

  const renderPatrimonio = () => (
    <div>
      {/* Hero patrimonio */}
      <CapCard accent="#3B82F6" style={{ padding: "26px 22px 22px", marginBottom: 12 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "rgba(147,197,253,0.6)",
            letterSpacing: 2.5,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Patrimonio neto total
        </div>
        <div
          style={{
            fontSize: 48,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: "-2px",
            lineHeight: 1,
            marginBottom: 8,
          }}
        >
          {fmtS2(patrimonio)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: patrimonioChange >= 0 ? "#60A5FA" : "#F87171",
              background:
                patrimonioChange >= 0 ? "rgba(59,130,246,0.18)" : "rgba(248,113,113,0.15)",
              borderRadius: 99,
              padding: "3px 10px",
            }}
          >
            {patrimonioChange >= 0 ? "+" : ""}
            {patrimonioChange}% este mes
          </span>
        </div>
        <Sparkline data={spark6} color="#60A5FA" height={44} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 16 }}>
          {[
            { label: "Liquidez", value: totalLiquidez, color: "#60A5FA" },
            { label: "Activos", value: totalActivos, color: "#fff" },
            { label: "Deudas", value: totalDeudas, color: "#F87171" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                background: "rgba(255,255,255,0.07)",
                borderRadius: 12,
                padding: "10px 10px",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: color,
                  marginBottom: 6,
                }}
              />
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 3 }}>
                {label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{fmtK(value)}</div>
            </div>
          ))}
        </div>
      </CapCard>

      {/* Flujo mensual — dark navy glass (no white cards) */}
      <CapCard style={{ padding: "18px 20px", marginBottom: 12 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "rgba(148,175,255,0.45)",
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          Flujo mensual
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            {
              label: "Ingresos",
              value: ingMes,
              color: "#60A5FA",
              bg: "rgba(59,130,246,0.10)",
              border: "rgba(59,130,246,0.20)",
              icon: "↑",
            },
            {
              label: "Gastos",
              value: gastosMes,
              color: "#F87171",
              bg: "rgba(239,68,68,0.10)",
              border: "rgba(239,68,68,0.22)",
              icon: "↓",
            },
            {
              label: "Por cobrar",
              value: porCobrar,
              color: "#93C5FD",
              bg: "rgba(59,130,246,0.08)",
              border: "rgba(59,130,246,0.15)",
              icon: "◇",
            },
            {
              label: "Neto libre",
              value: Math.max(ingresoMensualNeto, 0),
              color: "#fff",
              bg: "rgba(255,255,255,0.05)",
              border: "rgba(255,255,255,0.09)",
              icon: "◆",
            },
          ].map(({ label, value, color, bg, border, icon }) => (
            <div
              key={label}
              style={{
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: 14,
                padding: "13px 14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    background: `${color}22`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    color,
                  }}
                >
                  {icon}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    color: "rgba(148,175,255,0.5)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                  }}
                >
                  {label}
                </span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, color, letterSpacing: "-0.5px" }}>
                {fmtK(value)}
              </div>
            </div>
          ))}
        </div>
      </CapCard>

      {/* Insights — dark glass only (no red bg) */}
      {insights.length > 0 && (
        <CapCard style={{ padding: "18px 20px" }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(148,175,255,0.45)",
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Análisis inteligente
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {insights.map((ins, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "rgba(59,130,246,0.08)",
                  border: "1px solid rgba(59,130,246,0.18)",
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{ins.icon}</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "rgba(220,235,255,0.85)",
                    lineHeight: 1.4,
                  }}
                >
                  {ins.text}
                </span>
              </div>
            ))}
          </div>
        </CapCard>
      )}
    </div>
  );

  const renderLiquidez = () => (
    <div>
      {/* Total liquidez hero */}
      <CapCard accent={CAP_COLORS.liquidez} style={{ padding: "22px 20px", marginBottom: 12 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "rgba(147,197,253,0.7)",
            letterSpacing: 2.5,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Dinero disponible
        </div>
        <div
          style={{
            fontSize: 40,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: "-1.5px",
            lineHeight: 1,
            marginBottom: 4,
          }}
        >
          {fmtS2(totalLiquidez)}
        </div>
        <div
          style={{
            fontSize: 12,
            color: liquidezNeta >= 0 ? "#60A5FA" : "#F87171",
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          {liquidezNeta >= 0 ? "" : ""} {fmtS2(Math.abs(liquidezNeta))}{" "}
          {liquidezNeta >= 0 ? "libre tras gastos del mes" : "déficit este mes"}
        </div>
        {/* Caja vs bancos */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div
            style={{
              background: "rgba(59,130,246,0.10)",
              border: "1px solid rgba(16,185,129,0.22)",
              borderRadius: 12,
              padding: "11px 13px",
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "rgba(96,165,250,0.5)",
                fontWeight: 700,
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Cuentas bancarias
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#3B82F6" }}>
              {fmtS2(totalCuentas)}
            </div>
          </div>
          <div
            style={{
              background: "rgba(59,130,246,0.10)",
              border: "1px solid rgba(16,185,129,0.22)",
              borderRadius: 12,
              padding: "11px 13px",
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "rgba(147,197,253,0.7)",
                fontWeight: 700,
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Caja / Efectivo
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#60A5FA" }}>
              {fmtS2(data.caja)}
            </div>
          </div>
        </div>
      </CapCard>

      {/* Cuentas bancarias */}
      <CapCard style={{ padding: "18px 20px", marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(148,175,255,0.45)",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Cuentas bancarias
          </div>
          <button
            onClick={() => openAdd("cuentas")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: "rgba(59,130,246,0.10)",
              border: "1px solid rgba(16,185,129,0.22)",
              borderRadius: 99,
              padding: "5px 12px",
              color: "#3B82F6",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              touchAction: "manipulation",
              fontFamily: "inherit",
            }}
          >
            + Agregar
          </button>
        </div>
        {data.cuentas.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "24px 0",
              color: "rgba(148,175,255,0.45)",
              fontSize: 13,
            }}
          >
            Sin cuentas registradas
          </div>
        ) : (
          data.cuentas.map(c => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 0",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 11,
                  background: "rgba(59,130,246,0.10)",
                  border: "1px solid rgba(16,185,129,0.22)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <line x1="3" y1="22" x2="21" y2="22" />
                  <line x1="6" y1="18" x2="6" y2="11" />
                  <line x1="10" y1="18" x2="10" y2="11" />
                  <line x1="14" y1="18" x2="14" y2="11" />
                  <line x1="18" y1="18" x2="18" y2="11" />
                  <polygon points="12 2 20 7 4 7" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{c.nombre}</div>
                <div style={{ fontSize: 11, color: "rgba(148,175,255,0.45)" }}>
                  {c.banco || "—"} · {c.tipo || "Ahorro"}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#60A5FA" }}>
                  {fmtS2(c.saldo)}
                </div>
              </div>
              <button
                onClick={() => openEdit("cuentas", c)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer",
                  touchAction: "manipulation",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(148,175,255,0.45)",
                  flexShrink: 0,
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              </button>
            </div>
          ))
        )}
      </CapCard>

      {/* Caja efectivo */}
      <CapCard style={{ padding: "18px 20px" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "rgba(148,175,255,0.45)",
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Caja / Efectivo
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#60A5FA", letterSpacing: "-1px" }}>
              {fmtS2(data.caja)}
            </div>
            <div style={{ fontSize: 11, color: "rgba(148,175,255,0.45)", marginTop: 4 }}>
              Efectivo disponible en caja
            </div>
          </div>
          <button
            onClick={() => {
              setModal("caja");
              setForm({ caja: String(data.caja) });
            }}
            style={{
              background: "rgba(59,130,246,0.12)",
              border: "1px solid rgba(16,185,129,0.25)",
              borderRadius: 12,
              padding: "10px 16px",
              color: "#60A5FA",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              touchAction: "manipulation",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            Actualizar
          </button>
        </div>
      </CapCard>
    </div>
  );

  const CAT_ACTIVOS = [
    { value: "panel", label: "Panel publicitario" },
    { value: "equipo", label: "Equipo / Maquinaria" },
    { value: "vehiculo", label: "Vehículo" },
    { value: "inmueble", label: "Inmueble" },
    { value: "herramienta", label: "Herramienta" },
    { value: "otro", label: "Otro" },
  ];
  const catIcon = {
    panel: "PAN",
    equipo: "EQP",
    vehiculo: "VEH",
    inmueble: "INM",
    herramienta: "HER",
    otro: "OTR",
  };
  const catSVG: Record<string, React.ReactNode> = {
    panel: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="13" rx="2"/>
        <line x1="12" y1="16" x2="12" y2="21"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
      </svg>
    ),
    equipo: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
    vehiculo: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 17H3a2 2 0 01-2-2V9l3-6h14l3 6v6a2 2 0 01-2 2h-2"/>
        <circle cx="7.5" cy="17.5" r="2.5"/>
        <circle cx="16.5" cy="17.5" r="2.5"/>
        <line x1="10" y1="17" x2="14" y2="17"/>
      </svg>
    ),
    inmueble: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
    herramienta: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
    otro: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  };

  const renderActivos = () => (
    <div>
      <CapCard accent={CAP_COLORS.activos} style={{ padding: "22px 20px", marginBottom: 12 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "rgba(147,197,253,0.7)",
            letterSpacing: 2.5,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Valor total de activos
        </div>
        <div
          style={{
            fontSize: 40,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: "-1.5px",
            lineHeight: 1,
            marginBottom: 4,
          }}
        >
          {fmtS2(totalActivos)}
        </div>
        <div style={{ fontSize: 12, color: "rgba(148,175,255,0.45)", marginBottom: 16 }}>
          {data.activos.length} activo{data.activos.length !== 1 ? "s" : ""} registrado
          {data.activos.length !== 1 ? "s" : ""}
        </div>
        {/* Distribución por categoría */}
        {data.activos.length > 0 &&
          (() => {
            const porCat = data.activos.reduce((acc, a) => {
              acc[a.categoria || "otro"] = (acc[a.categoria || "otro"] || 0) + Number(a.valor || 0);
              return acc;
            }, {});
            return (
              <div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 99,
                    overflow: "hidden",
                    display: "flex",
                    gap: 2,
                    marginBottom: 8,
                  }}
                >
                  {Object.entries(porCat).map(([cat, val], i) => {
                    const cs = ["#3B82F6", "#60A5FA", "#8B5CF6", "#38BDF8", T.red, "#EC4899"];
                    return (
                      <div
                        key={cat}
                        style={{ flex: val, background: cs[i % cs.length], borderRadius: 99 }}
                      />
                    );
                  })}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {Object.entries(porCat).map(([cat, val], i) => {
                    const cs = ["#3B82F6", "#60A5FA", "#8B5CF6", "#38BDF8", T.red, "#EC4899"];
                    return (
                      <span
                        key={cat}
                        style={{
                          fontSize: 10,
                          color: cs[i % cs.length],
                          background: `${cs[i % cs.length]}18`,
                          borderRadius: 99,
                          padding: "2px 8px",
                          fontWeight: 600,
                        }}
                      >
                        {catIcon[cat] || "OTR"} {fmtK(val)}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })()}
      </CapCard>

      <CapCard style={{ padding: "18px 20px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(148,175,255,0.45)",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Mis activos
          </div>
          <button
            onClick={() => openAdd("activos")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: "rgba(59,130,246,0.10)",
              border: "1px solid rgba(16,185,129,0.22)",
              borderRadius: 99,
              padding: "5px 12px",
              color: "#60A5FA",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              touchAction: "manipulation",
              fontFamily: "inherit",
            }}
          >
            + Agregar
          </button>
        </div>
        {data.activos.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "24px 0",
              color: "rgba(148,175,255,0.45)",
              fontSize: 13,
            }}
          >
            Sin activos registrados
          </div>
        ) : (
          data.activos.map(a => {
            const rent = Number(a.rentabilidad || 0);
            return (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: "rgba(59,130,246,0.1)",
                    border: "1px solid rgba(59,130,246,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {catSVG[a.categoria || "otro"] || catSVG.otro}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#fff",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {a.nombre}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(148,175,255,0.45)" }}>
                    {a.fecha || "—"}
                    {rent > 0 ? ` · +${rent}% rentab.` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#60A5FA" }}>
                    {fmtS2(a.valor)}
                  </div>
                </div>
                <button
                  onClick={() => openEdit("activos", a)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    cursor: "pointer",
                    touchAction: "manipulation",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "rgba(148,175,255,0.45)",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </CapCard>
    </div>
  );

  // Colores seguros para fondos — el naranja/ámbar se muestra en BLANCO
  // (el usuario pidió "ponle blanco" para los fondos con color naranja)
  const ORANGE_HEX = [
    "#F59E0B","#EF8C00","#FCD34D","#FBBF24","#D97706","#F97316",
    "#FB923C","#FDBA74","#F59E0B","#ED8936","#DD6B20","#C05621",
    "#FFAB40","#FF9100","#FF6D00","#FF8F00","#FFA000","#FFB300",
    "#FFC107","#FFD54F","#FFCA28","#FFA726","#FF7043","#FF5722",
  ].map(h => h.toUpperCase());
  const safeCol = (color: string, _idx: number): string =>
    ORANGE_HEX.includes(color.toUpperCase()) ? "#ffffff" : color;

  const renderFondos = () => {
    const totalPct = data.fondos.reduce((s, f) => s + Number(f.pct || 0), 0);
    return (
      <div>
        <CapCard accent={CAP_COLORS.fondos} style={{ padding: "22px 20px", marginBottom: 12 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(147,197,253,0.7)",
              letterSpacing: 2.5,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Fondos estratégicos
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: "-1px",
              lineHeight: 1,
              marginBottom: 4,
            }}
          >
            {fmtS2(liquidezNeta > 0 ? liquidezNeta : 0)}
          </div>
          <div style={{ fontSize: 12, color: "rgba(148,175,255,0.45)", marginBottom: 16 }}>
            disponible para distribuir
          </div>
          {/* Barra coloreada */}
          <div
            style={{
              height: 10,
              borderRadius: 99,
              overflow: "hidden",
              display: "flex",
              gap: 2,
              marginBottom: 8,
            }}
          >
            {data.fondos
              .filter(f => f.pct > 0)
              .map((f, fi) => (
                <div key={f.id} style={{ flex: f.pct, background: safeCol(f.color, fi), borderRadius: 99 }} />
              ))}
            {totalPct < 100 && (
              <div
                style={{
                  flex: 100 - totalPct,
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 99,
                }}
              />
            )}
          </div>
          <div style={{ fontSize: 10, color: "rgba(148,175,255,0.45)", textAlign: "right" }}>
            {totalPct}% asignado
          </div>
        </CapCard>

        <CapCard style={{ padding: "18px 20px", marginBottom: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "rgba(148,175,255,0.45)",
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              Distribución
            </div>
            <button
              onClick={() => {
                setModal("fondos");
                const f2 = {};
                data.fondos.forEach((f, i) => (f2[`pct_${i}`] = f.pct));
                setForm(f2);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "rgba(59,130,246,0.10)",
                border: "1px solid rgba(16,185,129,0.22)",
                borderRadius: 99,
                padding: "5px 12px",
                color: "#3B82F6",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                touchAction: "manipulation",
                fontFamily: "inherit",
              }}
            >
              Ajustar %
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.fondos.map(f => {
              const monto = (liquidezNeta > 0 ? liquidezNeta : 0) * (f.pct / 100);
              return (
                <div
                  key={f.id}
                  style={{
                    padding: "13px 14px",
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{f.label}</div>
                      <div style={{ fontSize: 11, color: "rgba(148,175,255,0.45)" }}>
                        {f.pct}% del disponible
                      </div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: "#3B82F6" }}>
                      {fmtS2(monto)}
                    </div>
                  </div>
                  <ProgressBar pct={f.pct} color={f.color} height={6} />
                </div>
              );
            })}
          </div>
        </CapCard>
      </div>
    );
  };

  const renderObjetivos = () => (
    <div>
      <CapCard accent={CAP_COLORS.objetivos} style={{ padding: "22px 20px", marginBottom: 12 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "rgba(147,197,253,0.7)",
            letterSpacing: 2.5,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Objetivos de expansión
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: "-1px",
            lineHeight: 1,
            marginBottom: 6,
          }}
        >
          {data.objetivos.filter(o => Number(o.actual || 0) >= Number(o.meta || 0)).length} /{" "}
          {data.objetivos.length} completados
        </div>
        {ingresoMensualNeto > 0 && objPendiente && (
          <div style={{ fontSize: 12, color: "#3B82F6", fontWeight: 600 }}>
            "{objPendiente.nombre}" en ~{mesesProyeccion} mes{mesesProyeccion !== 1 ? "es" : ""}
          </div>
        )}
      </CapCard>

      <CapCard style={{ padding: "18px 20px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(148,175,255,0.45)",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Mis objetivos
          </div>
          <button
            onClick={() => openAdd("objetivos")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: "rgba(59,130,246,0.10)",
              border: "1px solid rgba(16,185,129,0.22)",
              borderRadius: 99,
              padding: "5px 12px",
              color: "#3B82F6",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              touchAction: "manipulation",
              fontFamily: "inherit",
            }}
          >
            + Nuevo
          </button>
        </div>
        {data.objetivos.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "24px 0",
              color: "rgba(148,175,255,0.45)",
              fontSize: 13,
            }}
          >
            Sin objetivos · agrega tu primero
          </div>
        ) : (
          data.objetivos.map(o => {
            const meta = Number(o.meta || 0),
              actual = Number(o.actual || 0);
            const pct = meta > 0 ? Math.min(Math.round((actual / meta) * 100), 100) : 0;
            const faltan = Math.max(meta - actual, 0);
            const meses = ingresoMensualNeto > 0 ? Math.ceil(faltan / ingresoMensualNeto) : null;
            const done = actual >= meta;
            return (
              <div
                key={o.id}
                style={{
                  marginBottom: 14,
                  padding: "14px 14px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${done ? "rgba(52,211,153,0.2)" : "rgba(245,158,11,0.12)"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{o.nombre}</div>
                    <div style={{ fontSize: 11, color: "rgba(148,175,255,0.45)", marginTop: 2 }}>
                      {fmtS2(actual)} de {fmtS2(meta)}
                      {!done && meses && ` · ~${meses} mes${meses !== 1 ? "es" : ""}`}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div
                      style={{ fontSize: 18, fontWeight: 900, color: done ? "#60A5FA" : "#93C5FD" }}
                    >
                      {pct}%
                    </div>
                    {done && (
                      <div style={{ fontSize: 10, color: "#60A5FA", fontWeight: 700 }}>
                        Completado
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => openEdit("objetivos", o)}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      cursor: "pointer",
                      touchAction: "manipulation",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "rgba(148,175,255,0.45)",
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                  </button>
                </div>
                <ProgressBar pct={pct} color={done ? "#60A5FA" : "#8B5CF6"} height={8} />
                {!done && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                    <span style={{ fontSize: 10, color: "rgba(148,175,255,0.45)" }}>
                      Faltan {fmtS2(faltan)}
                    </span>
                    <span
                      style={{ fontSize: 10, color: "rgba(148,175,255,0.45)", fontWeight: 600 }}
                    >
                      Meta: {fmtS2(meta)}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CapCard>
    </div>
  );

  // ━━ MODALES ━━

  const modalCuenta = (
    <CapModal
      open={modal === "cuentas"}
      onClose={closeModal}
      title={editItem ? "Editar cuenta" : "Nueva cuenta bancaria"}
      subtitle="Dinero en bancos"
    >
      <DarkInput
        label="Nombre"
        value={form.nombre || ""}
        onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
        placeholder="Ej: BCP Principal"
      />
      <DarkInput
        label="Banco"
        value={form.banco || ""}
        onChange={e => setForm(f => ({ ...f, banco: e.target.value }))}
        placeholder="BCP, Interbank, BBVA..."
      />
      <DarkSelect
        label="Tipo"
        value={form.tipo || "Ahorro"}
        onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
        options={[
          { value: "Ahorro", label: "Ahorros" },
          { value: "Corriente", label: "Corriente" },
          { value: "CTS", label: "CTS" },
          { value: "Otro", label: "Otro" },
        ]}
      />
      <DarkInput
        label="Saldo actual"
        value={form.saldo || ""}
        onChange={e => setForm(f => ({ ...f, saldo: e.target.value }))}
        type="number"
        prefix="S/"
        placeholder="0.00"
      />
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        {editItem && (
          <button
            onClick={() => {
              deleteItem("cuentas", editItem.id);
              closeModal();
            }}
            style={{
              flex: 1,
              padding: 13,
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 12,
              color: "#F87171",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              touchAction: "manipulation",
              fontFamily: "inherit",
            }}
          >
            Eliminar
          </button>
        )}
        <button
          onClick={() => saveItem("cuentas")}
          disabled={saving}
          style={{
            flex: 2,
            padding: 13,
            background: "#3B82F6",
            border: "none",
            borderRadius: 12,
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            touchAction: "manipulation",
            fontFamily: "inherit",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </CapModal>
  );

  const modalCaja = (
    <CapModal
      open={modal === "caja"}
      onClose={closeModal}
      title="Actualizar caja"
      subtitle="Efectivo físico disponible"
    >
      <DarkInput
        label="Saldo en caja"
        value={form.caja || ""}
        onChange={e => setForm(f => ({ ...f, caja: e.target.value }))}
        type="number"
        prefix="S/"
        placeholder="0.00"
      />
      <button
        onClick={async () => {
          setSaving(true);
          await saveData({ caja: Number(form.caja || 0) });
          setSaving(false);
          haptic("save");
          closeModal();
        }}
        disabled={saving}
        style={{
          width: "100%",
          padding: 13,
          background: "#3B82F6",
          border: "none",
          borderRadius: 12,
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
          touchAction: "manipulation",
          fontFamily: "inherit",
          opacity: saving ? 0.7 : 1,
          marginTop: 4,
        }}
      >
        {saving ? "Guardando…" : "Guardar"}
      </button>
    </CapModal>
  );

  const modalActivo = (
    <CapModal
      open={modal === "activos"}
      onClose={closeModal}
      title={editItem ? "Editar activo" : "Nuevo activo"}
      subtitle="Bienes del negocio"
    >
      <DarkInput
        label="Nombre"
        value={form.nombre || ""}
        onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
        placeholder="Ej: Panel LED avenida principal"
      />
      <DarkSelect
        label="Categoría"
        value={form.categoria || "panel"}
        onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
        options={CAT_ACTIVOS}
      />
      <DarkInput
        label="Valor estimado"
        value={form.valor || ""}
        onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
        type="number"
        prefix="S/"
        placeholder="0.00"
      />
      <DarkInput
        label="Fecha de compra"
        value={form.fecha || ""}
        onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
        type="date"
      />
      <DarkInput
        label="Rentabilidad mensual % (opcional)"
        value={form.rentabilidad || ""}
        onChange={e => setForm(f => ({ ...f, rentabilidad: e.target.value }))}
        type="number"
        suffix="%"
        placeholder="0"
      />
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        {editItem && (
          <button
            onClick={() => {
              deleteItem("activos", editItem.id);
              closeModal();
            }}
            style={{
              flex: 1,
              padding: 13,
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 12,
              color: "#F87171",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              touchAction: "manipulation",
              fontFamily: "inherit",
            }}
          >
            Eliminar
          </button>
        )}
        <button
          onClick={() => saveItem("activos")}
          disabled={saving}
          style={{
            flex: 2,
            padding: 13,
            background: "#3B82F6",
            border: "none",
            borderRadius: 12,
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            touchAction: "manipulation",
            fontFamily: "inherit",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </CapModal>
  );

  const modalFondos = (
    <CapModal
      open={modal === "fondos"}
      onClose={closeModal}
      title="Ajustar fondos"
      subtitle="Define cómo distribuir tu dinero disponible"
    >
      {data.fondos.map((f, i) => (
        <div key={f.id} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
            {f.label}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() =>
                setForm(prev => ({
                  ...prev,
                  [`pct_${i}`]: Math.max(0, Number(prev[`pct_${i}`] ?? f.pct) - 5),
                }))
              }
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff",
                fontSize: 18,
                cursor: "pointer",
                touchAction: "manipulation",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "inherit",
                flexShrink: 0,
              }}
            >
              −
            </button>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  textAlign: "center",
                  fontSize: 18,
                  fontWeight: 900,
                  color: f.color,
                  marginBottom: 4,
                }}
              >
                {form[`pct_${i}`] ?? f.pct}%
              </div>
              <ProgressBar pct={Number(form[`pct_${i}`] ?? f.pct)} color={f.color} height={6} />
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(148,175,255,0.45)",
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                {fmtS2(
                  (liquidezNeta > 0 ? liquidezNeta : 0) * (Number(form[`pct_${i}`] ?? f.pct) / 100),
                )}
              </div>
            </div>
            <button
              onClick={() =>
                setForm(prev => ({
                  ...prev,
                  [`pct_${i}`]: Math.min(100, Number(prev[`pct_${i}`] ?? f.pct) + 5),
                }))
              }
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff",
                fontSize: 18,
                cursor: "pointer",
                touchAction: "manipulation",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "inherit",
                flexShrink: 0,
              }}
            >
              +
            </button>
          </div>
        </div>
      ))}
      <div
        style={{
          fontSize: 12,
          color: "rgba(148,175,255,0.45)",
          textAlign: "center",
          marginBottom: 16,
        }}
      >
        Total: {data.fondos.reduce((s, f, i) => s + Number(form[`pct_${i}`] ?? f.pct), 0)}%
      </div>
      <button
        onClick={saveFondos}
        disabled={saving}
        style={{
          width: "100%",
          padding: 13,
          background: "#3B82F6",
          border: "none",
          borderRadius: 12,
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
          touchAction: "manipulation",
          fontFamily: "inherit",
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? "Guardando…" : "Guardar distribución"}
      </button>
    </CapModal>
  );

  const modalObjetivo = (
    <CapModal
      open={modal === "objetivos"}
      onClose={closeModal}
      title={editItem ? "Editar objetivo" : "Nuevo objetivo"}
      subtitle="Meta de expansión del negocio"
    >
      <DarkInput
        label="Nombre del objetivo"
        value={form.nombre || ""}
        onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
        placeholder="Ej: Nuevo panel LED"
      />
      <DarkInput
        label="Meta (costo total)"
        value={form.meta || ""}
        onChange={e => setForm(f => ({ ...f, meta: e.target.value }))}
        type="number"
        prefix="S/"
        placeholder="0.00"
      />
      <DarkInput
        label="Ahorrado hasta ahora"
        value={form.actual || ""}
        onChange={e => setForm(f => ({ ...f, actual: e.target.value }))}
        type="number"
        prefix="S/"
        placeholder="0.00"
      />
      <DarkInput
        label="Fecha límite (opcional)"
        value={form.fecha || ""}
        onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
        type="date"
      />
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        {editItem && (
          <button
            onClick={() => {
              deleteItem("objetivos", editItem.id);
              closeModal();
            }}
            style={{
              flex: 1,
              padding: 13,
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 12,
              color: "#F87171",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              touchAction: "manipulation",
              fontFamily: "inherit",
            }}
          >
            Eliminar
          </button>
        )}
        <button
          onClick={() => saveItem("objetivos")}
          disabled={saving}
          style={{
            flex: 2,
            padding: 13,
            background: "#3B82F6",
            border: "none",
            borderRadius: 12,
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            touchAction: "manipulation",
            fontFamily: "inherit",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </CapModal>
  );

  // ━━ LAYOUT PRINCIPAL ━━
  return (
    <div style={{ paddingBottom: "calc(90px + env(safe-area-inset-bottom))", minHeight: "100%" }}>
      {/* ── Header ── */}
      <div style={{ padding: "20px 20px 0" }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: "#0F1729",
            letterSpacing: "-0.03em",
            marginBottom: 2,
          }}
        >
          Capital e Inversiones
        </div>
        <div style={{ fontSize: 12, color: "#64748B", marginBottom: 16 }}>
          Sistema financiero del negocio
        </div>

        {/* Tabs de sección — estilo Gastos: fondo oscuro elegante */}
        <div
          style={{
            display: "flex",
            background: "linear-gradient(135deg,#131F38,#0E1829)",
            border: "1px solid #1E3050",
            borderRadius: 14,
            padding: 4,
            marginBottom: 16,
            gap: 4,
          }}
        >
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setSection(t.id)}
              style={{
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                padding: "10px 0",
                borderRadius: 11,
                border: "none",
                fontFamily: "inherit",
                background: section === t.id ? T.accent : "transparent",
                color: section === t.id ? "#fff" : "rgba(180,210,255,0.5)",
                fontWeight: section === t.id ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
                touchAction: "manipulation",
                transition: "all .15s",
              }}
            >
              {t.icon && <span style={{ opacity: 0.85 }}>{t.icon}</span>}
              {t.label}
            </button>
          ))}
        </div>

      </div>

      {/* ── Contenido de sección ── */}
      <div style={{ padding: "0 20px" }}>
        {section === "patrimonio" && renderPatrimonio()}
        {section === "liquidez" && renderLiquidez()}
        {section === "activos" && renderActivos()}
        {section === "fondos" && renderFondos()}
        {section === "objetivos" && renderObjetivos()}
      </div>

      {/* ── Modales ── */}
      {modalCuenta}
      {modalCaja}
      {modalActivo}
      {modalFondos}
      {modalObjetivo}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ️ TRASH MODAL — archivos eliminados (papelera global)
// ══════════════════════════════════════════════════════════════════

export default Capital;
