// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// MIGRACIÓN TYPESCRIPT PENDIENTE — Proveedores.tsx  (~38 KB)
// Al remover @ts-nocheck se revelaron 60+ errores reales que requieren
// ejecutar la app para arreglar de forma segura. Grupos principales:
//
//   1. Imports no usados: React, useEffect, useCallback, createContext, useContext,
//      firebase/auth completo, Panel/Cliente/Contrato/Gasto/Factura/Sueldo,
//      tCol/catCol, useVirtualList, F/fFmt/fMesL/fMesActual — limpiar con eslint --fix
//
//   2. ProveedoresProps no definido en el archivo → mover a src/types/index.ts
//      junto con ProveedorForm (ya tiene la interfaz pero no se usa todavía)
//
//   3. modal: Partial<Proveedor> | null no puede compararse con "nuevo"
//      → cambiar a: null | { __nuevo: true } | Proveedor  o usar un
//        discriminador: modalMode: "cerrado" | "nuevo" | "editar"
//
//   4. p: unknown en callbacks de .map() — el hook useCollection devuelve
//      FirebaseDoc[] que necesita cast explícito: (docs as Proveedor[]).map(...)
//
//   5. boxSizing: "string" vs BoxSizing — cambiar a boxSizing: "border-box" as const
//
//   6. FieldGroup / SkeletonCRM no existen en este scope — importar o reemplazar
//
//   7. CAT_PROVE como objeto cerrado accedido con string dinámico
//      → usar: (CAT_PROVE as Record<string, string>)[key] ?? "#64748B"
//
// Ruta de migración (en orden):
//   a. eslint --fix para imports → reducir de 60 a ~25 errores
//   b. Extraer ProveedoresProps a src/types/index.ts
//   c. Cambiar modal state a discriminated union
//   d. Tipar .map() callbacks con (p: Proveedor)
//   e. Quitar este @ts-nocheck cuando tsc pase sin errores
// ─────────────────────────────────────────────────────────────────────────────
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

// ── Tipos e interfaces ────────────────────────────────────────────
import type { Panel, Cliente, Contrato, Gasto, Proveedor, Factura, Sueldo } from "../../../types";

// ── Servicios y utilidades ────────────────────────────────────────
import { fb } from "../../../services/firestore";
import { T, tCol, catCol } from "../../../config/theme";
import { toast, confirmAsync } from "../../../context/UIContext";
import { fmt, validate, haptic } from "../../../lib/utils";
import { toNumber, toDate } from "../../../lib/converters";
import { CIUDADES, CAT_PROVE } from "../../../config/constants";

// ── Componentes UI ────────────────────────────────────────────────
import { FieldGroup, Pagination, SwipeRow } from "../../ui";
import { usePagination } from "../../../hooks/usePagination";
import { useVirtualList } from "../../../hooks/useVirtualList";

// ── Tipos locales ──────────────────────────────────────────────────
interface ProveedorForm {
  empresa: string;
  categoria: string;
  contacto: string;
  celular: string;
  email: string;
  ruc: string;
  ciudad: string;
  notas: string;
}

