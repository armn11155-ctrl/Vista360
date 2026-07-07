// @ts-nocheck — legacy file: migrating to strict TypeScript gradually
import React, { useState, useMemo, useEffect, useCallback } from "react";
import type { Panel, Cliente, Contrato, Gasto, Proveedor } from "../../types";
import { fb } from "../../services/firestore";
import { T, tCol } from "../../config/theme";
import { toast, confirmAsync } from "../../context/UIContext";
import { fmt, fmtF, dias, haptic } from "../../lib/utils";
import { Modal, FieldGroup, Badge, Card, Spinner } from "../ui";

function TrashModal({
  open,
  onClose,
  contratos,
  clientes,
  paneles,
  proveedores,
  setContratos,
  setClientes,
  setPaneles,
  setProveedores,
}: TrashModalProps) {
  const [tab, setTabT] = useState("contratos");
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [extraDeleted, setExtraDeleted] = useState({ clientes: [], paneles: [], proveedores: [] });

  // Load deleted items from Firebase when modal opens
  useEffect(() => {
    if (!open) return;
    const loadDeleted = async () => {
      setLoadingTrash(true);
      try {
        const [allCli, allPan, allPro] = await Promise.all([
          fb.get("clientes"),
          fb.get("paneles"),
          fb.get("proveedores"),
        ]);
        setExtraDeleted({
          clientes: (allCli || []).filter(x => x.deleted),
          paneles: (allPan || []).filter(x => x.deleted),
          proveedores: (allPro || []).filter(x => x.deleted),
        });
      } catch (e) {
        console.error("[Papelera] Error cargando elementos eliminados:", e);
      } finally {
        setLoadingTrash(false);
      }
    };
    loadDeleted();
  }, [open]);

  const deletedContratos = contratos.filter(c => c.deleted);

  const restaurarItem = async (col, id, setFn) => {
    try {
      await fb.patch(col, id, { deleted: false, deletedAt: null });
      if (col === "contratos") {
        setContratos(p =>
          p.map(x => (x.id === id ? { ...x, deleted: false, deletedAt: null } : x)),
        );
      } else if (col === "clientes") {
        setExtraDeleted(prev => ({ ...prev, clientes: prev.clientes.filter(x => x.id !== id) }));
        toast.success("Cliente restaurado");
      } else if (col === "paneles") {
        setExtraDeleted(prev => ({ ...prev, paneles: prev.paneles.filter(x => x.id !== id) }));
        toast.success("Panel restaurado");
      } else if (col === "proveedores") {
        setExtraDeleted(prev => ({
          ...prev,
          proveedores: prev.proveedores.filter(x => x.id !== id),
        }));
        toast.success("Proveedor restaurado");
      }
    } catch (e) {
      toast.error("Error al restaurar");
    }
  };

  const eliminarPermanente = async (col, id) => {
    if (
      !(await confirmAsync("Esta acción no se puede deshacer.", {
        title: "¿Eliminar definitivamente?",
        danger: true,
        ok: "Sí, eliminar",
      }))
    )
      return;
    try {
      await fb.del(col, id, { hardDelete: true });
      if (col === "contratos") {
        setContratos(p => p.filter(x => x.id !== id));
      } else if (col === "clientes") {
        setExtraDeleted(prev => ({ ...prev, clientes: prev.clientes.filter(x => x.id !== id) }));
      } else if (col === "paneles") {
        setExtraDeleted(prev => ({ ...prev, paneles: prev.paneles.filter(x => x.id !== id) }));
      } else if (col === "proveedores") {
        setExtraDeleted(prev => ({
          ...prev,
          proveedores: prev.proveedores.filter(x => x.id !== id),
        }));
      }
      toast.success("Eliminado permanentemente");
    } catch (e) {
      toast.error("Error al eliminar");
    }
  };

  const TABS = [
    { id: "contratos", label: "Contratos", count: deletedContratos.length },
    { id: "clientes", label: "Clientes", count: extraDeleted.clientes.length },
    { id: "paneles", label: "Paneles", count: extraDeleted.paneles.length },
    { id: "proveedores", label: "Proveedores", count: extraDeleted.proveedores.length },
  ].filter(t => true);

  const currentItems =
    tab === "contratos"
      ? deletedContratos
      : tab === "clientes"
        ? extraDeleted.clientes
        : tab === "paneles"
          ? extraDeleted.paneles
          : extraDeleted.proveedores;

  const getItemName = item => {
    if (tab === "contratos") {
      const panel = paneles.find(p => p.id === item.panel_id);
      const cliente = clientes.find(c => c.id === item.cliente_id);
      return `${panel?.nombre || "Panel"} · ${cliente?.empresa || "Cliente"}`;
    }
    return item.empresa || item.nombre || item.razonSocial || "Elemento";
  };

  const getItemSub = item => {
    if (tab === "contratos")
      return `S/ ${Number(item.monto || 0).toFixed(2)} · ${item.inicio || ""} → ${item.fin || ""}`;
    if (tab === "clientes") return item.email || item.celular || "";
    if (tab === "paneles") return item.ciudad || item.direccion || "";
    return item.categoria || "";
  };

  if (!open) return null;

  const totalDeleted =
    deletedContratos.length +
    extraDeleted.clientes.length +
    extraDeleted.paneles.length +
    extraDeleted.proveedores.length;

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 500,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 540,
          background: "#fff",
          borderRadius: "22px 22px 0 0",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          paddingBottom: "env(safe-area-inset-bottom)",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
        }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border }} />
        </div>

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 20px 12px",
            borderBottom: "1px solid #F1F3F8",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "#FEF2F2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={T.red}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="9" y1="13" x2="15" y2="13" />
                <line x1="9" y1="17" x2="11" y2="17" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0D1117" }}>
                Archivos Eliminados
              </div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>
                {totalDeleted} elemento{totalDeleted !== 1 ? "s" : ""} en la papelera
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#F1F3F8",
              border: "none",
              borderRadius: "50%",
              width: 32,
              height: 32,
              cursor: "pointer",
              touchAction: "manipulation",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6B7280",
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>

        {/* Sub-tabs */}
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: "10px 16px",
            overflowX: "auto",
            borderBottom: "1px solid #F1F3F8",
            flexShrink: 0,
          }}
        >
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTabT(t.id)}
              style={{
                padding: "5px 13px",
                borderRadius: 99,
                whiteSpace: "nowrap",
                background: tab === t.id ? T.dark : "transparent",
                border: `1px solid ${tab === t.id ? T.dark : T.border}`,
                color: tab === t.id ? "#fff" : "#6B7280",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                touchAction: "manipulation",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {t.label}
              {t.count > 0 && (
                <span
                  style={{
                    background: tab === t.id ? "rgba(255,255,255,0.2)" : "#F0F1F5",
                    color: tab === t.id ? "#fff" : "#6B7280",
                    borderRadius: 999,
                    padding: "0 6px",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ overflowY: "auto", flex: 1, padding: "12px 16px" }}>
          {loadingTrash ? (
            <div style={{ textAlign: "center", padding: 40, color: "#6B7280", fontSize: 13 }}>
              Cargando...
            </div>
          ) : currentItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "#F1F3F8",
                  margin: "0 auto 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9CA3AF"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1117", marginBottom: 4 }}>
                Sin archivos eliminados
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                Los elementos que elimines aparecerán aquí
              </div>
            </div>
          ) : (
            currentItems.map(item => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 14,
                  marginBottom: 8,
                  background: "#F8FAFC",
                  border: "1px solid #F1F3F8",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 11,
                    background: "#FEF2F2",
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
                    stroke={T.red}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#0D1117",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {getItemName(item)}
                  </div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                    {getItemSub(item)}
                  </div>
                  {item.deletedAt && (
                    <div style={{ fontSize: 10, color: "#D1D5DB", marginTop: 2 }}>
                      Eliminado:{" "}
                      {new Date(
                        item.deletedAt?.seconds ? item.deletedAt.seconds * 1000 : item.deletedAt,
                      ).toLocaleDateString("es-PE")}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {/* Restaurar */}
                  <button
                    onClick={() => restaurarItem(tab, item.id)}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: "#F0FDF4",
                      border: "1px solid #BBF7D0",
                      cursor: "pointer",
                      touchAction: "manipulation",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: T.green,
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
                  {/* Eliminar permanente */}
                  <button
                    onClick={() => eliminarPermanente(tab, item.id)}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: "#FEF2F2",
                      border: "2px solid #FECACA",
                      cursor: "pointer",
                      touchAction: "manipulation",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: T.red,
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
                      <line x1="4" y1="4" x2="20" y2="20" strokeWidth="2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div style={{ padding: "10px 16px 8px", borderTop: "1px solid #F1F3F8", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", lineHeight: 1.5 }}>
            Restaurar devuelve el elemento a su sección · ️ Eliminar es permanente e irreversible
          </div>
        </div>
      </div>
    </div>
  );
}

// DRAWER — menú lateral
// ══════════════════════════════════════════════════════════════════
const MENU_DRAWER = [
  { id: "capital", label: "Inversiones" },
  { id: "mapa", label: "Mapa" },
  { id: "historico", label: "Histórico" },
  { id: "reportes", label: "Reportes" },
  { id: "gastos", label: "Gastos" },
  { id: "proveedores", label: "Proveedores" },
  { id: "facturacion", label: "Facturación" },
];

// ── Íconos SVG del drawer (estilo trazo fino, azul Vista360) ─────
const DRAWER_ICONS = {
  capital: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2V6M12 18V22M4.93 4.93L7.76 7.76M16.24 16.24L19.07 19.07M2 12H6M18 12H22M4.93 19.07L7.76 16.24M16.24 7.76L19.07 4.93" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  ),
  mapa: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 4 L3 6 V20 L9 18 L15 20 L21 18 V4 L15 6 Z" />
      <line x1="9" y1="4" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="20" />
    </svg>
  ),
  historico: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <text
        x="12"
        y="17.5"
        textAnchor="middle"
        fontSize="6.5"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
        fontFamily="DM Sans, sans-serif"
      >
        17
      </text>
    </svg>
  ),
  resultados: (
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
      <polyline points="3 17 9 11 13 15 21 6" />
      <polyline points="15 6 21 6 21 12" />
    </svg>
  ),
  reportes: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 3 H7 a2 2 0 0 0 -2 2 V19 a2 2 0 0 0 2 2 H17 a2 2 0 0 0 2 -2 V8 Z" />
      <polyline points="14 3 14 8 19 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  ),
  gastos: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7 a2 2 0 0 1 2 -2 H17 a2 2 0 0 1 2 2" />
      <rect x="3" y="7" width="18" height="13" rx="2.5" />
      <path d="M16 14 H21" />
      <circle cx="17.5" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  ),
  proveedores: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  facturacion: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3 V21 L8.5 19.5 L11 21 L13 19.5 L15 21 L17.5 19.5 L20 21 V3 L17.5 4.5 L15 3 L13 4.5 L11 3 L8.5 4.5 Z" />
      <line x1="9" y1="9" x2="17" y2="9" />
      <line x1="9" y1="13" x2="17" y2="13" />
      <line x1="9" y1="17" x2="14" y2="17" />
    </svg>
  ),
};

// ══════════════════════════════════════════════════════════════════
// BÚSQUEDA GLOBAL
// ══════════════════════════════════════════════════════════════════

export default TrashModal;
