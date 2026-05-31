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
  orderBy,
  query,
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
  getCarasPanel,
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

function Contratos({
  contratos,
  setContratos,
  paneles,
  clientes,
  loading,
  setTab,
  onModalChange,
}: ContratosProps) {
  const [filtro, setFiltro] = useState("Activos");
  const [modal, setModal] = useState<Partial<Contrato> | null>(null);
  const [saving, setSaving] = useState(false);
  const closeBackdropRef = useRef(false);
  const modalOpenedAt = useRef(0);
  const sheetTouchedAt = useRef(0);
  const emptyC = { panel_id: "", cliente_id: "", cara: "", inicio: "", fin: "", monto: "", pagosMeses: {} };
  const [form, setForm] = useState(emptyC);

  // Generar lista de meses entre dos fechas
  const generarMeses = (inicio, fin) => {
    if (!inicio || !fin) return [];
    const meses = [];
    const ini = new Date(inicio + "T12:00:00");
    const fnl = new Date(fin + "T12:00:00");
    let cur = new Date(ini.getFullYear(), ini.getMonth(), 1);
    while (cur <= fnl) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
      const label = cur.toLocaleDateString("es-PE", { month: "short", year: "numeric" });
      meses.push({ key, label });
      cur.setMonth(cur.getMonth() + 1);
    }
    return meses;
  };

  const mesesForm = generarMeses(form.inicio, form.fin);

  const toggleMesPago = key => {
    setForm(f => ({ ...f, pagosMeses: { ...f.pagosMeses, [key]: !f.pagosMeses[key] } }));
  };

  const datos = contratos
    .filter(c => !c.deleted)
    .map(c => ({
      ...c,
      d: dias(c.fin),
      panel: paneles.find(p => p.id === c.panel_id) || {
        nombre: "Panel eliminado",
        id: c.panel_id,
      },
      cliente: clientes.find(cl => cl.id === c.cliente_id) || {
        nombre: "Cliente eliminado",
        contacto: "",
        id: c.cliente_id,
      },
    }));
  const datosEliminados = contratos
    .filter(c => c.deleted)
    .map(c => ({
      ...c,
      d: dias(c.fin),
      panel: paneles.find(p => p.id === c.panel_id) || {
        nombre: "Panel eliminado",
        id: c.panel_id,
      },
      cliente: clientes.find(cl => cl.id === c.cliente_id) || {
        nombre: "Cliente eliminado",
        contacto: "",
        id: c.cliente_id,
      },
    }));

  let fil: typeof datos;
  if (filtro === "Eliminados")
    fil = datosEliminados.sort(
      (a, b) => new Date(b.deletedAt || 0).getTime() - new Date(a.deletedAt || 0).getTime(),
    );
  else if (filtro === "Activos") fil = datos.filter(c => c.d > 0).sort((a, b) => a.d - b.d);
  else fil = datos.filter(c => c.d > 0 && c.d <= 60).sort((a, b) => a.d - b.d);

  // Paginación — 8 contratos por página para que las cards oscuras no saturen el scroll
  const {
    page: cPage,
    setPage: setCPage,
    totalPages: cTotalPages,
    paginated: filPaged,
    total: filTotal,
    pageSize: cPageSize,
  } = usePagination(fil, 8);

  const activos = datos.filter(c => c.d > 0).length;
  const porVencer = datos.filter(c => c.d > 0 && c.d <= 60).length;
  const historicos = datos.filter(c => c.d <= 0).length;
  const eliminadosCount = datosEliminados.length;

  const openNew = () => {
    modalOpenedAt.current = Date.now();
    closeBackdropRef.current = false;
    setForm(emptyC);
    setModal("nuevo");
    onModalChange?.(true);
  };
  const openEdit = c => {
    modalOpenedAt.current = Date.now();
    closeBackdropRef.current = false;
    const pm = c.pagosMeses || {};
    setForm({
      panel_id: c.panel_id,
      cliente_id: c.cliente_id,
      cara: c.cara || "",
      inicio: c.inicio || "",
      fin: c.fin || "",
      monto: c.monto || "",
      pagosMeses: pm,
    });
    setModal(c);
    onModalChange?.(true);
  };

  const guardar = async () => {
    const contratoErr = validate.contrato(form as Record<string, unknown>);
    if (contratoErr) return toast.warn(contratoErr);
    setSaving(true);
    const meses = generarMeses(form.inicio, form.fin);
    const pagosMeses = form.pagosMeses || {};
    const pagado = pagosMeses[meses[0]?.key] || false;
    const cara = form.cara || null;
    const payloadFull = {
      panel_id: form.panel_id,
      cliente_id: form.cliente_id,
      cara,
      inicio: form.inicio,
      fin: form.fin,
      monto: Number(form.monto),
      pagado,
      pagosMeses,
    };
    const payloadSimple = {
      panel_id: form.panel_id,
      cliente_id: form.cliente_id,
      cara,
      inicio: form.inicio,
      fin: form.fin,
      monto: Number(form.monto),
      pagado,
    };
    try {
      let r;
      if (modal === "nuevo") {
        try {
          [r] = await fb.post("contratos", payloadFull);
        } catch (e) {
          console.warn("[Contrato] payloadFull rechazado, usando payloadSimple:", e);
          [r] = await fb.post("contratos", payloadSimple);
        }
        if (r) setContratos(p => [...p, { ...r, pagosMeses }]);
      } else {
        try {
          [r] = await fb.patch("contratos", modal.id, payloadFull);
        } catch (e) {
          console.warn("[Contrato] patch payloadFull rechazado, usando payloadSimple:", e);
          [r] = await fb.patch("contratos", modal.id, payloadSimple);
        }
        if (r) setContratos(p => p.map(x => (x.id === modal.id ? { ...r, pagosMeses } : x)));
      }
      setModal(null);
      onModalChange?.(false);
      // Quedarse en contratos para que el usuario vea el contrato creado
    } catch (e) {
      toast.error("Error al guardar: " + e.message);
    }
    setSaving(false);
  };

  const eliminar = async id => {
    if (
      !(await confirmAsync("Podrás restaurarlo desde la papelera.", {
        title: "¿Mover a papelera?",
        ok: "Mover",
        cancel: "Cancelar",
      }))
    )
      return;
    await fb.del("contratos", id); // soft delete: deleted:true
    setContratos(p =>
      p.map(c => (c.id === id ? { ...c, deleted: true, deletedAt: new Date().toISOString() } : c)),
    );
  };

  const eliminarPermanente = async id => {
    if (
      !(await confirmAsync("Esta acción NO se puede deshacer.", {
        title: "¿Eliminar definitivamente?",
        danger: true,
        ok: "Sí, eliminar",
      }))
    )
      return;
    await fb.del("contratos", id, { hardDelete: true });
    setContratos(p => p.filter(c => c.id !== id));
  };

  const restaurar = async id => {
    await fb.patch("contratos", id, { deleted: false, deletedAt: null });
    setContratos(p => p.map(c => (c.id === id ? { ...c, deleted: false, deletedAt: null } : c)));
  };

  // Toggle pago mes desde la tarjeta (sin abrir modal)
  const togglePagoRapido = async (contrato, key) => {
    const pm = { ...(contrato.pagosMeses || {}), [key]: !(contrato.pagosMeses || {})[key] };
    const pagado = pm[generarMeses(contrato.inicio, contrato.fin)[0]?.key] || false;
    const [r] = await fb.patch("contratos", contrato.id, { pagosMeses: pm, pagado });
    if (r)
      setContratos(p => p.map(x => (x.id === contrato.id ? { ...x, pagosMeses: pm, pagado } : x)));
  };

  const F = FieldGroup;
  const inp = {
    width: "100%",
    background: T.bg,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    padding: "10px 13px",
    color: T.text,
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };
  const sel = { ...inp, cursor: "pointer", touchAction: "manipulation" };

  const pagosMarcados = Object.values(form.pagosMeses || {}).filter(Boolean).length;

  return (
    <div>
      {modal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 400,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onPointerDown={e => {
            closeBackdropRef.current = e.target === e.currentTarget;
          }}
          onClick={e => {
            // Protección contra "ghost click": ignora clicks en los primeros 500ms
            // tras abrir el modal (iOS dispara un click retrasado del botón que abrió el modal).
            if (Date.now() - modalOpenedAt.current < 500) return;
            // Protección contra picker nativo (select, fecha): si el usuario tocó
            // la lámina del modal hace <900ms, ignora el click — es un click sintético
            // disparado al cerrar el picker de iOS, no una intención real de cerrar.
            if (Date.now() - sheetTouchedAt.current < 900) return;
            if (closeBackdropRef.current) {
              closeBackdropRef.current = false;
              setModal(null);
              onModalChange?.(false);
            }
          }}
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
              boxShadow: "0 -10px 40px rgba(0,0,0,0.45)",
            }}
            onPointerDown={e => {
              sheetTouchedAt.current = Date.now();
              e.stopPropagation();
            }}
            onPointerUp={e => {
              sheetTouchedAt.current = Date.now();
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle iOS */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border }} />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <span style={{ fontSize: 17, fontWeight: 800, color: T.text }}>
                {modal === "nuevo" ? "Nuevo Contrato" : "Editar Contrato"}
              </span>
              <button
                onClick={() => {
                  setModal(null);
                  onModalChange?.(false);
                }}
                style={{
                  background: T.border,
                  border: "none",
                  borderRadius: "50%",
                  width: 30,
                  height: 30,
                  color: T.muted,
                  cursor: "pointer",
                  touchAction: "manipulation",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              ></button>
            </div>

            <F label="Panel *">
              <select
                value={form.panel_id}
                onChange={e => setForm(f => ({ ...f, panel_id: e.target.value }))}
                onPointerDown={e => e.stopPropagation()}
                style={sel}
              >
                <option value="">— Selecciona un panel —</option>
                {paneles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.foto} {p.nombre} · {p.ciudad} · {p.estado}
                  </option>
                ))}
              </select>
            </F>

            {/* ── Selector de cara — solo para Unipolares (2 caras) ── */}
            {(() => {
              const selPanel = paneles.find(p => p.id === form.panel_id);
              const numCaras = getCarasPanel(selPanel?.tipo || "");
              if (numCaras < 2) return null;
              return (
                <F label="Cara del panel *">
                  <div style={{ display: "flex", gap: 10 }}>
                    {(["A", "B"] as const).map(cara => {
                      const active = form.cara === cara;
                      return (
                        <button
                          key={cara}
                          type="button"
                          onPointerDown={e => e.stopPropagation()}
                          onClick={() => setForm(f => ({ ...f, cara }))}
                          style={{
                            flex: 1,
                            padding: "12px 0",
                            borderRadius: 12,
                            border: active ? "none" : `1.5px solid ${T.border}`,
                            background: active ? T.accent : T.surface,
                            color: active ? "#fff" : T.muted,
                            fontWeight: 800,
                            fontSize: 18,
                            cursor: "pointer",
                            touchAction: "manipulation",
                            fontFamily: "inherit",
                          }}
                        >
                          Cara {cara}
                        </button>
                      );
                    })}
                  </div>
                  {!form.cara && (
                    <div style={{ fontSize: 11, color: T.red, marginTop: 4 }}>
                      Selecciona la cara que se va a arrendar
                    </div>
                  )}
                </F>
              );
            })()}

            <F label="Cliente *">
              <select
                value={form.cliente_id}
                onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
                onPointerDown={e => e.stopPropagation()}
                style={sel}
              >
                <option value="">— Selecciona un cliente —</option>
                {clientes
                  .filter(c => c.tipo === "Cliente")
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.empresa} · {c.contacto}
                    </option>
                  ))}
              </select>
            </F>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <F label="Fecha inicio *">
                <input
                  type="date"
                  value={form.inicio}
                  onChange={e => setForm(f => ({ ...f, inicio: e.target.value, pagosMeses: {} }))}
                  onPointerDown={e => e.stopPropagation()}
                  style={{
                    ...inp,
                    colorScheme: "light",
                    cursor: "pointer",
                    touchAction: "manipulation",
                    fontSize: 16,
                  }}
                />
              </F>
              <F label="Fecha fin *">
                <input
                  type="date"
                  value={form.fin}
                  onChange={e => setForm(f => ({ ...f, fin: e.target.value, pagosMeses: {} }))}
                  onPointerDown={e => e.stopPropagation()}
                  style={{
                    ...inp,
                    colorScheme: "light",
                    cursor: "pointer",
                    touchAction: "manipulation",
                    fontSize: 16,
                  }}
                />
              </F>
            </div>

            <F label="Monto mensual (S/) *">
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
                value={form.monto}
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9.]/g, "");
                  setForm(f => ({ ...f, monto: v }));
                }}
                onPointerDown={e => e.stopPropagation()}
                placeholder="Ej: 1500"
                style={{ ...inp, fontSize: 16 }}
              />
            </F>

            {/* PAGOS POR MES */}
            {mesesForm.length > 0 && (
              <F label={`Pagos por mes (${pagosMarcados}/${mesesForm.length} pagados)`}>
                <div
                  style={{
                    background: T.bg,
                    borderRadius: 12,
                    padding: 14,
                    border: `1px solid ${T.border}`,
                  }}
                >
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>
                    Toca cada mes para marcarlo como{" "}
                    <strong style={{ color: T.green }}>Pagado</strong> o{" "}
                    <strong style={{ color: T.red }}>Pendiente</strong>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                    {mesesForm.map((m, i) => {
                      const pagado = form.pagosMeses[m.key] || false;
                      return (
                        <button
                          key={m.key}
                          onClick={() => toggleMesPago(m.key)}
                          style={{
                            padding: "10px 6px",
                            borderRadius: 10,
                            border: `2px solid ${pagado ? T.green : T.border}`,
                            background: pagado ? T.green + "22" : T.surface,
                            cursor: "pointer",
                            touchAction: "manipulation",
                            transition: "background .08s",
                            textAlign: "center",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              color: T.muted,
                              marginBottom: 3,
                              fontWeight: 600,
                            }}
                          >
                            Mes {i + 1}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: pagado ? T.green : T.muted,
                              marginBottom: 4,
                            }}
                          >
                            {m.label}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: pagado ? T.green : T.red,
                              background: pagado ? T.green + "18" : T.red + "18",
                              borderRadius: 6,
                              padding: "3px 6px",
                            }}
                          >
                            {pagado ? "Pagado" : "○ Pendiente"}
                          </div>
                          {form.monto && (
                            <div style={{ fontSize: 10, color: T.muted, marginTop: 3 }}>
                              {fmt(form.monto)}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {mesesForm.length > 0 && form.monto && (
                    <div
                      style={{
                        marginTop: 12,
                        paddingTop: 10,
                        borderTop: `1px solid ${T.border}`,
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: T.muted }}>Total cobrado:</span>
                      <span style={{ fontWeight: 800, color: T.green }}>
                        {fmt(pagosMarcados * Number(form.monto))}
                      </span>
                      <span style={{ color: T.muted }}>Por cobrar:</span>
                      <span style={{ fontWeight: 800, color: T.red }}>
                        {fmt((mesesForm.length - pagosMarcados) * Number(form.monto))}
                      </span>
                    </div>
                  )}
                </div>
              </F>
            )}

            {!form.inicio || !form.fin ? (
              <div
                style={{
                  textAlign: "center",
                  fontSize: 12,
                  color: T.muted,
                  padding: "10px 0",
                  marginBottom: 16,
                }}
              >
                Selecciona las fechas para ver los meses de pago
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button
                onClick={() => {
                  setModal(null);
                  onModalChange?.(false);
                }}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 12,
                  border: `1px solid ${T.border}`,
                  background: "transparent",
                  color: T.muted,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  touchAction: "manipulation",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={saving}
                style={{
                  flex: 2,
                  padding: "12px",
                  borderRadius: 12,
                  border: "none",
                  background: T.accent,
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: "pointer",
                  touchAction: "manipulation",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Guardando..." : modal === "nuevo" ? "Crear Contrato" : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER CARD: Contratos ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 18,
          padding: "20px 16px 0",
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 13,
            background: "rgba(37,99,235,0.18)",
            border: "1px solid rgba(99,140,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#60A5FA"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="9" y1="17" x2="13" y2="17" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ fontSize: 20, fontWeight: 800, color: "#0F1729", letterSpacing: "-0.02em" }}
          >
            Contratos
          </div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 1 }}>
            {contratos.filter(c => !c.deleted).length} contratos · {activos} activos
          </div>
        </div>
        <button
          onClick={openNew}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: T.accent,
            border: "none",
            borderRadius: 13,
            padding: "10px 16px",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            touchAction: "manipulation",
            boxShadow: "0 6px 18px rgba(37,99,235,0.4)",
          }}
        >
          <svg
            width="16"
            height="16"
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

      {/* ── FILTER PILLS ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 8,
          marginBottom: 18,
          padding: "14px 16px 0",
        }}
      >
        {[
          {
            label: "Activos",
            count: activos,
            icon: (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ),
          },
          {
            label: "Por vencer",
            count: porVencer,
            icon: (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <polyline points="12 7 12 12 15.5 14" />
              </svg>
            ),
          },
          {
            label: "Eliminados",
            count: eliminadosCount,
            icon: (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
              </svg>
            ),
          },
        ].map(f => {
          const isActive = filtro === f.label;
          const isTrash = f.label === "Eliminados";
          const activeGradient = isTrash
            ? "linear-gradient(135deg,#7F1D1D,#991B1B)"
            : "linear-gradient(135deg,#0F1729,#1E3A8A)";
          const inactiveIconBg = isTrash ? "rgba(239,68,68,0.10)" : "#EFF4FF";
          const inactiveIconColor = isTrash ? "#EF4444" : "#2563EB";
          const inactiveTextColor = isTrash ? "#EF4444" : "#2563EB";
          return (
            <button
              key={f.label}
              onClick={() => setFiltro(f.label)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "12px 6px",
                borderRadius: 16,
                background: isActive ? activeGradient : "#FFFFFF",
                border: `1px solid ${isActive ? "transparent" : "#E5E7EB"}`,
                color: isActive ? "#fff" : inactiveTextColor,
                fontWeight: isActive ? 700 : 600,
                fontSize: 12,
                cursor: "pointer",
                touchAction: "manipulation",
                boxShadow: isActive
                  ? "0 4px 16px rgba(15,23,41,0.35)"
                  : "0 1px 4px rgba(15,23,41,0.06)",
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: isActive ? "rgba(255,255,255,0.18)" : inactiveIconBg,
                  color: isActive ? "#fff" : inactiveIconColor,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {f.icon}
              </span>
              <span>{f.label}</span>
              {f.count > 0 && (
                <span
                  style={{
                    minWidth: 20,
                    padding: "1px 7px",
                    borderRadius: 999,
                    background: isActive ? "rgba(255,255,255,0.22)" : inactiveIconBg,
                    color: isActive ? "#fff" : inactiveIconColor,
                    fontSize: 11,
                    fontWeight: 700,
                    textAlign: "center",
                  }}
                >
                  {f.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <SkeletonContratos />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "0 16px 32px" }}>
          {/* Banner de papelera */}
          {filtro === "Eliminados" && fil.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 16,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#F87171"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span style={{ fontSize: 13, color: "#FCA5A5", fontWeight: 600, flex: 1 }}>
                La ️ papelera es permanente — usa el botón rojo para eliminar definitivamente o
                restaura el contrato.
              </span>
            </div>
          )}
          {filPaged.map(c => {
            const msg =
              filtro !== "Eliminados"
                ? encodeURIComponent(
                    `Hola ${c.cliente?.contacto}, le recordamos que su contrato para *${c.panel?.nombre}* vence el *${fmtF(c.fin)}*. ¿Le interesa renovar? `,
                  )
                : "";
            const meses = generarMeses(c.inicio, c.fin);
            const pm = c.pagosMeses || {};
            const pagados = meses.filter(m => pm[m.key]).length;
            const dRest = c.d;
            // Siempre azul — color fijo de la card
            const accentCard = "#3B82F6";
            const borderCard = "rgba(59,130,246,0.22)";

            const card = (
              <div
                style={{
                  background: "linear-gradient(160deg,#131F3E 0%,#0D1629 55%,#0A1120 100%)",
                  borderRadius: 22,
                  border: `1px solid ${borderCard}`,
                  boxShadow: `0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)`,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                {/* ── Acento lateral ── */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    background: `linear-gradient(180deg,${accentCard}CC 0%,${accentCard}22 100%)`,
                    borderRadius: "22px 0 0 22px",
                  }}
                />

                {/* ── CABECERA: Panel + Monto ── */}
                <div style={{ padding: "18px 18px 14px 20px", position: "relative" }}>
                  {/* Ondas decorativas de fondo */}
                  <svg
                    viewBox="0 0 380 110"
                    preserveAspectRatio="xMidYMid slice"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      opacity: 0.22,
                      pointerEvents: "none",
                    }}
                  >
                    {[0, 1, 2, 3, 4].map(i => {
                      const t = i / 4;
                      return (
                        <path
                          key={i}
                          d={`M${360 - t * 60} ${110} C ${280 - t * 40} ${70} ${200 - t * 30} ${40} ${80 - t * 20} ${20} S ${-20 + t * 10} ${10} ${-40} ${30}`}
                          fill="none"
                          stroke={accentCard}
                          strokeWidth="0.8"
                          opacity={0.3 + t * 0.4}
                        />
                      );
                    })}
                  </svg>

                  <div
                    style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}
                  >
                    {/* Avatar panel */}
                    <div
                      style={{
                        width: 58,
                        height: 58,
                        borderRadius: 16,
                        flexShrink: 0,
                        background: `linear-gradient(135deg,${accentCard}33,${accentCard}11)`,
                        border: `1.5px solid ${accentCard}44`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 28,
                        boxShadow: `0 6px 20px rgba(0,0,0,0.4), 0 0 0 4px ${accentCard}10`,
                      }}
                    >
                      {c.panel?.foto || ""}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 800,
                          color: T.white,
                          letterSpacing: "-0.02em",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          marginBottom: 3,
                        }}
                      >
                        {c.panel?.nombre || "Panel eliminado"}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(200,215,255,0.70)",
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c.cliente?.empresa || "—"} · {c.cliente?.contacto || "—"}
                      </div>
                      {/* Badge vencimiento */}
                      <div style={{ marginTop: 7 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#93C5FD",
                            background: "rgba(59,130,246,0.18)",
                            border: "1px solid rgba(59,130,246,0.35)",
                            borderRadius: 99,
                            padding: "3px 9px",
                          }}
                        >
                          <span
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: "50%",
                              background: "#3B82F6",
                              display: "inline-block",
                              flexShrink: 0,
                            }}
                          />
                          {dRest > 0
                            ? `Vence en ${dRest} día${dRest === 1 ? "" : "s"}`
                            : dRest === 0
                              ? "Vence hoy"
                              : "Finalizado"}
                        </span>
                      </div>
                    </div>

                    {/* Monto */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 900,
                          color: T.white,
                          letterSpacing: "-0.03em",
                          lineHeight: 1,
                        }}
                      >
                        {fmt(c.monto)}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "rgba(200,215,255,0.55)",
                          fontWeight: 600,
                          marginTop: 2,
                        }}
                      >
                        /mes
                      </div>
                      <div
                        style={{ fontSize: 12, fontWeight: 800, color: "#34D399", marginTop: 5 }}
                      >
                        {fmt(pagados * Number(c.monto))} cobrado
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── SEPARATOR ── */}
                <div
                  style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "0 18px" }}
                />

                {/* ── FECHAS + ACCIONES ── */}
                <div
                  style={{
                    padding: "12px 18px 12px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  {/* Date pill */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 10,
                      padding: "7px 11px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "rgba(240,245,255,0.90)",
                      flexShrink: 0,
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
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="5" width="18" height="16" rx="2" />
                      <path d="M3 10h18" />
                      <path d="M8 3v4M16 3v4" />
                    </svg>
                    {fmtF(c.inicio)} → {fmtF(c.fin)}
                  </div>

                  {/* Meses pill */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      background: "rgba(59,130,246,0.12)",
                      border: "1px solid rgba(59,130,246,0.28)",
                      borderRadius: 10,
                      padding: "7px 11px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#BFDBFE",
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
                      strokeLinejoin="round"
                    >
                      <rect x="2" y="6" width="20" height="14" rx="2" />
                      <path d="M2 11h20" />
                    </svg>
                    {pagados}/{meses.length} meses
                  </div>

                  <div style={{ flex: 1 }} />

                  {/* Botones acción */}
                  {filtro === "Eliminados" ? (
                    <>
                      <button
                        onClick={() => restaurar(c.id)}
                        title="Restaurar"
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          border: "1px solid rgba(16,185,129,0.3)",
                          background: "rgba(16,185,129,0.10)",
                          cursor: "pointer",
                          touchAction: "manipulation",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#34D399",
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74" />
                          <path d="M3 3v4h4" />
                        </svg>
                      </button>
                      <button
                        onClick={() => eliminarPermanente(c.id)}
                        title="Eliminar definitivamente"
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          border: "1px solid rgba(239,68,68,0.35)",
                          background: "rgba(239,68,68,0.10)",
                          cursor: "pointer",
                          touchAction: "manipulation",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#FCA5A5",
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <line x1="4" y1="4" x2="20" y2="20" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Editar */}
                      <button
                        onClick={() => openEdit(c)}
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.14)",
                          background: "rgba(255,255,255,0.08)",
                          cursor: "pointer",
                          touchAction: "manipulation",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "rgba(240,245,255,0.85)",
                        }}
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                      </button>
                      {/* WhatsApp */}
                      <a
                        href={`https://wa.me/${c.cliente.celular?.replace(/\D/g, "")}?text=${msg}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          border: "1px solid rgba(37,211,102,0.35)",
                          background: "rgba(37,211,102,0.11)",
                          cursor: "pointer",
                          touchAction: "manipulation",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          textDecoration: "none",
                        }}
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 32 32"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M16 2C8.268 2 2 8.268 2 16c0 2.442.642 4.735 1.762 6.726L2 30l7.472-1.731A13.94 13.94 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2z"
                            fill="#25D366"
                          />
                          <path
                            d="M23.004 19.47c-.355-.177-2.1-1.035-2.424-1.154-.323-.118-.558-.177-.793.177-.236.354-.912 1.154-1.118 1.39-.207.236-.413.265-.768.089-.354-.177-1.497-.552-2.851-1.76-1.054-.94-1.765-2.1-1.972-2.455-.206-.354-.022-.545.155-.721.16-.16.355-.413.532-.62.177-.206.236-.354.354-.59.119-.235.06-.442-.029-.62-.09-.177-.793-1.912-1.087-2.618-.286-.688-.577-.595-.793-.606l-.676-.012c-.235 0-.62.088-.944.442-.324.354-1.236 1.208-1.236 2.944s1.265 3.416 1.442 3.652c.177.235 2.49 3.803 6.032 5.33.844.364 1.502.582 2.015.745.847.27 1.618.231 2.228.14.679-.1 2.1-.858 2.396-1.687.295-.83.295-1.54.207-1.687-.088-.147-.324-.236-.679-.413z"
                            fill="#fff"
                          />
                        </svg>
                      </a>
                    </>
                  )}
                </div>

                {/* ── LISTA DE PAGOS ── */}
                {meses.length > 0 && (
                  <>
                    <div
                      style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "0 18px" }}
                    />
                    <div
                      style={{
                        padding: "10px 18px 16px 20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {meses.map(m => {
                        const pag = pm[m.key] || false;
                        return (
                          <button
                            key={m.key}
                            onClick={() => togglePagoRapido(c, m.key)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              padding: "11px 13px",
                              borderRadius: 13,
                              background: pag ? "rgba(16,185,129,0.10)" : "rgba(255,255,255,0.05)",
                              border: `1px solid ${pag ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.09)"}`,
                              cursor: "pointer",
                              touchAction: "manipulation",
                              textAlign: "left",
                              width: "100%",
                              fontFamily: "inherit",
                              transition: "background .15s",
                            }}
                          >
                            {/* Círculo check */}
                            <span
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: "50%",
                                flexShrink: 0,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: pag ? T.green : "transparent",
                                border: pag ? "none" : "1.5px solid rgba(255,255,255,0.25)",
                              }}
                            >
                              {pag && (
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="#fff"
                                  strokeWidth="3.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </span>
                            <span
                              style={{
                                flex: 1,
                                fontSize: 14,
                                fontWeight: 700,
                                color: pag ? "#6EE7B7" : "rgba(240,245,255,0.92)",
                              }}
                            >
                              {m.label}
                            </span>
                            <span
                              style={{
                                padding: "4px 11px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 700,
                                background: pag
                                  ? "rgba(16,185,129,0.18)"
                                  : "rgba(255,255,255,0.08)",
                                color: pag ? "#34D399" : "rgba(200,215,255,0.65)",
                              }}
                            >
                              {pag ? "Pagado" : "Pendiente"}
                            </span>
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="rgba(200,215,255,0.35)"
                              strokeWidth="2.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="9 6 15 12 9 18" />
                            </svg>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
            return filtro === "Eliminados" ? (
              <div key={c.id}>{card}</div>
            ) : (
              <SwipeRow key={c.id} onDelete={() => eliminar(c.id)} deleteLabel="Archivar">
                {card}
              </SwipeRow>
            );
          })}
          {filTotal === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: 48,
                background: "rgba(255,255,255,0.05)",
                borderRadius: 22,
                border: "1px dashed rgba(255,255,255,0.12)",
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  background:
                    filtro === "Eliminados" ? "rgba(239,68,68,0.15)" : "rgba(37,99,235,0.12)",
                  margin: "0 auto 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: filtro === "Eliminados" ? "#F87171" : "#60A5FA",
                }}
              >
                {filtro === "Eliminados" ? (
                  <svg
                    width="30"
                    height="30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                  </svg>
                ) : (
                  <svg
                    width="30"
                    height="30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                )}
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.85)",
                  marginBottom: 6,
                }}
              >
                {filtro === "Eliminados"
                  ? "La papelera está vacía"
                  : "Sin contratos " + filtro.toLowerCase()}
              </div>
              {filtro !== "Eliminados" && (
                <button
                  onClick={openNew}
                  style={{
                    marginTop: 10,
                    background: T.accent,
                    border: "none",
                    borderRadius: 12,
                    padding: "11px 20px",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                    touchAction: "manipulation",
                  }}
                >
                  + Crear primer contrato
                </button>
              )}
            </div>
          )}
          {/* Paginación de contratos */}
          <Pagination
            page={cPage}
            setPage={setCPage}
            totalPages={cTotalPages}
            total={filTotal}
            pageSize={cPageSize}
            dark={true}
          />
        </div>
      )}
    </div>
  );
}

