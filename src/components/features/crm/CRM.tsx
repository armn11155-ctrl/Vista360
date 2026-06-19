// @ts-nocheck — legacy file: migrating to strict TypeScript gradually
import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
} from "react";
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
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import type { User } from "firebase/auth";

// ── Tipos e interfaces ────────────────────────────────────────────
import type { Panel, Cliente, Contrato, Gasto, Proveedor, Factura, Sueldo } from "../../../types";

// ── Servicios y utilidades ────────────────────────────────────────
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

// ── Componentes UI ────────────────────────────────────────────────
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
import { useVirtualList } from "../../../hooks/useVirtualList";
import { useIsDesktop } from "../../../hooks/useIsDesktop";

// ── Helper de campo de formulario (igual que en Paneles.tsx) ──────
function inp(label: string, key: string, form: any, setForm: any, opts: any = {}) {
  const { type = "text", options = [], ph = "" } = opts;
  const s: any = {
    width: "100%",
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    padding: "10px 13px",
    color: T.text,
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: T.muted,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {label}
      </label>
      {type === "select" ? (
        <select
          value={form[key] || ""}
          onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
          style={{ ...s, cursor: "pointer" }}
        >
          {options.map((o: string) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          value={form[key] || ""}
          onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
          placeholder={ph}
          rows={3}
          style={{ ...s, resize: "vertical" }}
        />
      ) : (
        <input
          type={type}
          value={form[key] || ""}
          onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
          placeholder={ph}
          style={s}
          autoCorrect={type === "email" ? "off" : undefined}
          autoCapitalize={type === "email" ? "none" : undefined}
          spellCheck={type === "email" ? false : undefined}
        />
      )}
    </div>
  );
}

function CRM({ clientes, setClientes, contratos, loading, onModalChange }: CRMProps) {
  const isDesktop = useIsDesktop();
  const [modal, setModal] = useState<Partial<Cliente> | null>(null);
  const [buscar, setBuscar] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 10;

  // ── Solicitudes web (leads del formulario público) ────────────────
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loadingSol, setLoadingSol] = useState(true);
  const [importando, setImportando] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    import("../../../config/firebase").then(({ db }) => {
      // Sin orderBy: un orderBy("createdAt") EXCLUYE silenciosamente los
      // documentos que no tengan ese campo (no es un error, Firestore
      // simplemente no los devuelve). Como el formulario de la web no
      // siempre lo manda, ordenamos en el cliente para no perder ninguno.
      unsub = onSnapshot(
        collection(db, "solicitudesWeb"),
        snap => {
          const items = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
          items.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
          });
          setSolicitudes(items);
          setLoadingSol(false);
        },
        () => setLoadingSol(false)
      );
    });
    return () => unsub?.();
  }, []);

  const importarSolicitud = async (sol: any) => {
    setImportando(sol.id);
    try {
      const payload = {
        tipo: "Prospecto",
        empresa: sol.empresa || "",
        contacto: sol.contacto || "",
        celular: sol.celular || "",
        email: sol.email || "",
        ruc: "",
        ciudad: "Huánuco",
        sector: "Otro",
        estado: "En contacto",
        notas: [
          sol.panelInteres ? `Panel de interés: ${sol.panelInteres}` : "",
          sol.notas ? `Notas web: ${sol.notas}` : "",
          "Origen: formulario web",
        ].filter(Boolean).join("\n"),
      };
      const r = await fb.post("clientes", payload);
      if (r) {
        setClientes(p => [...p, r]);
        // Marcar la solicitud como importada
        const { db } = await import("../../../config/firebase");
        await updateDoc(doc(db, "solicitudesWeb", sol.id), { importado: true, importadoEn: serverTimestamp() });
        toast.success(`${sol.empresa || sol.contacto} importado al CRM`);
      }
    } catch {
      toast.warn("Error al importar. Inténtalo de nuevo.");
    }
    setImportando(null);
  };

  const rechazarSolicitud = async (sol: any) => {
    if (!(await confirmAsync("Esta solicitud web quedará marcada como rechazada.", { title: "¿Rechazar solicitud?", ok: "Rechazar" }))) return;
    const { db } = await import("../../../config/firebase");
    await updateDoc(doc(db, "solicitudesWeb", sol.id), { importado: true, rechazado: true });
    toast.success("Solicitud rechazada");
  };

  const solPendientes = solicitudes.filter(s => !s.importado);
  const emptyC = {
    tipo: "Prospecto",
    empresa: "",
    contacto: "",
    celular: "",
    email: "",
    ruc: "",
    ciudad: "Lima",
    sector: "Alimentación",
    estado: "En contacto",
    notas: "",
  };
  const [form, setForm] = useState(emptyC);

  const openNew = () => {
    setForm(emptyC);
    setModal("nuevo");
    onModalChange?.(true);
  };
  const openEdit = r => {
    setForm({ ...r });
    setModal(r);
    onModalChange?.(true);
  };

  const guardar = async () => {
    const cliErr = validate.cliente(form as Record<string, unknown>);
    if (cliErr) return toast.warn(cliErr);
    setSaving(true);
    const payload = {
      tipo: form.tipo,
      empresa: form.empresa,
      contacto: form.contacto,
      celular: form.celular,
      email: form.email,
      ruc: form.ruc,
      ciudad: form.ciudad,
      sector: form.sector,
      estado: form.estado,
      notas: form.notas,
    };
    try {
      if (modal === "nuevo") {
        haptic("create");
        const r = await fb.post("clientes", payload);
        if (r?.id) {
          setClientes(p => {
            // Evitar duplicados si el snapshot de Firestore ya llegó
            if (p.some(x => x.id === r.id)) return p;
            return [...p, r];
          });
        } else {
          // Fallback: refrescar desde Firestore
          const fresh = await fb.get("clientes");
          setClientes(fresh);
        }
      } else {
        const r = await fb.patch("clientes", modal.id, payload);
        if (r?.id) {
          setClientes(p => p.map(x => (x.id === modal.id ? { ...x, ...r } : x)));
        } else {
          const fresh = await fb.get("clientes");
          setClientes(fresh);
        }
      }
      haptic("success");
      toast.success("Guardado correctamente");
      setModal(null);
      onModalChange?.(false);
    } catch (e: any) {
      haptic("error");
      toast.error("Error al guardar: " + (e?.message ?? "intenta de nuevo"));
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async id => {
    if (
      !(await confirmAsync("Podrás recuperarlo desde Firebase si fue un error.", {
        title: "¿Eliminar contacto?",
        danger: true,
        ok: "Sí, eliminar",
      }))
    )
      return;
    haptic("delete");
    await fb.del("clientes", id); // borrado lógico: deleted:true
    setClientes(p => p.filter(r => r.id !== id));
  };

  const wa = r => {
    const msg =
      r.tipo === "Cliente"
        ? `Hola ${r.contacto}, le contactamos desde Vista 360 para coordinar la renovación de su contrato. `
        : `Hola ${r.contacto}, somos Vista 360, paneles publicitarios en ${r.ciudad}. ¿Le interesaría conocer nuestras opciones? `;
    window.open(
      `https://wa.me/${r.celular?.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`,
      "_blank",
    );
  };

  const clis = clientes.filter(d => d.tipo === "Cliente");
  const pros = clientes.filter(d => d.tipo === "Prospecto");
  const propuestas = pros.filter(p => p.estado === "Propuesta enviada");

  const filters = ["Todos", "Clientes", "Prospectos", "Activos", "En riesgo"];
  const filtrado = useMemo(
    () =>
      clientes.filter(r => {
        const q = buscar.toLowerCase();
        const matchQ =
          !q ||
          [r.empresa, r.contacto, r.celular, r.ciudad].some(v => v?.toLowerCase().includes(q));
        const matchF =
          activeFilter === "Todos"
            ? true
            : activeFilter === "Clientes"
              ? r.tipo === "Cliente"
              : activeFilter === "Prospectos"
                ? r.tipo === "Prospecto"
                : activeFilter === "Activos"
                  ? r.estado === "Activo"
                  : r.estado === "Por vencer" || r.estado === "Inactivo";
        return matchQ && matchF;
      }),
    [clientes, buscar, activeFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filtrado.length / perPage));
  const paginated = filtrado.slice((page - 1) * perPage, page * perPage);

  // Sparkline SVG
  const SparklineMini = ({ color, data, width = 90, height = 38 }) => {
    const max = Math.max(...data),
      min = Math.min(...data);
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / (max - min || 1)) * (height - 4) - 2;
      return `${x},${y}`;
    });
    const linePath = `M${pts[0]} L${pts.slice(1).join(" L")}`;
    const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
    const id = `sp${color.replace("#", "")}`;
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${id})`} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={pts[pts.length - 1].split(",")[0]}
          cy={pts[pts.length - 1].split(",")[1]}
          r="3"
          fill={color}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
    );
  };

  // ── SPARKLINES CON DATOS REALES ─────────────────────────────────
  // Genera array de 12 puntos: acumulado de registros por mes
  // para los últimos 12 meses (mes actual incluido).
  //
  // Cómo funciona:
  //   1. Genera las 12 claves de mes: ["2024-06", "2024-07", ..., "2025-05"]
  //   2. Para cada registro busca su fecha de creación (createdAt viene de
  //      Firestore como Timestamp — se convierte a Date con .toDate()).
  //      Si no tiene createdAt, se asigna al mes actual como fallback.
  //   3. Cuenta cuántos registros del array tienen fecha <= fin de ese mes
  //      → acumulado real, la curva solo puede subir o mantenerse.
  const calcSparkline = registros => {
    // Genera las últimas 12 claves "YYYY-MM"
    const meses12 = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - (11 - i));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });

    // Convierte cada registro a una clave "YYYY-MM"
    const fechaRegistro = r => {
      if (!r.createdAt) return meses12[meses12.length - 1]; // fallback: mes actual
      const d = toDate(r.createdAt);
      if (isNaN(d.getTime())) return meses12[meses12.length - 1];
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };

    const fechas = registros.map(fechaRegistro);

    // Para cada mes del eje X cuenta cuántos registros tienen fecha <= ese mes
    return meses12.map(mes => fechas.filter(f => f <= mes).length);
  };

  // Sparklines de nuevos por mes para propuestas (más interesante ver el ritmo)
  const calcSparklineNuevosMes = registros => {
    const meses12 = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - (11 - i));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    const fechaRegistro = r => {
      if (!r.createdAt) return meses12[meses12.length - 1];
      const d = toDate(r.createdAt);
      if (isNaN(d.getTime())) return meses12[meses12.length - 1];
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };
    const fechas = registros.map(fechaRegistro);
    // Nuevos ese mes exacto (no acumulado)
    return meses12.map(mes => fechas.filter(f => f === mes).length);
  };

  const SPARK_CLI = calcSparkline(clis);
  const SPARK_PRO = calcSparkline(pros);
  const SPARK_PROP = calcSparklineNuevosMes(propuestas); // propuestas: ritmo mensual

  // Paleta compartida para avatares — solo azules/verdes/blanco · sin amarillo/morado
  const avatarPalette = [
    { from: T.accent, to: "#60A5FA", glow: "rgba(37,99,235,0.50)" },
    { from: "#059669", to: T.green, glow: "rgba(16,185,129,0.50)" },
    { from: "#1E40AF", to: "#3B82F6", glow: "rgba(59,130,246,0.50)" },
    { from: "#0EA5E9", to: "#7DD3FC", glow: "rgba(125,211,252,0.50)" },
    { from: "#DC2626", to: "#F87171", glow: "rgba(248,113,113,0.50)" },
    { from: T.cyan, to: "#22D3EE", glow: "rgba(34,211,238,0.50)" },
    { from: "#3730A3", to: "#6366F1", glow: "rgba(99,102,241,0.50)" },
    { from: "#475569", to: "#94A3B8", glow: "rgba(148,163,184,0.50)" },
    { from: "#1F2937", to: "#4B5563", glow: "rgba(75,85,99,0.50)" },
    { from: "#0D9488", to: "#2DD4BF", glow: "rgba(45,212,191,0.50)" },
  ];

  // EMPRESA — cuadrado redondeado con inicial, como en la foto
  const AvatarEmpresa = ({ name, size = 34 }) => {
    const initial = (name || "?")[0].toUpperCase();
    const pal = avatarPalette[(name || "?").charCodeAt(0) % avatarPalette.length];
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          flexShrink: 0,
          position: "relative",
          background: `linear-gradient(145deg,${pal.from},${pal.to})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.42,
          fontWeight: 800,
          color: "#fff",
          boxShadow: `0 0 0 1.5px ${pal.from}55, 0 0 ${size * 0.6}px ${pal.glow}, inset 0 1px 0 rgba(255,255,255,0.25)`,
          letterSpacing: "-0.5px",
          textShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 10,
            background: "linear-gradient(155deg,rgba(255,255,255,0.2) 0%,transparent 50%)",
            pointerEvents: "none",
          }}
        />
        {initial}
      </div>
    );
  };

  // CONTACTO — círculo con foto real o iniciales con glow, como en la foto
  const AvatarContacto = ({ name, size = 30 }) => {
    const initials = (name || "?")
      .split(" ")
      .map(w => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const pal = avatarPalette[(name || "?").charCodeAt(0) % avatarPalette.length];
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          flexShrink: 0,
          position: "relative",
          overflow: "hidden",
          background: `linear-gradient(145deg,${pal.from},${pal.to})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.36,
          fontWeight: 800,
          color: "#fff",
          boxShadow: `0 0 0 2px ${pal.from}55, 0 0 ${size * 0.55}px ${pal.glow}, inset 0 1px 0 rgba(255,255,255,0.28)`,
          letterSpacing: "-0.5px",
          textShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "linear-gradient(160deg,rgba(255,255,255,0.22) 0%,transparent 55%)",
            pointerEvents: "none",
          }}
        />
        {initials}
      </div>
    );
  };

  // Mantener AvatarCRM como alias de AvatarContacto para compatibilidad
  const AvatarCRM = ({ name, size = 32 }) => <AvatarContacto name={name} size={size} />;

  // Sin amarillo · "Por vencer" pasa a blanco (neutro)
  const estadoColorCRM = e =>
    ({
      Activo: T.green,
      "Por vencer": T.white,
      Inactivo: T.muted,
      "En contacto": T.accent,
      "Propuesta enviada": T.accent,
      Frío: T.muted,
      Perdido: T.red,
    })[e] || T.white;

  return (
    <div
      style={{
        background: T.bg,
        margin: "-20px -20px",
        minHeight: "100%",
        paddingBottom: "calc(120px + env(safe-area-inset-bottom))",
      }}
    >
      {/* ── TOP STRIP AZUL ── */}
      <div
        style={{
          background: "linear-gradient(180deg,#2563EB 0%,#2563EB 60%,#3B82F6 100%)",
          padding: "20px 20px 28px",
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          boxShadow: "0 8px 28px rgba(37,99,235,0.28)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.5)",
                fontWeight: 600,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              CRM · 8 Millas
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
              Clientes
            </div>
          </div>
          <button
            onClick={openNew}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "10px 18px",
              background: "#fff",
              border: "none",
              borderRadius: 50,
              color: T.accent,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              touchAction: "manipulation",
              fontFamily: "inherit",
              boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nuevo
          </button>
        </div>
        {/* Stats inline */}
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { label: "Clientes", val: clis.length, bg: "rgba(255,255,255,0.15)" },
            { label: "Prospectos", val: pros.length, bg: "rgba(255,255,255,0.1)" },
            { label: "Propuestas", val: propuestas.length, bg: "rgba(255,255,255,0.1)" },
            { label: "Total", val: clientes.length, bg: "rgba(255,255,255,0.1)" },
          ].map(({ label, val, bg }) => (
            <div
              key={label}
              style={{
                flex: 1,
                background: bg,
                borderRadius: 12,
                padding: "10px 8px",
                textAlign: "center",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                {val}
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: "rgba(255,255,255,0.6)",
                  marginTop: 4,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SEARCH ── */}
      <div style={{ padding: "14px 20px 10px", background: T.bg }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 14,
            padding: "11px 14px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94A3B8"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={buscar}
            onChange={e => {
              setBuscar(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar empresa, contacto, ciudad..."
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: 14,
              color: "#1E293B",
              background: "transparent",
              fontFamily: "inherit",
            }}
          />
          {buscar && (
            <button
              onClick={() => {
                setBuscar("");
                setPage(1);
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#94A3B8",
                display: "flex",
                padding: 0,
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── FILTROS ── */}
      <div
        style={{
          display: "flex",
          gap: 7,
          padding: "8px 20px 12px",
          background: T.bg,
          overflowX: "auto",
        }}
      >
        {filters.map(f => {
          const active = activeFilter === f;
          const dot = f === "Activos" ? T.green : f === "En riesgo" ? T.red : null;
          return (
            <button
              key={f}
              onClick={() => {
                setActiveFilter(f);
                setPage(1);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 14px",
                borderRadius: 99,
                flexShrink: 0,
                border: `1.5px solid ${active ? T.accent : T.border}`,
                background: active ? T.accent : "#fff",
                color: active ? "#fff" : T.muted,
                fontWeight: active ? 700 : 500,
                fontSize: 12,
                cursor: "pointer",
                touchAction: "manipulation",
                fontFamily: "inherit",
              }}
            >
              {dot && (
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: active ? "#fff" : dot,
                  }}
                />
              )}
              {f}
            </button>
          );
        })}
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: "#94A3B8",
            flexShrink: 0,
            alignSelf: "center",
            fontWeight: 600,
          }}
        >
          {filtrado.length}
        </span>
      </div>

      {/* ── LISTA DE CONTACTOS ── */}
      {loading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 200,
            gap: 10,
            color: T.muted,
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              border: "2px solid #E5E7EB",
              borderTopColor: T.accent,
              borderRadius: "50%",
              animation: "spin .7s linear infinite",
            }}
          />{" "}
          Cargando...
        </div>
      ) : (
        <div style={{ padding: "10px 20px", display: "grid", gridTemplateColumns: isDesktop ? "repeat(2, 1fr)" : "1fr", gap: 8 }}>
          {paginated.length === 0 ? (
            <div
              style={{
                background: "#fff",
                borderRadius: 20,
                padding: "48px 20px",
                textAlign: "center",
                border: "1px solid #E5E7EB",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background: "#EFF4FF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                  color: T.accent,
                }}
              >
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                >
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 12 }}>
                Sin resultados
              </div>
              <button
                onClick={openNew}
                style={{
                  background: T.accent,
                  border: "none",
                  borderRadius: 50,
                  padding: "9px 20px",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  touchAction: "manipulation",
                  fontFamily: "inherit",
                }}
              >
                + Agregar contacto
              </button>
            </div>
          ) : (
            paginated.map(r => {
              const tc = tCol(r.tipo);
              const ec = estadoColorCRM(r.estado);
              return (
                <div
                  key={r.id}
                  style={{
                    background: "#fff",
                    borderRadius: 18,
                    border: "1px solid #E5E7EB",
                    overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px -6px rgba(0,0,0,0.08)",
                  }}
                >
                  {/* Borde izquierdo de color tipo */}
                  <div style={{ display: "flex" }}>
                    <div
                      style={{ width: 4, background: tc, flexShrink: 0, borderRadius: "0 0 0 0" }}
                    />
                    <div style={{ flex: 1, padding: "14px 14px 12px" }}>
                      {/* Fila principal */}
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}
                      >
                        <AvatarEmpresa name={r.empresa} size={42} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: T.text,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {r.empresa}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#94A3B8",
                              marginTop: 2,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {r.ruc ? "RUC " + r.ruc : r.email || "—"}
                          </div>
                        </div>
                        <span
                          style={{
                            background: `${tc}18`,
                            border: `1px solid ${tc}40`,
                            color: tc,
                            borderRadius: 8,
                            padding: "3px 9px",
                            fontSize: 10,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {r.tipo}
                        </span>
                      </div>
                      {/* Chips */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            background: "#F8FAFC",
                            color: T.muted,
                            borderRadius: 6,
                            padding: "3px 8px",
                            fontSize: 10,
                            fontWeight: 600,
                            border: "1px solid #E5E7EB",
                          }}
                        >
                          <svg
                            width="9"
                            height="9"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                          >
                            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          {r.ciudad || "—"}
                        </span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            background: "#F8FAFC",
                            color: T.muted,
                            borderRadius: 6,
                            padding: "3px 8px",
                            fontSize: 10,
                            fontWeight: 600,
                            border: "1px solid #E5E7EB",
                          }}
                        >
                          <svg
                            width="9"
                            height="9"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                          >
                            <rect x="2" y="7" width="20" height="14" rx="2" />
                            <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
                          </svg>
                          {r.sector || "—"}
                        </span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            background: `${ec}12`,
                            border: `1px solid ${ec}30`,
                            color: ec,
                            borderRadius: 6,
                            padding: "3px 8px",
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          <div
                            style={{ width: 5, height: 5, borderRadius: "50%", background: ec }}
                          />
                          {r.estado}
                        </span>
                      </div>
                      {/* Footer: contacto + acciones */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <AvatarContacto name={r.contacto || "?"} size={26} />
                        <span
                          style={{
                            fontSize: 11,
                            color: "#94A3B8",
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.contacto || "—"}
                        </span>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button
                            onClick={() => wa(r)}
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 10,
                              background: "rgba(37,211,102,0.1)",
                              border: "1px solid rgba(37,211,102,0.2)",
                              color: "#25D366",
                              cursor: "pointer",
                              touchAction: "manipulation",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openEdit(r)}
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 10,
                              background: "#EFF4FF",
                              border: "1px solid #BFDBFE",
                              color: T.accent,
                              cursor: "pointer",
                              touchAction: "manipulation",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            >
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => eliminar(r.id)}
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 10,
                              background: "#FEF2F2",
                              border: "1px solid #FECACA",
                              color: T.red,
                              cursor: "pointer",
                              touchAction: "manipulation",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 4px",
              }}
            >
              <span style={{ fontSize: 11, color: "#94A3B8" }}>
                {Math.min((page - 1) * perPage + 1, filtrado.length)}–
                {Math.min(page * perPage, filtrado.length)} de {filtrado.length}
              </span>
              <div style={{ display: "flex", gap: 5 }}>
                {page > 1 && (
                  <button
                    onClick={() => setPage(p => p - 1)}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      border: "1px solid #E5E7EB",
                      cursor: "pointer",
                      background: "#fff",
                      color: T.muted,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
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
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                )}
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      border: `1px solid ${page === n ? T.accent : T.border}`,
                      cursor: "pointer",
                      background: page === n ? T.accent : "#fff",
                      color: page === n ? "#fff" : T.muted,
                      fontSize: 12,
                      fontWeight: page === n ? 700 : 400,
                      fontFamily: "inherit",
                    }}
                  >
                    {n}
                  </button>
                ))}
                {page < totalPages && (
                  <button
                    onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      border: "1px solid #E5E7EB",
                      cursor: "pointer",
                      background: "#fff",
                      color: T.muted,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
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
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL ── */}
      {modal && (
        <Modal
          title={modal === "nuevo" ? "Nuevo Contacto" : "Editar Contacto"}
          onClose={() => {
            setModal(null);
            onModalChange?.(false);
          }}
          onSave={guardar}
          saveLabel={saving ? "Guardando..." : "Guardar"}
        >
          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            {["Cliente", "Prospecto"].map(t => (
              <button
                key={t}
                onClick={() =>
                  setForm(f => ({
                    ...f,
                    tipo: t,
                    estado: t === "Cliente" ? "Activo" : "En contacto",
                  }))
                }
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  border: `2px solid ${form.tipo === t ? tCol(t) : T.border}`,
                  background: form.tipo === t ? tCol(t) + "22" : "transparent",
                  color: form.tipo === t ? tCol(t) : T.muted,
                  fontWeight: 700,
                  cursor: "pointer",
                  touchAction: "manipulation",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {inp("Empresa", "empresa", form, setForm, { ph: "Nombre de la empresa" })}
            {inp("Contacto", "contacto", form, setForm, { ph: "Nombre completo" })}
            {inp("Celular", "celular", form, setForm, { type: "tel", ph: "+51 999 000 000" })}
            {inp("Email", "email", form, setForm, { type: "email", ph: "correo@empresa.com" })}
            {form.tipo === "Cliente" && inp("RUC", "ruc", form, setForm, { ph: "20000000001" })}
            {inp("Ciudad", "ciudad", form, setForm, { type: "select", options: CIUDADES })}
            {inp("Sector", "sector", form, setForm, { type: "select", options: SECTORES })}
            {inp("Estado", "estado", form, setForm, {
              type: "select",
              options: form.tipo === "Cliente" ? ESTADOS_CLI : ESTADOS_PRO,
            })}
          </div>
          {inp("Notas", "notas", form, setForm, {
            type: "textarea",
            ph: "Observaciones, seguimiento...",
          })}
        </Modal>
      )}

      {/* ── LEADS / PROSPECTOS SECTION ── */}
      <div style={{ margin: "0 16px 8px" }}>
        {/* Header leads */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Leads</div>
            <div style={{ fontSize: 11, color: T.muted, fontWeight: 500 }}>
              {pros.length} prospecto{pros.length !== 1 ? "s" : ""} · {propuestas.length} con
              propuesta
            </div>
          </div>
          <button
            onClick={openNew}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: T.dark,
              border: "none",
              borderRadius: 50,
              padding: "10px 18px",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              touchAction: "manipulation",
              fontFamily: "inherit",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Agregar
          </button>
        </div>

        {/* Pipeline funnel cards */}
        {[
          { label: "En contacto", estado: "En contacto", color: "#3B82F6", bg: "#EFF6FF" },
          {
            label: "Propuesta enviada",
            estado: "Propuesta enviada",
            color: "#8B5CF6",
            bg: "#F5F3FF",
          },
          { label: "Frío", estado: "Frío", color: "#94A3B8", bg: "#F8FAFC" },
          { label: "Perdido", estado: "Perdido", color: T.red, bg: "#FEF2F2" },
        ].map(({ label, estado, color, bg }) => {
          const grupo = pros.filter(p => p.estado === estado);
          if (grupo.length === 0) return null;
          return (
            <div key={estado} style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  marginBottom: 5,
                  paddingLeft: 4,
                }}
              >
                {label} · {grupo.length}
              </div>
              {grupo.map(p => (
                <div
                  key={p.id}
                  onClick={() => openEdit(p)}
                  style={{
                    background: T.dark,
                    borderRadius: 16,
                    padding: "14px 16px",
                    marginBottom: 7,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: "pointer",
                    touchAction: "manipulation",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: color + "22",
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
                      stroke={color}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    >
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#fff",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {p.empresa}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>
                      {p.contacto || "Sin contacto"}
                      {p.ciudad ? " · " + p.ciudad : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {p.celular && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          const msg = `Hola ${p.contacto}, somos Vista 360, paneles publicitarios en ${p.ciudad}. ¿Le interesaría conocer nuestras opciones? `;
                          window.open(
                            `https://wa.me/${p.celular.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`,
                            "_blank",
                          );
                        }}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          background: "rgba(37,211,102,0.15)",
                          border: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          touchAction: "manipulation",
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                          <path d="M11.998 0C5.374 0 0 5.373 0 11.998c0 2.117.554 4.1 1.523 5.82L.057 23.52a.5.5 0 0 0 .598.641l5.882-1.542a11.943 11.943 0 0 0 5.46 1.319c6.625 0 12-5.374 12-12S18.623 0 11.998 0zm0 21.94a9.94 9.94 0 0 1-5.065-1.381l-.363-.215-3.758.985.999-3.649-.236-.374A9.943 9.943 0 0 1 2.06 11.998c0-5.479 4.46-9.94 9.939-9.94 5.478 0 9.939 4.461 9.939 9.94 0 5.478-4.461 9.94-9.94 9.94z" />
                        </svg>
                      </button>
                    )}
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        {/* Si no hay prospectos */}
        {pros.length === 0 && (
          <div
            style={{
              background: T.dark,
              borderRadius: 20,
              padding: "28px 20px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>
              Sin prospectos aún. Agrega tu primer lead.
            </div>
            <button
              onClick={openNew}
              style={{
                background: T.accent,
                border: "none",
                borderRadius: 50,
                padding: "10px 22px",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                touchAction: "manipulation",
                fontFamily: "inherit",
              }}
            >
              + Agregar prospecto
            </button>
          </div>
        )}

        {/* ── SOLICITUDES WEB (formulario de contacto) ── */}
        {(loadingSol || solPendientes.length > 0) && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div
                style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#3B82F6",
                  boxShadow: "0 0 0 3px rgba(59,130,246,0.2)",
                }}
              />
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>
                Solicitudes del sitio web
              </div>
              {solPendientes.length > 0 && (
                <span
                  style={{
                    background: "#EFF6FF",
                    color: "#3B82F6",
                    border: "1px solid #BFDBFE",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 99,
                  }}
                >
                  {solPendientes.length} nueva{solPendientes.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {loadingSol ? (
              <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 14, padding: 16, textAlign: "center", fontSize: 12, color: "#3B82F6" }}>
                Cargando solicitudes…
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {solPendientes.map(sol => (
                  <div
                    key={sol.id}
                    style={{
                      background: "#EFF6FF",
                      border: "1px solid #BFDBFE",
                      borderRadius: 16,
                      padding: "14px 16px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                      <div
                        style={{
                          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                          background: T.dark,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontWeight: 800, fontSize: 15,
                        }}
                      >
                        {(sol.empresa || sol.contacto || "?")[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {sol.empresa || "Sin empresa"}
                        </div>
                        <div style={{ fontSize: 12, color: "#3B82F6", marginTop: 1, fontWeight: 600 }}>
                          {sol.contacto || "—"} · {sol.celular || "—"}
                        </div>
                        {sol.email && (
                          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                            {sol.email}
                          </div>
                        )}
                        {sol.panelInteres && (
                          <div style={{ fontSize: 11, color: "#3B82F6", marginTop: 4, fontStyle: "italic" }}>
                            Interés: {sol.panelInteres}
                          </div>
                        )}
                        {sol.notas && (
                          <div style={{ fontSize: 11, color: T.muted, marginTop: 2, fontStyle: "italic" }}>
                            {sol.notas}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: T.muted, marginTop: 4, fontWeight: 500 }}>
                          🌐 Formulario web · {sol.createdAt?.toDate ? sol.createdAt.toDate().toLocaleDateString("es-PE") : "—"}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => importarSolicitud(sol)}
                        disabled={importando === sol.id}
                        style={{
                          flex: 1,
                          background: importando === sol.id ? "#1E293B" : T.dark,
                          border: "none", borderRadius: 10, padding: "9px 12px",
                          color: "#fff", fontSize: 12, fontWeight: 700,
                          cursor: importando === sol.id ? "not-allowed" : "pointer",
                          touchAction: "manipulation", fontFamily: "inherit",
                        }}
                      >
                        {importando === sol.id ? "Importando…" : "✓ Importar al CRM"}
                      </button>
                      <button
                        onClick={() => rechazarSolicitud(sol)}
                        style={{
                          background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)",
                          borderRadius: 10, padding: "9px 14px",
                          color: "#DC2626", fontSize: 12, fontWeight: 700,
                          cursor: "pointer", touchAction: "manipulation", fontFamily: "inherit",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════

export default CRM;
