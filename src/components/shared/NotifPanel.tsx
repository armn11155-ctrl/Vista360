// @ts-nocheck — legacy file: migrating to strict TypeScript gradually
import React, { useState, useMemo, useEffect, useCallback } from "react";
import type { Panel, Cliente, Contrato, Gasto, Proveedor } from "../../types";
import { fb } from "../../services/firestore";
import { T, tCol } from "../../config/theme";
import { toast, confirmAsync } from "../../context/UIContext";
import { fmt, fmtF, dias, haptic } from "../../lib/utils";
import { Modal, FieldGroup, Badge, Card, Spinner } from "../ui";

function NotifPanel({ open, onClose, contratos, clientes, paneles, gastos }: NotifPanelProps) {
  const [leidas, setLeidas] = useState({});
  const [filtro, setFiltro] = useState("todas");

  const notifs = useMemo(() => {
    const hoyD = new Date();
    const lista = [];

    // Contratos por vencer (próximos 30 días)
    contratos.forEach(c => {
      const d = Math.ceil((new Date(c.fin).getTime() - hoyD.getTime()) / 86400000);
      if (d > 0 && d <= 30) {
        const cliente = clientes.find(cl => cl.id === c.cliente_id);
        const panel = paneles.find(p => p.id === c.panel_id);
        lista.push({
          id: `cv_${c.id}`,
          tipo: "contrato",
          titulo: `Contrato por vencer — ${cliente?.empresa || "Cliente"}`,
          desc: `Vence en ${d} día${d === 1 ? "" : "s"}. Panel: ${panel?.nombre || "—"} · ${fmt(c.monto)}/mes`,
          tiempo: `En ${d} días`,
        });
      }
    });

    // Facturas sin pagar
    contratos
      .filter(c => !c.pagado && c.monto > 0)
      .forEach(c => {
        const cliente = clientes.find(cl => cl.id === c.cliente_id);
        lista.push({
          id: `fp_${c.id}`,
          tipo: "factura",
          titulo: `Factura pendiente — ${cliente?.empresa || "Cliente"}`,
          desc: `${fmt(c.monto)} sin registrar como pagado.`,
          tiempo: "Pendiente",
        });
      });

    // Paneles sin contrato activo
    paneles.forEach(p => {
      const tieneActivo = contratos.some(c => c.panel_id === p.id && new Date(c.fin) > hoyD);
      if (!tieneActivo) {
        lista.push({
          id: `pl_${p.id}`,
          tipo: "panel",
          titulo: `Panel libre — ${p.nombre}`,
          desc: "Sin contrato activo. Oportunidad de venta.",
          tiempo: "Disponible",
        });
      }
    });

    // Clientes inactivos (sin contratos en los últimos 90 días)
    clientes.forEach(cl => {
      const tieneReciente = contratos.some(
        c =>
          c.cliente_id === cl.id &&
          Math.ceil((hoyD.getTime() - new Date(c.fin).getTime()) / 86400000) < 90,
      );
      if (!tieneReciente) {
        lista.push({
          id: `ci_${cl.id}`,
          tipo: "cliente",
          titulo: `Cliente inactivo — ${cl.empresa}`,
          desc: "Sin contratos en los últimos 3 meses.",
          tiempo: "+90 días",
        });
      }
    });

    // Meta mensual alcanzada (meta: S/ 10,000)
    const mesHoyKey = `${hoyD.getFullYear()}-${String(hoyD.getMonth() + 1).padStart(2, "0")}`;
    const ingresoMes = contratos
      .filter(c => c.pagado && (c.inicio || "").startsWith(mesHoyKey))
      .reduce((a, c) => a + Number(c.monto || 0), 0);
    if (ingresoMes >= 10000) {
      lista.push({
        id: "meta_mes",
        tipo: "meta",
        titulo: "Meta mensual alcanzada",
        desc: `Superaste ${fmt(ingresoMes)} este mes.`,
        tiempo: "Este mes",
      });
    }

    return lista.slice(0, 20);
  }, [contratos, clientes, paneles]);

  const CFG = {
    contrato: {
      svg: (
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
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="10" y1="14" x2="14" y2="14" />
        </svg>
      ),
      bg: "rgba(245,158,11,0.16)",
      ic: "#F0B65B",
      dot: "#EF9F27",
    },
    factura: {
      svg: (
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
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="13" x2="15" y2="13" />
          <line x1="9" y1="17" x2="13" y2="17" />
        </svg>
      ),
      bg: "rgba(239,68,68,0.16)",
      ic: "#F87171",
      dot: "#E24B4A",
    },
    panel: {
      svg: (
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
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
      bg: "rgba(59,130,246,0.16)",
      ic: "#60A5FA",
      dot: "#378ADD",
    },
    cliente: {
      svg: (
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
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
          <line x1="4" y1="4" x2="20" y2="20" />
        </svg>
      ),
      bg: "rgba(245,158,11,0.16)",
      ic: "#F0B65B",
      dot: "#EF9F27",
    },
    meta: {
      svg: (
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
          <polyline points="6 9 12 3 18 9" />
          <path d="M6 9h12v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" />
          <line x1="9" y1="22" x2="9" y2="15" />
          <line x1="15" y1="22" x2="15" y2="15" />
        </svg>
      ),
      bg: "rgba(34,197,94,0.16)",
      ic: "#86EFAC",
      dot: "#639922",
    },
  };

  const visibles = filtro === "todas" ? notifs : notifs.filter(n => n.tipo === filtro);
  const noLeidas = notifs.filter(n => !leidas[n.id]).length;
  const marcarTodas = () => {
    const t: Record<string, boolean> = {};
    notifs.forEach(n => {
      t[n.id] = true;
    });
    setLeidas(t);
  };

  if (!open) return null;

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 600,
        background: "rgba(0,0,0,0.25)",
      }}
    >
      <div
        style={{
          position: "fixed",
          top: "max(64px, calc(env(safe-area-inset-top) + 12px))",
          right: 12,
          width: "min(360px, calc(100vw - 24px))",
          background: T.card,
          borderRadius: 20,
          border: `1px solid ${T.border}`,
          maxHeight: "72vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px 10px",
            borderBottom: `1px solid ${T.border}`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Notificaciones</span>
            {noLeidas > 0 && (
              <span
                style={{
                  background: T.red,
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 99,
                  padding: "1px 7px",
                }}
              >
                {noLeidas}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {noLeidas > 0 && (
              <button
                onClick={marcarTodas}
                style={{
                  fontSize: 11,
                  color: T.muted,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  touchAction: "manipulation",
                  padding: "3px 6px",
                }}
              >
                Marcar leídas
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: T.border,
                border: "none",
                borderRadius: 8,
                padding: "4px 10px",
                color: T.muted,
                cursor: "pointer",
                touchAction: "manipulation",
                fontSize: 14,
              }}
            ></button>
          </div>
        </div>

        {/* Filtros */}
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: "10px 12px",
            overflowX: "auto",
            borderBottom: `1px solid ${T.border}`,
            flexShrink: 0,
          }}
        >
          {["todas", "contrato", "factura", "panel", "cliente", "meta"].map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              style={{
                padding: "4px 11px",
                borderRadius: 99,
                border: `1px solid ${filtro === f ? T.accent : T.border}`,
                background: filtro === f ? T.accent : "transparent",
                color: filtro === f ? "#fff" : T.muted,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                touchAction: "manipulation",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {
                {
                  todas: "Todas",
                  contrato: "Contratos",
                  factura: "Facturas",
                  panel: "Paneles",
                  cliente: "Clientes",
                  meta: "Metas",
                }[f]
              }
            </button>
          ))}
        </div>

        {/* Lista */}
        <div style={{ overflowY: "auto", flex: 1, padding: "8px 10px" }}>
          {visibles.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: T.muted, fontSize: 13 }}>
              Sin notificaciones
            </div>
          ) : (
            visibles.map(n => {
              const cfg = CFG[n.tipo] || CFG.contrato;
              const isLeida = !!leidas[n.id];
              return (
                <div
                  key={n.id}
                  onClick={() => setLeidas(l => ({ ...l, [n.id]: true }))}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 8px",
                    borderRadius: 12,
                    marginBottom: 4,
                    background: isLeida ? "transparent" : T.dark,
                    cursor: "pointer",
                    touchAction: "manipulation",
                    opacity: isLeida ? 0.45 : 1,
                    transition: "opacity .15s",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: cfg.bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: cfg.ic,
                    }}
                  >
                    {cfg.svg}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: T.text,
                        marginBottom: 2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {n.titulo}
                    </div>
                    <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.4 }}>{n.desc}</div>
                    <div style={{ fontSize: 10, color: T.muted, marginTop: 3 }}>{n.tiempo}</div>
                  </div>
                  {!isLeida && (
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: cfg.dot,
                        flexShrink: 0,
                        marginTop: 5,
                      }}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ️ ERROR BOUNDARY — captura errores de cualquier tab hijo
