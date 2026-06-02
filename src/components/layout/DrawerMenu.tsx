// @ts-nocheck — legacy file: migrating to strict TypeScript gradually
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import type { Panel, Cliente, Contrato, Gasto, Proveedor } from "../../types";
import { fb } from "../../services/firestore";
import { T, tCol } from "../../config/theme";
import { toast, confirmAsync } from "../../context/UIContext";
import { fmt, fmtF, dias, haptic } from "../../lib/utils";
import { Modal, FieldGroup, Badge, Card, Spinner } from "../ui";

// ── Menú drawer: solo los destinos que NO están en el bottom bar ──
// El bottom bar ya tiene: Inicio, Contratos, Clientes, Paneles
const MENU_DRAWER = [
  { id: "mapa", label: "Mapa" },
  { id: "gastos", label: "Gastos" },
  { id: "facturacion", label: "Facturación" },
  { id: "reportes", label: "Reportes" },
  { id: "capital", label: "Capital" },
  { id: "proveedores", label: "Proveedores" },
  { id: "historico", label: "Histórico" },
];

// ── Iconos del drawer por id de tab ───────────────────────────────
const DRAWER_ICONS: Record<string, React.ReactNode> = {
  hoy: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path
        d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.552 5.448 21 6 21H9M19 10L21 12M19 10V20C19 20.552 18.552 21 18 21H15M9 21V15C9 14.448 9.448 14 10 14H14C14.552 14 15 14.448 15 15V21M9 21H15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  paneles: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  contratos: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path
        d="M9 12H15M9 16H15M17 21H7C5.895 21 5 20.105 5 19V5C5 3.895 5.895 3 7 3H14L19 8V19C19 20.105 18.105 21 17 21Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  historico: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 8V12L15 15M21 12C21 16.971 16.971 21 12 21C7.029 21 3 16.971 3 12C3 7.029 7.029 3 12 3C16.971 3 21 7.029 21 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  crm: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path
        d="M17 21V19C17 17.343 15.657 16 14 16H10C8.343 16 7 17.343 7 19V21M12 13C14.209 13 16 11.209 16 9C16 6.791 14.209 5 12 5C9.791 5 8 6.791 8 9C8 11.209 9.791 13 12 13Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  gastos: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path
        d="M3 10H21M7 15H8M12 15H13M6 19H18C19.105 19 20 18.105 20 17V7C20 5.895 19.105 5 18 5H6C4.895 5 4 5.895 4 7V17C4 18.105 4.895 19 6 19Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  proveedores: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path
        d="M19 21V5C19 3.895 18.105 3 17 3H7C5.895 3 5 3.895 5 5V21M3 21H21M9 21V15H15V21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  facturacion: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path
        d="M9 5H7C5.895 5 5 5.895 5 7V19C5 20.105 5.895 21 7 21H17C18.105 21 19 20.105 19 19V7C19 5.895 18.105 5 17 5H15M9 5C9 5.552 9.448 6 10 6H14C14.552 6 15 5.552 15 5M9 5C9 4.448 9.448 4 10 4H14C14.552 4 15 4.448 15 5M12 11V17M9 14H15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  capital: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path
        d="M13 7H7M13 11H7M17 15H7M3 5C3 3.895 3.895 3 5 3H19C20.105 3 21 3.895 21 5V19C21 20.105 20.105 21 19 21H5C3.895 21 3 20.105 3 19V5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  reportes: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path
        d="M9 19V13M12 19V7M15 19V13M3 20H21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  mapa: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path
        d="M9 20L3 17V4L9 7M9 20L15 17M9 20V7M15 17L21 20V7L15 4M15 17V4M9 7L15 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

// ── CSS del efecto glass (iguales a 8 Millas / Cyber) ─────────────
const GLASS_CSS = `
  .v360-nav-glass {
    position: relative;
    background: linear-gradient(
      160deg,
      rgba(255,255,255,0.07) 0%,
      rgba(255,255,255,0.03) 50%,
      rgba(255,255,255,0.05) 100%
    );
    backdrop-filter: blur(20px) saturate(180%) brightness(1.1);
    -webkit-backdrop-filter: blur(20px) saturate(180%) brightness(1.1);
    border: 1px solid rgba(255,255,255,0.38) !important;
    box-shadow:
      0 6px 24px rgba(0,0,0,0.35),
      0 2px 6px rgba(0,0,0,0.2),
      inset 0px 4px 12px rgba(255,255,255,0.8),
      inset 0px -3px 8px rgba(0,0,0,0.18),
      inset 2px 0px 6px rgba(255,255,255,0.15);
    overflow: hidden;
    isolation: isolate;
    transition: all 0.2s cubic-bezier(0.25,0.46,0.45,0.94);
  }
  /* Shimmer iridiscente azul→magenta */
  .v360-nav-glass::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      110deg,
      rgba(99,179,255,0.13) 0%,
      rgba(168,100,255,0.09) 45%,
      rgba(255,100,180,0.06) 75%,
      transparent 100%
    );
    border-radius: inherit;
    pointer-events: none;
  }
  /* Franja blanca especular en el canto superior */
  .v360-nav-glass::after {
    content: "";
    position: absolute;
    top: 0;
    left: 8%;
    right: 8%;
    height: 2px;
    background: linear-gradient(
      to right,
      transparent 0%,
      rgba(255,255,255,0.9) 30%,
      rgba(255,255,255,1) 50%,
      rgba(255,255,255,0.9) 70%,
      transparent 100%
    );
    filter: blur(0.5px);
    pointer-events: none;
  }
  .v360-nav-btn:hover:not(.v360-nav-glass) {
    background: rgba(255,255,255,0.06) !important;
    color: rgba(255,255,255,0.8) !important;
  }
`;

function DrawerMenu({
  open,
  onClose,
  activeTab,
  onTabClick,
  onTrashOpen,
  trashCount = 0,
  userName = "",
  userInitials = "?",
}: DrawerMenuProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Focus trap completo: Escape cierra, Tab/Shift+Tab ciclan dentro del drawer.
  useEffect(() => {
    if (!open || !drawerRef.current) return;
    const FOCUSABLE_SEL = [
      "button:not([disabled])",
      "a[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(", ");
    const getFocusable = (): HTMLElement[] =>
      Array.from(drawerRef.current!.querySelectorAll<HTMLElement>(FOCUSABLE_SEL));

    const focusable = getFocusable();
    if (focusable.length) focusable[0].focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const els = getFocusable();
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      {/* Inyectar CSS del glass una sola vez */}
      <style>{GLASS_CSS}</style>

      {open && (
        <div
          aria-hidden="true"
          onClick={onClose}
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            background: "rgba(15,23,41,0.45)",
            zIndex: 2000,
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
        />
      )}

      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: 280,
          // Fondo oscuro — necesario para que el glass tenga contraste
          background: "#0D1629",
          zIndex: 2001,
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s cubic-bezier(.4,0,.2,1)",
          boxShadow: open ? "4px 0 40px rgba(0,0,0,0.4), 1px 0 0 rgba(255,255,255,0.06)" : "none",
          display: "flex",
          flexDirection: "column",
          paddingTop: "max(20px, env(safe-area-inset-top))",
          paddingBottom: "env(safe-area-inset-bottom)",
          overflow: "hidden",
        }}
      >
        {/* ── Logo / Marca ── */}
        <div
          style={{
            padding: "4px 20px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "rgba(255,255,255,0.22)",
              letterSpacing: "2px",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Vista360
          </div>

          {/* ── Perfil de usuario ── */}
          <button
            onClick={() => {
              onTabClick("/perfil");
              onClose();
            }}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              cursor: "pointer",
              touchAction: "manipulation",
              textAlign: "left",
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #1E3A8A 0%, #1E40AF 60%, #2A5BD9 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 800,
                fontSize: 15,
                flexShrink: 0,
                letterSpacing: "0.5px",
                boxShadow: "0 6px 18px rgba(30,58,138,0.45), inset 0 1px 0 rgba(255,255,255,0.2)",
              }}
            >
              {userInitials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.92)",
                  letterSpacing: "-0.2px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {userName || "—"}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "rgba(255,255,255,0.32)",
                  marginTop: 2,
                  fontWeight: 500,
                }}
              >
                8 Millas
              </div>
            </div>
            <svg
              width="13"
              height="13"
              fill="none"
              viewBox="0 0 24 24"
              style={{ opacity: 0.28, flexShrink: 0 }}
            >
              <path
                d="M9 18l6-6-6-6"
                stroke="#fff"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* ── Label sección ── */}
        <div
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: "rgba(255,255,255,0.2)",
            letterSpacing: "1.8px",
            textTransform: "uppercase",
            padding: "14px 20px 6px",
          }}
        >
          Principal
        </div>

        {/* ── Items del menú ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "2px 10px 8px" }}>
          {MENU_DRAWER.map(item => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`v360-nav-btn${active ? " v360-nav-glass" : ""}`}
                onClick={() => {
                  onTabClick(item.id);
                  onClose();
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "9px 14px",
                  margin: "1px 0",
                  borderRadius: 10,
                  background: "transparent",
                  border: "1px solid transparent",
                  cursor: "pointer",
                  touchAction: "manipulation",
                  transition: "all 0.15s",
                  color: active ? "#fff" : "rgba(255,255,255,0.45)",
                }}
              >
                {/* Icono */}
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: "currentColor",
                  }}
                >
                  {DRAWER_ICONS[item.id]}
                </span>

                {/* Label */}
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: active ? 700 : 600,
                    color: "currentColor",
                    flex: 1,
                    textAlign: "left",
                    letterSpacing: "-0.1px",
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            padding: "8px 10px 14px",
            marginTop: "auto",
            flexShrink: 0,
            borderTop: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {/* Archivados */}
          <button
            onClick={() => {
              onClose();
              onTrashOpen?.();
            }}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "9px 14px",
              borderRadius: 10,
              background: "rgba(239,68,68,0.10)",
              border: "1px solid rgba(239,68,68,0.18)",
              cursor: "pointer",
              touchAction: "manipulation",
              color: "rgba(248,113,113,0.85)",
              transition: "background 0.15s",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 700, flex: 1, textAlign: "left" }}>
              Archivados
            </span>
            {trashCount > 0 && (
              <span
                style={{
                  background: "rgba(239,68,68,0.8)",
                  color: "#fff",
                  borderRadius: 99,
                  padding: "2px 8px",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {trashCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// BOTTOM TAB BAR ICONS
// ══════════════════════════════════════════════════════════════════
const BTM_ICONS = {
  hoy: (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <path
        d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.552 5.448 21 6 21H9M19 10L21 12M19 10V20C19 20.552 18.552 21 18 21H15M9 21V15C9 14.448 9.448 14 10 14H14C14.552 14 15 14.448 15 15V21M9 21H15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  paneles: (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  contratos: (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <path
        d="M9 12H15M9 16H15M17 21H7C5.895 21 5 20.105 5 19V5C5 3.895 5.895 3 7 3H14L19 8V19C19 20.105 18.105 21 17 21Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  crm: (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <path
        d="M17 21V19C17 17.343 15.657 16 14 16H10C8.343 16 7 17.343 7 19V21M12 13C14.209 13 16 11.209 16 9C16 6.791 14.209 5 12 5C9.791 5 8 6.791 8 9C8 11.209 9.791 13 12 13Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
};

const BOTTOM_TABS_LIST = [
  { id: "hoy", label: "Inicio" },
  { id: "paneles", label: "Paneles" },
  { id: "__add__", label: "" },
  { id: "contratos", label: "Contratos" },
  { id: "crm", label: "Clientes" },
];

// IDs navegables con flechas (excluye el botón especial __add__)
const NAV_TAB_IDS = BOTTOM_TABS_LIST.filter(t => t.id !== "__add__").map(t => t.id);

// ── WHITELIST de emails autorizados ─────────────────────────────
const ALLOWED_EMAILS: string[] = (import.meta.env.VITE_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e: string) => e.trim())
  .filter(Boolean);

export default DrawerMenu;