// ── KPI CARD ESTILO FACTURACIÓN (dark navy + wave) ───────────────
const FactWave = ({ color = T.accent }) => {
  const id = `fw-${color.replace("#", "")}-${Math.random().toString(36).slice(2, 7)}`;
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
      <path
        d="M0 80 Q120 40 240 70 T400 60"
        stroke={`url(#${id})`}
        strokeWidth="0.8"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M0 100 Q140 60 280 90 T400 80"
        stroke={`url(#${id})`}
        strokeWidth="0.6"
        fill="none"
        opacity="0.5"
      />
    </svg>
  );
};
const KPIDark = ({ label, value, valueColor = T.white, sub, accent = T.accent, icon }) => (
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
    <FactWave color={accent} />
    <div style={{ position: "relative", zIndex: 2 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            color: "#5B7FCC",
            letterSpacing: 1.4,
            flex: 1,
            lineHeight: 1.3,
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: `1px solid ${accent === T.green ? "rgba(16,185,129,0.4)" : accent === T.white ? "rgba(245,158,11,0.4)" : accent === T.red ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.18)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 900,
          color: valueColor,
          letterSpacing: "-0.8px",
          lineHeight: 1,
          marginBottom: 8,
          fontVariantNumeric: "tabular-nums",
          wordBreak: "break-word",
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

// ── ICONOS SVG KPI (re-utilizables) ──────────────────────────────
const ICN = {
  users: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
        stroke={T.white}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="9" cy="7" r="4" stroke={T.white} strokeWidth="1.6" />
      <path
        d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke={T.white}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  target: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={T.white} strokeWidth="1.6" />
      <circle cx="12" cy="12" r="5" stroke={T.white} strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1.5" fill={T.white} />
    </svg>
  ),
  bolt: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <polygon
        points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
        stroke={T.white}
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  ),
  cash: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="13" rx="2" stroke={T.white} strokeWidth="1.6" />
      <circle cx="12" cy="12.5" r="2.4" stroke={T.white} strokeWidth="1.6" />
    </svg>
  ),
  hourglass: (
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
  down: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5V19M5 12L12 19L19 12"
        stroke={T.red}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  up: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 17L9 11L13 15L21 7M21 7H15M21 7V13"
        stroke={T.green}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  ),
  check: (
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
  archive: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="4" rx="1" stroke={T.white} strokeWidth="1.6" />
      <path d="M5 8V19A2 2 0 0 0 7 21H17A2 2 0 0 0 19 19V8" stroke={T.white} strokeWidth="1.6" />
      <line
        x1="10"
        y1="12"
        x2="14"
        y2="12"
        stroke={T.white}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  panel: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="12" rx="1.5" stroke={T.white} strokeWidth="1.6" />
      <line x1="12" y1="16" x2="12" y2="20" stroke={T.white} strokeWidth="1.6" />
      <line
        x1="8"
        y1="20"
        x2="16"
        y2="20"
        stroke={T.white}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  clock: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={T.white} strokeWidth="1.6" />
      <polyline
        points="12 7 12 12 15 14"
        stroke={T.white}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

// ── CRM ──────────────────────────────────────────────────────────

export default Contratos;