// Si un componente explota (datos corruptos, edge-case no previsto),
// el resto de la app sigue funcionando. El usuario ve un fallback
// amigable en lugar de una pantalla en blanco.
// ══════════════════════════════════════════════════════════════════
interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  retryCount: number;
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; label?: string },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; label?: string }) {
    super(props);
    this.state = { hasError: false, message: "", retryCount: 0 };
  }
  static getDerivedStateFromError(err: unknown): Partial<ErrorBoundaryState> {
    const message = err instanceof Error ? err.message : String(err);
    return { hasError: true, message };
  }
  componentDidCatch(err: unknown, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label ?? "?"}]`, err, info.componentStack);
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    const canRetry = this.state.retryCount < 3;
    return (
      <div
        style={{
          margin: "24px 16px",
          padding: "24px 20px",
          background: "#fff",
          border: "1px solid #FCA5A5",
          borderRadius: 16,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 10 }}></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>
          Algo salió mal{this.props.label ? ` en ${this.props.label}` : ""}
        </div>
        <div
          style={{
            fontSize: 12,
            color: T.muted,
            marginBottom: 18,
            fontFamily: "monospace",
            wordBreak: "break-word",
          }}
        >
          {this.state.message}
        </div>
        {canRetry ? (
          <button
            onClick={() =>
              this.setState(s => ({ hasError: false, message: "", retryCount: s.retryCount + 1 }))
            }
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              background: T.accent,
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Reintentar ({3 - this.state.retryCount} intentos restantes)
          </button>
        ) : (
          <div style={{ fontSize: 12, color: T.muted }}>Refresca la página para continuar.</div>
        )}
      </div>
    );
  }
}

// ── Color del header/status-bar según la pestaña activa ─────────
// Función pura: solo lee T.* (constantes de módulo) y parámetros.
// Vivir a nivel módulo evita que se redefina en cada render de App.
function getHeaderColor(t: string, profile: boolean): string {
  if (profile) return T.bg;
  if (t === "hoy" || t === "capital" || t === "contratos") return "#0E1A3B";
  if (t === "historico") return "#0A0F1A";
  if (t === "crm") return T.accent;
  if (t === "mapa") return "#070D1C";
  return T.bg;
}

// ══════════════════════════════════════════════════════════════════
// APP ROOT — nuevo diseño + lógica Firebase original
// ══════════════════════════════════════════════════════════════════

export default NotifPanel;
