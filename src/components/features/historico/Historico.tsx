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

function Historico({ contratos, setContratos, paneles, clientes, onModalChange }: HistoricoProps) {
  const [modal, setModal] = useState<Partial<Contrato> | null>(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [anioSel, setAnioSel] = useState(() => new Date().getFullYear());
  const [mesSel, setMesSel] = useState<string | null>(null); // null = ver todos los meses del año
  const hoyD = new Date();

  const MESES_LABEL = [
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
  const MESES_FULL = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

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

  // Enriquecer contratos
  const todos = contratos
    .map(c => ({
      ...c,
      d: Math.ceil((new Date(c.fin).getTime() - hoyD.getTime()) / 86400000),
      panel: paneles.find(p => p.id === c.panel_id),
      cliente: clientes.find(cl => cl.id === c.cliente_id),
    }))
    .filter(c => c.panel && c.cliente)
    .sort((a, b) => new Date(b.inicio || 0) - new Date(a.inicio || 0));

  // Años disponibles — todos los años con contratos (pasados y futuros)
  const aniosDisp = useMemo(() => {
    const set = new Set();
    const anioActual = new Date().getFullYear();
    set.add(anioActual);
    todos.forEach(c => {
      if (c.inicio) set.add(parseInt(c.inicio.slice(0, 4), 10));
      if (c.fin) set.add(parseInt(c.fin.slice(0, 4), 10));
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [todos]);

  // Si el año seleccionado no está en la lista, usar el primero
  const anioEfectivo = aniosDisp.includes(anioSel)
    ? anioSel
    : aniosDisp[0] || new Date().getFullYear();

  // Contratos activos en el año seleccionado (no solo los que iniciaron ese año)
  const contratosAnio = todos.filter(c => {
    if (!c.inicio || !c.fin) return false;
    const iniAnio = parseInt(c.inicio.slice(0, 4), 10);
    const finAnio = parseInt(c.fin.slice(0, 4), 10);
    return iniAnio <= anioEfectivo && finAnio >= anioEfectivo;
  });

  // Ingresos por mes para el gráfico (basado en monto × meses que cubre en ese año)
  const ingresosPorMes = useMemo(() => {
    const arr = Array(12).fill(0);
    todos.forEach(c => {
      if (!c.inicio || !c.fin || !c.monto) return;
      const ini = new Date(c.inicio + "T12:00:00");
      const fin = new Date(c.fin + "T12:00:00");
      for (let m = 0; m < 12; m++) {
        const mesIni = new Date(anioEfectivo, m, 1);
        const mesFin = new Date(anioEfectivo, m + 1, 0);
        if (ini <= mesFin && fin >= mesIni) arr[m] += Number(c.monto) || 0;
      }
    });
    return arr;
  }, [todos, anioEfectivo]);

  const totalAnio = ingresosPorMes.reduce((a, b) => a + b, 0);
  const maxMes = Math.max(...ingresosPorMes, 1);
  const mesActual = new Date().getMonth(); // 0-based

  // Contratos a mostrar según filtro de mes (el mes seleccionado cae dentro del rango del contrato)
  const listaFiltrada =
    mesSel !== null
      ? contratosAnio.filter(c => {
          const mesIni = new Date(anioEfectivo, mesSel, 1);
          const mesFin = new Date(anioEfectivo, mesSel + 1, 0);
          const ini = new Date(c.inicio + "T12:00:00");
          const fin = new Date(c.fin + "T12:00:00");
          return ini <= mesFin && fin >= mesIni;
        })
      : contratosAnio;

  const openEdit = c => {
    setForm({
      panel_id: c.panel_id,
      cliente_id: c.cliente_id,
      inicio: c.inicio || "",
      fin: c.fin || "",
      monto: c.monto || "",
      pagosMeses: c.pagosMeses || {},
    });
    setModal(c);
    setConfirmDelete(false);
    onModalChange?.(true);
  };
  const closeModal = () => {
    setModal(null);
    setConfirmDelete(false);
    onModalChange?.(false);
  };

  const mesesForm = generarMeses(form.inicio, form.fin);
  const pagosMarcados = Object.values(form.pagosMeses || {}).filter(Boolean).length;
  const toggleMesPago = key =>
    setForm(f => ({ ...f, pagosMeses: { ...f.pagosMeses, [key]: !f.pagosMeses[key] } }));

  const guardar = async () => {
    const histErr = validate.contrato(form as Record<string, unknown>);
    if (histErr) return toast.warn(histErr);
    setSaving(true);
    try {
      const meses = generarMeses(form.inicio, form.fin);
      const pm = form.pagosMeses || {};
      const pagado = pm[meses[0]?.key] || false;
      const payload = {
        panel_id: form.panel_id,
        cliente_id: form.cliente_id,
        inicio: form.inicio,
        fin: form.fin,
        monto: Number(form.monto),
        pagado,
        pagosMeses: pm,
      };
      const r = await fb.patch("contratos", modal.id, payload);
      if (r) setContratos(p => p.map(x => (x.id === modal.id ? { ...x, ...payload } : x)));
      haptic("success");
      toast.success("Contrato actualizado");
      closeModal();
    } catch (e) {
      toast.error("Error al guardar: " + e.message);
    }
    setSaving(false);
  };

  const eliminar = async () => {
    setSaving(true);
    try {
      await fb.del("contratos", modal.id, { hardDelete: true });
      setContratos(p => p.filter(x => x.id !== modal.id));
      closeModal();
    } catch (e) {
      toast.error("Error al eliminar: " + e.message);
    }
    setSaving(false);
  };

  const inpStyle = {
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
  const selStyle = { ...inpStyle, cursor: "pointer", touchAction: "manipulation" };
  const F = FieldGroup;

  return (
    <div>
      {/* ── MODAL EDITAR ── */}
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
          onClick={e => {
            if (e.target === e.currentTarget) closeModal();
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
            onMouseDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            onTouchEnd={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
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
              <span style={{ fontSize: 17, fontWeight: 800, color: T.text }}>Editar Contrato</span>
              <button className="v360-glass-btn"
                onClick={closeModal}
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
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
                onTouchEnd={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                style={selStyle}
              >
                <option value="">— Selecciona un panel —</option>
                {paneles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} · {p.ciudad}
                  </option>
                ))}
              </select>
            </F>
            <F label="Cliente *">
              <select
                value={form.cliente_id}
                onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
                onTouchEnd={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                style={selStyle}
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
                  onMouseDown={e => e.stopPropagation()}
                  onTouchStart={e => e.stopPropagation()}
                  onTouchEnd={e => e.stopPropagation()}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                  style={{
                    ...inpStyle,
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
                  onMouseDown={e => e.stopPropagation()}
                  onTouchStart={e => e.stopPropagation()}
                  onTouchEnd={e => e.stopPropagation()}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                  style={{
                    ...inpStyle,
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
                value={form.monto}
                onChange={e =>
                  setForm(f => ({ ...f, monto: e.target.value.replace(/[^0-9.]/g, "") }))
                }
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
                onTouchEnd={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                placeholder="Ej: 1500"
                style={{ ...inpStyle, fontSize: 16 }}
              />
            </F>
            {mesesForm.length > 0 && (
              <F label={`Meses pagados (${pagosMarcados}/${mesesForm.length})`}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {mesesForm.map(m => {
                    const pagado = !!(form.pagosMeses || {})[m.key];
                    return (
                      <button className="v360-glass-btn"
                        key={m.key}
                        onClick={() => toggleMesPago(m.key)}
                        onMouseDown={e => e.stopPropagation()}
                        onTouchStart={e => e.stopPropagation()}
                        onPointerDown={e => e.stopPropagation()}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: `1.5px solid ${pagado ? T.green : T.border}`,
                          background: pagado ? T.green + "22" : "transparent",
                          color: pagado ? T.green : T.muted,
                          fontWeight: pagado ? 700 : 500,
                          fontSize: 12,
                          cursor: "pointer",
                          touchAction: "manipulation",
                          fontFamily: "inherit",
                        }}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </F>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 20, position: "sticky", bottom: 0 }}>
              <button className="v360-glass-btn"
                onClick={closeModal}
                style={{
                  flex: 1,
                  padding: 14,
                  background: "transparent",
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  color: T.muted,
                  fontWeight: 600,
                  cursor: "pointer",
                  touchAction: "manipulation",
                  fontSize: 14,
                  minHeight: 46,
                }}
              >
                Cancelar
              </button>
              <button className="v360-glass-btn"
                onClick={guardar}
                disabled={saving}
                style={{
                  flex: 2,
                  padding: 14,
                  background: T.accent,
                  border: "none",
                  borderRadius: 12,
                  color: T.white,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  touchAction: "manipulation",
                  minHeight: 46,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
            <div style={{ marginTop: 24, paddingTop: 18, borderTop: `1px dashed ${T.border}` }}>
              {!confirmDelete ? (
                <button className="v360-glass-btn"
                  onClick={() => setConfirmDelete(true)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: 12,
                    border: "1px solid #FECACA",
                    background: "#FEF2F2",
                    color: T.red,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                    touchAction: "manipulation",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  </svg>
                  Eliminar contrato
                </button>
              ) : (
                <div
                  style={{
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    borderRadius: 14,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: T.red,
                      marginBottom: 6,
                      textAlign: "center",
                    }}
                  >
                    ¿Confirmar eliminación?
                  </div>
                  <div
                    style={{ fontSize: 12, color: T.muted, marginBottom: 14, textAlign: "center" }}
                  >
                    Esta acción marcará el contrato como eliminado.
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="v360-glass-btn"
                      onClick={() => setConfirmDelete(false)}
                      style={{
                        flex: 1,
                        padding: "11px",
                        borderRadius: 10,
                        border: `1px solid ${T.border}`,
                        background: "transparent",
                        color: T.muted,
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                        touchAction: "manipulation",
                      }}
                    >
                      Cancelar
                    </button>
                    <button className="v360-glass-btn"
                      onClick={eliminar}
                      disabled={saving}
                      style={{
                        flex: 1,
                        padding: "11px",
                        borderRadius: 10,
                        border: "none",
                        background: T.red,
                        color: "#fff",
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: "pointer",
                        touchAction: "manipulation",
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      {saving ? "Eliminando..." : "Sí, eliminar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CABECERA DARK ── */}
      <div
        style={{
          background: "linear-gradient(160deg,#080D18 0%,#0D1525 60%,#0F172A 100%)",
          margin: "-20px -20px 0",
          padding: "20px 20px 0",
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            fontWeight: 600,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Vista360 · Archivo
        </div>
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: "-0.5px",
            marginBottom: 4,
          }}
        >
          Histórico
        </div>

        {/* Selectores de año y mes */}
        <div
          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, marginTop: 8 }}
        >
          <select
            value={anioSel}
            onChange={e => {
              setAnioSel(Number(e.target.value));
              setMesSel(null);
            }}
            style={{
              padding: "8px 14px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.13)",
              border: "1px solid rgba(255,255,255,0.25)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              touchAction: "manipulation",
              fontFamily: "inherit",
              outline: "none",
              colorScheme: "dark",
            }}
          >
            {aniosDisp.map(a => (
              <option key={a} value={a} style={{ background: "#1E293B", color: "#fff" }}>
                {a}
              </option>
            ))}
          </select>
          <select
            value={mesSel === null ? "" : String(mesSel)}
            onChange={e => {
              const v = e.target.value;
              setMesSel(v === "" ? null : Number(v));
            }}
            style={{
              flex: 1,
              padding: "8px 14px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.13)",
              border: "1px solid rgba(255,255,255,0.25)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              touchAction: "manipulation",
              fontFamily: "inherit",
              outline: "none",
              colorScheme: "dark",
            }}
          >
            <option value="" style={{ background: "#1E293B", color: "#fff" }}>
              Todos los meses
            </option>
            {MESES_FULL.map((m, i) => (
              <option key={i} value={String(i)} style={{ background: "#1E293B", color: "#fff" }}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Resumen del año */}
        <div style={{ display: "flex", gap: 20, marginBottom: 18 }}>
          {[
            {
              label: "Ingresos año",
              val: `S/ ${totalAnio.toLocaleString("es-PE", { minimumFractionDigits: 0 })}`,
              color: "#4ADE80",
            },
            { label: "Contratos", val: contratosAnio.length, color: "#fff" },
          ].map(({ label, val, color }) => (
            <div key={label}>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color,
                  letterSpacing: "-0.5px",
                  lineHeight: 1,
                }}
              >
                {val}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.35)",
                  marginTop: 3,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* ── GRÁFICO ANUAL DE BARRAS ── */}
        <div
          style={{
            marginLeft: -20,
            marginRight: -20,
            padding: "0 20px 0",
            borderTop: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div style={{ paddingTop: 16, paddingBottom: 4 }}>
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.3)",
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Ingresos mensuales {anioEfectivo}
            </div>
            {/* Barras */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 60 }}>
              {ingresosPorMes.map((val, i) => {
                const pct = maxMes > 0 ? (val / maxMes) * 100 : 0;
                const esMesActual = anioEfectivo === new Date().getFullYear() && i === mesActual;
                const esSel = mesSel === i;
                const futuro =
                  anioEfectivo === new Date().getFullYear() && i > mesActual && val === 0;
                return (
                  <button className="v360-glass-btn"
                    key={i}
                    onClick={() => setMesSel(mesSel === i ? null : i)}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 3,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      touchAction: "manipulation",
                      padding: 0,
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        borderRadius: "4px 4px 0 0",
                        height: pct < 4 && val > 0 ? 4 : `${Math.max(pct, 2)}%`,
                        minHeight: val > 0 ? 4 : 2,
                        maxHeight: 60,
                        background: esSel
                          ? "#60A5FA"
                          : esMesActual
                            ? "linear-gradient(180deg,#34D399,#10B981)"
                            : futuro
                              ? "rgba(255,255,255,0.05)"
                              : val > 0
                                ? "rgba(255,255,255,0.22)"
                                : "rgba(255,255,255,0.05)",
                        transition: "all .2s",
                        border: esSel ? "1px solid #93C5FD" : esMesActual ? "none" : "none",
                      }}
                    />
                  </button>
                );
              })}
            </div>
            {/* Labels meses */}
            <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
              {MESES_LABEL.map((m, i) => {
                const esSel = mesSel === i;
                const esMesActual = anioEfectivo === new Date().getFullYear() && i === mesActual;
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      fontSize: 8,
                      color: esSel ? "#60A5FA" : esMesActual ? "#4ADE80" : "rgba(255,255,255,0.25)",
                      fontWeight: esSel || esMesActual ? 700 : 400,
                    }}
                  >
                    {m}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Filtro activo */}
        {mesSel !== null && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 0 12px",
            }}
          >
            <span style={{ fontSize: 12, color: "#60A5FA", fontWeight: 700 }}>
              {MESES_FULL[mesSel]} {anioEfectivo} · {listaFiltrada.length} contrato
              {listaFiltrada.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* ── LISTA DE CONTRATOS ── */}
      <div style={{ marginTop: 0, background: "#F8FAFC", padding: "16px 0 0" }}>
        {listaFiltrada.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
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
              }}
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke={T.accent}
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>
              {mesSel !== null
                ? `Sin contratos en ${MESES_FULL[mesSel]}`
                : `Sin contratos en ${anioEfectivo}`}
            </div>
            <div style={{ fontSize: 12, color: "#94A3B8" }}>Selecciona otro año o mes</div>
          </div>
        ) : (
          (() => {
            // Agrupar por mes de inicio dentro del año/mes seleccionado
            const grupos = {};
            listaFiltrada.forEach(c => {
              const key = c.inicio ? c.inicio.slice(0, 7) : "sin-fecha";
              if (!grupos[key]) grupos[key] = [];
              grupos[key].push(c);
            });
            const labelGrupo = k => {
              if (k === "sin-fecha") return "Sin fecha";
              const [, m] = k.split("-");
              return MESES_FULL[parseInt(m, 10) - 1] || k;
            };
            return Object.entries(grupos)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([key, items]) => (
                <div key={key} style={{ marginBottom: 24 }}>
                  {/* Cabecera mes */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "0 16px 12px",
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: T.accent,
                        flexShrink: 0,
                        boxShadow: "0 0 0 3px #DBEAFE",
                      }}
                    />
                    <div style={{ height: 1, flex: 1, background: T.border }} />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: T.muted,
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        flexShrink: 0,
                      }}
                    >
                      {labelGrupo(key)}
                    </span>
                    <span style={{ fontSize: 10, color: "#94A3B8", flexShrink: 0 }}>
                      {fmt(items.reduce((s, c) => s + Number(c.monto || 0), 0))}/mes
                    </span>
                    <div style={{ height: 1, flex: 1, background: T.border }} />
                  </div>
                  {/* Cards */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      paddingLeft: 16,
                      paddingRight: 16,
                    }}
                  >
                    {items.map(c => {
                      const activo = c.d > 0;
                      const statusColor = activo ? (c.d <= 30 ? T.white : T.green) : "#94A3B8";
                      const statusLabel = activo
                        ? c.d <= 30
                          ? `Vence en ${c.d}d`
                          : "Activo"
                        : "Finalizado";
                      return (
                        <div
                          key={c.id}
                          style={{
                            background: "#fff",
                            borderRadius: 18,
                            border: "1px solid #E5E7EB",
                            overflow: "hidden",
                            boxShadow:
                              "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px -6px rgba(0,0,0,0.08)",
                          }}
                        >
                          <div
                            style={{
                              height: 3,
                              background: activo ? (c.d <= 30 ? T.accent : T.accent) : T.border,
                            }}
                          />
                          <div style={{ padding: "14px 16px" }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                gap: 12,
                                marginBottom: 10,
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    marginBottom: 3,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: 9,
                                      background: "linear-gradient(135deg,#1E3A8A,#2563EB)",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      flexShrink: 0,
                                    }}
                                  >
                                    <svg
                                      width="15"
                                      height="15"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="white"
                                      strokeWidth="1.8"
                                      strokeLinecap="round"
                                    >
                                      <rect x="3" y="3" width="7" height="7" rx="1.5" />
                                      <rect x="14" y="3" width="7" height="7" rx="1.5" />
                                      <rect x="3" y="14" width="7" height="7" rx="1.5" />
                                      <rect x="14" y="14" width="7" height="7" rx="1.5" />
                                    </svg>
                                  </div>
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
                                    {c.panel.nombre}
                                  </div>
                                </div>
                                <div style={{ fontSize: 12, color: T.muted, marginLeft: 40 }}>
                                  {c.cliente.empresa} · {c.panel.ciudad}
                                </div>
                              </div>
                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div
                                  style={{
                                    fontSize: 17,
                                    fontWeight: 800,
                                    color: T.green,
                                    letterSpacing: "-0.5px",
                                  }}
                                >
                                  {fmt(c.monto)}
                                  <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 500 }}>
                                    /mes
                                  </span>
                                </div>
                                <span
                                  style={{
                                    display: "inline-block",
                                    marginTop: 4,
                                    padding: "3px 9px",
                                    borderRadius: 99,
                                    background: `${statusColor}15`,
                                    border: `1px solid ${statusColor}40`,
                                    color: statusColor,
                                    fontSize: 10,
                                    fontWeight: 700,
                                  }}
                                >
                                  {statusLabel}
                                </span>
                              </div>
                            </div>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 8,
                                marginBottom: 12,
                              }}
                            >
                              {[
                                { l: "Inicio", v: fmtF(c.inicio) },
                                { l: "Fin", v: fmtF(c.fin) },
                              ].map(({ l, v }) => (
                                <div
                                  key={l}
                                  style={{
                                    background: "#F8FAFC",
                                    borderRadius: 10,
                                    padding: "7px 10px",
                                    border: "1px solid #E5E7EB",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: 9,
                                      color: "#94A3B8",
                                      textTransform: "uppercase",
                                      letterSpacing: 1,
                                      marginBottom: 2,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {l}
                                  </div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>
                                    {v}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div
                                  style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: "50%",
                                    background: c.pagado ? T.green : T.border,
                                  }}
                                />
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: c.pagado ? T.green : "#94A3B8",
                                    fontWeight: 600,
                                  }}
                                >
                                  {c.pagado ? "Pagado" : "Pendiente"}
                                </span>
                              </div>
                              <button className="v360-glass-btn"
                                onClick={() => openEdit(c)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  padding: "7px 14px",
                                  borderRadius: 50,
                                  border: "1px solid #E5E7EB",
                                  background: "#F8FAFC",
                                  color: T.muted,
                                  fontWeight: 600,
                                  fontSize: 12,
                                  cursor: "pointer",
                                  touchAction: "manipulation",
                                  fontFamily: "inherit",
                                }}
                              >
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                >
                                  <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                </svg>
                                Editar
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
          })()
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// FACTURACIÓN — Vista360
// Gestión completa de facturas, boletas y cobros
// ══════════════════════════════════════════════════════════════════

// Utilidades de facturación
// ── IGV Amazonía — Ley N° 27037, Art. 13.1 ──────────────────────
// Distritos de Huánuco reconocidos como zona amazónica (exonerados de IGV
// para servicios prestados localmente). Fuente: Ley 27037 + mod. Ley 2024
const DISTRITOS_AMAZONIA_HCO = [
  "huanuco",
  "amarilis",
  "pillco marca",
  "pillcomarca",
  "churubamba",
  "santa maria del valle",
  "chinchao",
  "conchamarca",
  "tomayquichua",
  "ambo",
];
const normStr = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
const isExoneradoIGV = (ciudad = "") => {
  const c = normStr(ciudad);
  return DISTRITOS_AMAZONIA_HCO.some(d => c.includes(d));
};
const IGV_RATE = 0.18;
// rate = 0.18 (normal) | 0 (exonerado Ley Amazonía)
const fmtMes = s =>
  s
    ? new Date(s + "-02")
        .toLocaleDateString("es-PE", { month: "long", year: "numeric" })
        .replace(/^\w/, c => c.toUpperCase())
    : "—";
const EST_FAC = [
  "Emitida",
  "Aceptada",
  "Cobrada",
  "Pagada",
  "Pendiente",
  "Vencida",
  "Rechazada",
  "Anulada",
  "Borrador",
];
const EST_FAC_COL = {
  Emitida: "#4F7CFF", // azul — emitida y enviada al sistema externo
  Aceptada: "#4F7CFF", // azul — aceptada por SUNAT
  Cobrada: "#0FBA7D", // verde — pagada / cobrada
  Pagada: "#0FBA7D", // alias de Cobrada
  Pendiente: T.white, // ámbar — pendiente de cobro
  Vencida: "#F04747", // rojo — pasó fecha de vencimiento sin cobrar
  Rechazada: "#F04747", // rojo — rechazada por SUNAT
  Anulada: "#9B6FFF", // morado — anulada
  Borrador: "#4E6080", // gris — borrador (legacy)
};

// ══════════════════════════════════════════════════════════════════
// INTEGRACIÓN CON SISTEMA DE FACTURACIÓN EXTERNO (SOLO LECTURA)
// ──────────────────────────────────────────────────────────────────
// La app Vista360 NO emite ni envía facturas. Solo MUESTRA los
// comprobantes que tu sistema de facturación externo ya emitió
// (Nubefact, Facturador SUNAT, propio, etc.) y permite ver/descargar
// el PDF generado por ese sistema.
//
// Cuando tu sistema esté listo, completa este bloque:
//
//   FACTURACION_API.enabled  = true
//   FACTURACION_API.endpoint = "https://api.tusistema.com/comprobantes"
//   FACTURACION_API.token    = "TU_API_KEY"
//
// Mientras tanto, los comprobantes se leen de Firebase ("facturas")
// para que puedas probar la UI con datos de ejemplo.
// ──────────────────────────────────────────────────────────────────
//
// ESTRUCTURA ESPERADA POR LA APP (cada comprobante)
// El sistema externo debe devolver un array de objetos con esta forma:
//
//   {
//     // Identificación
//     id:                "FAC-2026-001",       // ID único en el sistema externo
//     tipo:              "FACTURA"|"BOLETA"|"NOTA_CREDITO"|"NOTA_DEBITO",
//     serie:             "F001",
//     numero:            "00012345",            // ya formateado
//
//     // Cliente
//     cliente_doc_tipo:  "RUC"|"DNI",
//     cliente_doc:       "20XXXXXXXXX",
//     cliente_nombre:    "Empresa S.A.C.",
//     cliente_email:     "...",                 // opcional
//     cliente_id:        "abc123",              // opcional, link a tu CRM
//
//     // Vínculo opcional con tu sistema (panel/contrato)
//     panel_id:          "panel_xyz",
//     contrato_id:       "ctr_abc",
//
//     // Concepto y período
//     concepto:          "Arrendamiento Panel Publicitario",
//     periodo_inicio:    "2026-01-01",
//     periodo_fin:       "2026-01-31",
//
//     // Montos
//     subtotal:          550.85,
//     igv:               99.15,
//     total:             650.00,
//     moneda:            "PEN",                 // o "USD"
//
//     // Fechas
//     fecha_emision:     "2026-01-15",
//     fecha_vencimiento: "2026-02-15",
//     fecha_pago:        null,                  // ISO si está pagada
//
//     // Estado
//     estado:            "Aceptada"|"Cobrada"|"Pendiente"|"Vencida"|"Rechazada"|"Anulada",
//
//     // Archivos generados por el sistema externo
// pdf_url: "https://.../factura.pdf", // MÁS IMPORTANTE
//     xml_url:           "https://.../factura.xml",  // opcional
//     cdr_url:           "https://.../cdr.zip",      // opcional (CDR SUNAT)
//
//     // SUNAT (opcionales)
//     hash:              "abc123def...",
//     sunat_estado:      "ACEPTADO",
//
//     // Pago (cuando se cobre, lo gestiona tu sistema externo)
//     metodo_pago:       "Transferencia"|"Efectivo"|"Yape"|...,
//     nro_operacion:     "OP-12345",
//   }
// ══════════════════════════════════════════════════════════════════
const FACTURACION_API = {
  enabled: false, // ← cambia a true cuando tu sistema esté listo
  endpoint: "", // ← URL GET que devuelve array de comprobantes
  token: "", // ← Bearer token / API key
  rucEmisor: EMISOR.ruc, // RUC del emisor (8 Millas)
};

async function fetchFacturas() {
  // Modo conectado: lee del sistema externo
  if (FACTURACION_API.enabled && FACTURACION_API.endpoint) {
    try {
      const resp = await fetch(FACTURACION_API.endpoint, {
        headers: {
          Authorization: `Bearer ${FACTURACION_API.token}`,
          Accept: "application/json",
        },
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const data = await resp.json();
      // Acepta array directo o { data: [...] } / { comprobantes: [...] }
      return Array.isArray(data) ? data : data.data || data.comprobantes || [];
    } catch (e) {
      console.error("[Facturación] Error API:", e);
      return [];
    }
  }
  // one-time fetch intencional: las facturas son registros históricos generados
  // por un sistema externo (API de facturación). No cambian en tiempo real
  // desde esta app — el sistema externo es la fuente de verdad.
  return fb.get("facturas");
}

// ── Modal: Ver detalle de comprobante (SOLO LECTURA) ─────────────
// Muestra los datos del comprobante emitido por el sistema externo
// y permite abrir el PDF/XML que ese sistema generó.
// NO edita, NO crea, NO envía emails, NO registra pagos.
// ──────────────────────────────────────────────────────────────────

export default Historico;