function Proveedores({ proveedores, setProveedores, loading, onModalChange }: ProveedoresProps) {
  const [modal, setModal] = useState<Partial<Proveedor> | null>(null);
  const [buscar, setBuscar] = useState("");
  const [filtroCat, setFiltroCat] = useState("Todos");
  const [saving, setSaving] = useState(false);
  const closeBackdropRef = useRef(false);
  const modalOpenedAt = useRef(0);
  const sheetTouchedAt = useRef(0);

  const empty = {
    empresa: "",
    contacto: "",
    celular: "",
    email: "",
    ruc: "",
    categoria: "Materiales",
    producto: "",
    ciudad: "Lima",
    direccion: "",
    notas: "",
  };
  const [form, setForm] = useState(empty);

  const openNew = () => {
    modalOpenedAt.current = Date.now();
    closeBackdropRef.current = false;
    setForm(empty);
    setModal("nuevo");
    onModalChange?.(true);
  };
  const openEdit = p => {
    modalOpenedAt.current = Date.now();
    closeBackdropRef.current = false;
    setForm({ ...p });
    setModal(p);
    onModalChange?.(true);
  };

  const guardar = async () => {
    const provErr = validate.proveedor(form as Record<string, unknown>);
    if (provErr) return toast.warn(provErr);
    setSaving(true);
    const payload = {
      empresa: form.empresa.trim(),
      contacto: form.contacto || "",
      celular: form.celular || "",
      email: form.email || "",
      ruc: form.ruc || "",
      categoria: form.categoria || "Otro",
      producto: form.producto || "",
      ciudad: form.ciudad || "",
      direccion: form.direccion || "",
      notas: form.notas || "",
    };
    try {
      if (modal === "nuevo") {
        haptic("create");
        const r = await fb.post("proveedores", payload);
        if (r) setProveedores(p => [...p, r]);
      } else {
        haptic("success");
        const r = await fb.patch("proveedores", modal.id, payload);
        if (r) setProveedores(p => p.map(x => (x.id === modal.id ? { ...x, ...r } : x)));
      }
      setModal(null);
      onModalChange?.(false);
    } catch (e) {
      toast.error("Error al guardar: " + e.message);
    }
    setSaving(false);
  };

  const eliminar = async id => {
    if (
      !(await confirmAsync("Podrás recuperarlo desde Firebase si fue un error.", {
        title: "¿Eliminar proveedor?",
        danger: true,
        ok: "Sí, eliminar",
      }))
    )
      return;
    haptic("delete");
    await fb.del("proveedores", id);
    setProveedores(p => p.filter(x => x.id !== id));
  };

  const wa = p => {
    if (!p.celular) return toast.warn("Este proveedor no tiene celular registrado");
    const msg = `Hola ${p.contacto || ""}, le escribo desde 8 Millas. `;
    window.open(
      `https://wa.me/${p.celular.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`,
      "_blank",
    );
  };

  const filtrados = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return proveedores.filter(p => {
      const matchQ =
        !q ||
        [p.empresa, p.contacto, p.producto, p.celular, p.ciudad, p.ruc].some(v =>
          v?.toLowerCase().includes(q),
        );
      const matchC = filtroCat === "Todos" || p.categoria === filtroCat;
      return matchQ && matchC;
    });
  }, [proveedores, buscar, filtroCat]);

  // Paginación de proveedores
  const {
    page: pPage,
    setPage: setPPage,
    totalPages: pTotalPages,
    paginated: filtradosPaged,
    total: pTotal,
    pageSize: pPageSize,
  } = usePagination(filtrados, 10);

  // Sin morado/amarillo — todas las categorías en azul/blanco (solo verde=ingreso, rojo=gasto)
  const catColor = {
    Impresión: T.accent,
    Materiales: T.accent,
    Mantenimiento: T.white,
    Servicios: T.green,
    Transporte: T.cyan,
    Tecnología: T.accent,
    Otro: T.muted,
  };

  return (
    <div>
      {/* ── MODAL NUEVO/EDITAR ── */}
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
            if (Date.now() - modalOpenedAt.current < 500) return;
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
                {modal === "nuevo" ? "Nuevo Proveedor" : "Editar Proveedor"}
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

            {(() => {
              const inpS = {
                width: "100%",
                background: T.dark,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: "10px 13px",
                color: T.text,
                fontSize: 16,
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
              };
              const selS = { ...inpS, cursor: "pointer", touchAction: "manipulation" };
              const Fi = FieldGroup;
              return (
                <>
                  <Fi label="Empresa *">
                    <input
                      type="text"
                      value={form.empresa}
                      onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))}
                      onPointerDown={e => e.stopPropagation()}
                      placeholder="Ej: Imprenta Sol SAC"
                      style={inpS}
                    />
                  </Fi>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Fi label="Categoría *">
                      <select
                        value={form.categoria}
                        onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                        onPointerDown={e => e.stopPropagation()}
                        style={selS}
                      >
                        {CAT_PROVE.map(c => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </Fi>
                    <Fi label="Ciudad">
                      <select
                        value={form.ciudad}
                        onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))}
                        onPointerDown={e => e.stopPropagation()}
                        style={selS}
                      >
                        {CIUDADES.map(c => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </Fi>
                  </div>

                  <Fi label="Producto / Servicio que provee">
                    <input
                      type="text"
                      value={form.producto}
                      onChange={e => setForm(f => ({ ...f, producto: e.target.value }))}
                      onPointerDown={e => e.stopPropagation()}
                      placeholder="Ej: Lonas, vinilos, instalación..."
                      style={inpS}
                    />
                  </Fi>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Fi label="Contacto">
                      <input
                        type="text"
                        value={form.contacto}
                        onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))}
                        onPointerDown={e => e.stopPropagation()}
                        placeholder="Nombre"
                        style={inpS}
                      />
                    </Fi>
                    <Fi label="Celular">
                      <input
                        type="text"
                        inputMode="tel"
                        value={form.celular}
                        onChange={e => setForm(f => ({ ...f, celular: e.target.value }))}
                        onPointerDown={e => e.stopPropagation()}
                        placeholder="9XXXXXXXX"
                        style={inpS}
                      />
                    </Fi>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Fi label="RUC">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={form.ruc}
                        onChange={e => setForm(f => ({ ...f, ruc: e.target.value }))}
                        onPointerDown={e => e.stopPropagation()}
                        placeholder="20XXXXXXXXX"
                        style={inpS}
                      />
                    </Fi>
                    <Fi label="Email">
                      <input
                        type="email"
                        inputMode="email"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        onPointerDown={e => e.stopPropagation()}
                        placeholder="contacto@empresa.com"
                        style={inpS}
                      />
                    </Fi>
                  </div>

                  <Fi label="Dirección">
                    <input
                      type="text"
                      value={form.direccion}
                      onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                      onPointerDown={e => e.stopPropagation()}
                      placeholder="Calle, número, distrito"
                      style={inpS}
                    />
                  </Fi>

                  <Fi label="Notas">
                    <textarea
                      value={form.notas}
                      onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                      onPointerDown={e => e.stopPropagation()}
                      placeholder="Forma de pago, tiempos de entrega, observaciones..."
                      rows={3}
                      style={{ ...inpS, resize: "vertical" }}
                    />
                  </Fi>
                </>
              );
            })()}

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
                {saving
                  ? "Guardando..."
                  : modal === "nuevo"
                    ? "Crear Proveedor"
                    : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 18,
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
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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
            Proveedores
          </div>
          <div
            style={{ fontSize: 12, color: "rgba(180,200,255,0.7)", marginTop: 3, fontWeight: 500 }}
          >
            {proveedores.length} proveedor{proveedores.length !== 1 ? "es" : ""} registrado
            {proveedores.length !== 1 ? "s" : ""}
          </div>
        </div>
        <button
          onClick={openNew}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            position: "relative",
            zIndex: 1,
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 12,
            padding: "10px 16px",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            touchAction: "manipulation",
            flexShrink: 0,
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

      {/* ── BUSCADOR ── */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={T.muted}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={buscar}
          onChange={e => setBuscar(e.target.value)}
          placeholder="Buscar por empresa, producto, ciudad..."
          style={{
            width: "100%",
            padding: "12px 14px 12px 42px",
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* ── FILTROS POR CATEGORÍA ── */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          overflowX: "auto",
          paddingBottom: 4,
          overscrollBehavior: "none",
        }}
      >
        {["Todos", ...CAT_PROVE].map(c => {
          const active = filtroCat === c;
          const color = c === "Todos" ? T.accent : catColor[c] || T.muted;
          return (
            <button
              key={c}
              onClick={() => setFiltroCat(c)}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                background: active ? color : T.card,
                border: `1px solid ${active ? color : T.border}`,
                color: active ? "#fff" : T.muted,
                fontSize: 13,
                fontWeight: active ? 700 : 600,
                cursor: "pointer",
                touchAction: "manipulation",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "background .08s",
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      {loading ? (
        <SkeletonCRM />
      ) : filtrados.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: T.muted,
            background: T.card,
            borderRadius: 22,
            border: `1px dashed ${T.border}`,
          }}
        >
          {proveedores.length === 0 ? (
            <>
              Sin proveedores registrados ·{" "}
              <button
                onClick={openNew}
                style={{
                  color: T.accent,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  touchAction: "manipulation",
                  fontWeight: 700,
                }}
              >
                + Agregar el primero
              </button>
            </>
          ) : (
            "No hay resultados con ese filtro"
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtradosPaged.map(p => {
            const col = catColor[p.categoria] || T.white;
            const wid = "prv-" + p.id;
            const card = (
              <div
                style={{
                  position: "relative",
                  overflow: "hidden",
                  background: "linear-gradient(145deg,#0E1835 0%,#0A1228 100%)",
                  border: "1px solid rgba(79,124,255,0.22)",
                  borderRadius: 18,
                  padding: "14px 16px",
                  boxShadow:
                    "0 6px 24px rgba(8,12,28,0.5), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.07)",
                }}
              >
                {/* Ondas decorativas */}
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
                    <linearGradient id={wid} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0" stopColor={T.accent} stopOpacity="0" />
                      <stop offset="0.5" stopColor={T.accent} stopOpacity="0.55" />
                      <stop offset="1" stopColor={T.accent} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 60 Q100 20 200 50 T400 40"
                    stroke={`url(#${wid})`}
                    strokeWidth="1.2"
                    fill="none"
                  />
                  <path
                    d="M0 80 Q120 40 240 70 T400 60"
                    stroke={`url(#${wid})`}
                    strokeWidth="0.8"
                    fill="none"
                    opacity="0.7"
                  />
                  <path
                    d="M0 100 Q140 60 280 90 T400 80"
                    stroke={`url(#${wid})`}
                    strokeWidth="0.6"
                    fill="none"
                    opacity="0.5"
                  />
                </svg>

                <div style={{ position: "relative", zIndex: 2 }}>
                  {/* Top row: avatar blanco + datos + RUC chip */}
                  <div
                    style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}
                  >
                    <div
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
                          y="5.6"
                          fontSize="2.2"
                          fontWeight="900"
                          fill={T.accent}
                          fontFamily="sans-serif"
                        >
                          PROVEEDOR
                        </text>
                        <rect
                          x="5"
                          y="9"
                          width="14"
                          height="6"
                          rx="0.6"
                          fill="#EFF6FF"
                          stroke={T.accent}
                          strokeWidth="0.5"
                        />
                        <line x1="5" y1="17" x2="19" y2="17" stroke="#94A3B8" strokeWidth="0.7" />
                        <line
                          x1="5"
                          y1="19.5"
                          x2="19"
                          y2="19.5"
                          stroke="#94A3B8"
                          strokeWidth="0.7"
                        />
                        <line x1="5" y1="22" x2="14" y2="22" stroke="#94A3B8" strokeWidth="0.7" />
                      </svg>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
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
                            fontSize: 15,
                            fontWeight: 900,
                            color: T.white,
                            letterSpacing: "-0.2px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "100%",
                          }}
                        >
                          {p.empresa}
                        </span>
                        <span
                          style={{
                            background: col + "26",
                            color: col,
                            border: `1px solid ${col}55`,
                            borderRadius: 8,
                            padding: "2px 9px",
                            fontSize: 10.5,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.categoria || "Otro"}
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
                        {p.contacto || "—"}
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
                        {p.ciudad || "—"}
                        {p.ruc ? ` · RUC ${p.ruc}` : ""}
                      </div>
                    </div>
                  </div>

                  {p.producto && (
                    <div
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: 10,
                        padding: "8px 12px",
                        marginBottom: 10,
                        fontSize: 13,
                        color: T.white,
                        lineHeight: 1.4,
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          color: "#5B7FCC",
                          fontWeight: 700,
                          letterSpacing: 1,
                          textTransform: "uppercase",
                          display: "block",
                          marginBottom: 2,
                        }}
                      >
                        Provee
                      </span>
                      {p.producto}
                    </div>
                  )}

                  {(p.celular || p.email) && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                      {p.celular && (
                        <span
                          style={{
                            fontSize: 11,
                            color: T.white,
                            background: "rgba(255,255,255,0.05)",
                            padding: "4px 10px",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          {p.celular}
                        </span>
                      )}
                      {p.email && (
                        <span
                          style={{
                            fontSize: 11,
                            color: T.white,
                            background: "rgba(255,255,255,0.05)",
                            padding: "4px 10px",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.08)",
                            maxWidth: 200,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.email}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Botones de acción estilo pill */}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "flex-end",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      onClick={() => openEdit(p)}
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
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                      </svg>
                      Editar
                    </button>
                    {p.celular && (
                      <button
                        onClick={() => wa(p)}
                        style={{
                          background: "rgba(37,211,102,0.12)",
                          border: "1px solid rgba(37,211,102,0.40)",
                          borderRadius: 10,
                          padding: "7px 14px",
                          color: "#25D366",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          touchAction: "manipulation",
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          fontFamily: "inherit",
                        }}
                      >
                        <svg
                          width="15"
                          height="15"
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
                        WhatsApp
                      </button>
                    )}
                  </div>

                  {p.notas && (
                    <div
                      style={{
                        marginTop: 10,
                        paddingTop: 10,
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        fontSize: 12,
                        color: "rgba(160,180,220,0.7)",
                        lineHeight: 1.5,
                      }}
                    >
                      {p.notas}
                    </div>
                  )}
                </div>
              </div>
            );
            return (
              <SwipeRow key={p.id} onDelete={() => eliminar(p.id)} deleteLabel="Eliminar">
                {card}
              </SwipeRow>
            );
          })}
        </div>
      )}
      {/* Paginación de proveedores */}
      <Pagination
        page={pPage}
        setPage={setPPage}
        totalPages={pTotalPages}
        total={pTotal}
        pageSize={pPageSize}
        dark={true}
      />
    </div>
  );
}

// ── ESTADO DE RESULTADOS PRO — OOH Financial Intelligence ─────────
// Design tokens (prefijo F_ para evitar conflictos de scope global)
const F = {
  bg: "#060C1D",
  card: "#0A1428",
  card2: "#0E1B35",
  border: "rgba(255,255,255,0.07)",
  border2: "rgba(255,255,255,0.13)",
  text: "#E8EEFF",
  muted: "rgba(148,175,255,0.45)",
  muted2: "rgba(148,175,255,0.22)",
  gold: "#F59E0B",
  goldLt: "rgba(245,158,11,0.13)",
  goldBd: "rgba(245,158,11,0.3)",
  green: "#10B981",
  greenLt: "rgba(16,185,129,0.11)",
  greenBd: "rgba(16,185,129,0.3)",
  red: "#EF4444",
  redLt: "rgba(239,68,68,0.10)",
  redBd: "rgba(239,68,68,0.28)",
  blue: "#3B82F6",
  blueLt: "rgba(59,130,246,0.10)",
  blueBd: "rgba(59,130,246,0.28)",
  cyan: "#06B6D4",
  purple: "#8B5CF6",
};

// fFmt: alias de fmt (mismo formato S/ es-PE 2 decimales) — evita duplicación
const fFmt = fmt;
const fFmtK = (n: number | null | undefined) => {
  const v = Number(n || 0);
  return v >= 1e6
    ? `S/ ${(v / 1e6).toFixed(1)}M`
    : v >= 1e3
      ? `S/ ${(v / 1e3).toFixed(1)}k`
      : `S/ ${Math.round(v)}`;
};
const fPct = (n: number, d = 1) => `${n >= 0 ? "+" : ""}${Number(n || 0).toFixed(d)}%`;
const fMesL = (m: string | null | undefined) => {
  if (!m) return "—";
  const [y, mo] = m.split("-");
  return (
    ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][+mo - 1] +
    "'" +
    y.slice(2)
  );
};
const fMesActual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const fBuildMeses = (desde: string, hasta: string): string[] => {
  const ms: string[] = [],
    cur = new Date(desde + "-01"),
    end = new Date(hasta + "-01");
  while (cur <= end) {
    ms.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return ms;
};
const fNMesesAtras = (n: number): string => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - (n - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// ── Sub-components ─────────────────────────────────────────────────

export default Proveedores;
