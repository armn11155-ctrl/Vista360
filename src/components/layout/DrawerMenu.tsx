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


// ── CSS liquid glass 3D para el botón Archivados ─────────────────
const ARCHIVE_GLASS_CSS = `
  .v360-archive-glass {
    position: relative;
    background: linear-gradient(
      180deg,
      rgba(33,44,72,0.75) 0%,
      rgba(14,26,59,0.88) 100%
    ) !important;
    backdrop-filter: blur(6px) saturate(140%) brightness(1.05) !important;
    -webkit-backdrop-filter: blur(6px) saturate(140%) brightness(1.05) !important;
    border: 1px solid rgba(255,255,255,0.52) !important;
    box-shadow:
      0 6px 20px rgba(14,26,59,0.40),
      0 2px 6px rgba(0,0,0,0.18),
      inset 0 1px 0 rgba(255,255,255,0.50),
      inset 0 -1px 0 rgba(0,0,0,0.25) !important;
    overflow: hidden;
    isolation: isolate;
  }
  .v360-archive-glass::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 55%;
    background: linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.0) 100%);
    border-radius: inherit;
    pointer-events: none;
    z-index: 0;
  }
  .v360-archive-glass::after {
    content: "";
    position: absolute;
    top: 0; left: 10%; right: 10%;
    height: 1.5px;
    background: linear-gradient(
      to right,
      transparent 0%,
      rgba(255,255,255,0.90) 35%,
      rgba(255,255,255,1) 50%,
      rgba(255,255,255,0.90) 65%,
      transparent 100%
    );
    filter: blur(0.3px);
    pointer-events: none;
    z-index: 0;
  }
  .v360-archive-glass > * {
    position: relative;
    z-index: 1;
  }
\`;

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
  // Al abrir, el foco va automáticamente al primer elemento focusable.
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

    // Enfocar el primer elemento al abrir
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
      <style>{ARCHIVE_GLASS_CSS}</style>
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
          width: 300,
          background: T.white,
          zIndex: 2001,
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s cubic-bezier(.4,0,.2,1)",
          boxShadow: open ? "4px 0 32px rgba(0,0,0,0.12)" : "none",
          display: "flex",
          flexDirection: "column",
          paddingTop: "max(20px, env(safe-area-inset-top))",
          paddingBottom: "env(safe-area-inset-bottom)",
          overflow: "hidden",
        }}
      >
        {/* ── Perfil de usuario ── */}
        <button
          onClick={() => {
            onTabClick("/perfil");
            onClose();
          }}
          style={{
            padding: "16px 22px 20px",
            background: "none",
            border: "none",
            cursor: "pointer",
            touchAction: "manipulation",
            textAlign: "left",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #1E3A8A 0%, #1E40AF 60%, #2A5BD9 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: T.white,
                fontWeight: 800,
                fontSize: 17,
                flexShrink: 0,
                letterSpacing: "0.5px",
                boxShadow: "0 10px 24px rgba(30,58,138,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
              }}
            >
              {userInitials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{ fontSize: 17, fontWeight: 800, color: T.text, letterSpacing: "-0.3px" }}
              >
                {userName || "—"}
              </div>
              <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 2, fontWeight: 500 }}>
                8 Millas
              </div>
            </div>
            <svg
              width="14"
              height="14"
              fill="none"
              viewBox="0 0 24 24"
              style={{ opacity: 0.32, flexShrink: 0 }}
            >
              <path
                d="M9 18l6-6-6-6"
                stroke="#0F1729"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </button>

        {/* ── Items del menú ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 14px 8px" }}>
          {MENU_DRAWER.map((item, idx) => {
            const active = activeTab === item.id;
            const nextActive =
              idx < MENU_DRAWER.length - 1 && activeTab === MENU_DRAWER[idx + 1]?.id;
            const showDivider = idx < MENU_DRAWER.length - 1 && !active && !nextActive;
            return (
              <div key={item.id}>
                <button
                  onClick={() => {
                    onTabClick(item.id);
                    onClose();
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "10px 12px",
                    margin: "2px 0",
                    borderRadius: 16,
                    background: active
                      ? "linear-gradient(90deg, #DBE7FF 0%, #ECF2FF 100%)"
                      : "transparent",
                    border: "none",
                    cursor: "pointer",
                    touchAction: "manipulation",
                    transition: "background 0.18s ease",
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: active ? T.white : "#F5F7FB",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: active ? T.accent : "#1E3A8A",
                      flexShrink: 0,
                      boxShadow: active
                        ? "0 4px 12px rgba(37,99,235,0.18), inset 0 0 0 1px rgba(37,99,235,0.10)"
                        : "inset 0 0 0 1px rgba(15,23,41,0.04)",
                    }}
                  >
                    {DRAWER_ICONS[item.id]}
                  </div>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: active ? 700 : 500,
                      color: active ? T.accent : "#0F1729",
                      flex: 1,
                      textAlign: "left",
                      letterSpacing: "-0.2px",
                    }}
                  >
                    {item.label}
                  </span>
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    viewBox="0 0 24 24"
                    style={{ opacity: active ? 0.6 : 0.32, flexShrink: 0 }}
                  >
                    <path
                      d="M9 18l6-6-6-6"
                      stroke={active ? T.accent : "#0F1729"}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {showDivider && (
                  <div style={{ height: 1, background: "#F1F3F8", margin: "0 18px" }} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            position: "relative",
            padding: "8px 14px 18px",
            marginTop: "auto",
            flexShrink: 0,
            borderTop: "1px solid #F1F3F8",
          }}
        >
          <button
            onClick={() => {
              onClose();
              onTrashOpen?.();
            }}
            className="v360-archive-glass"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "11px 14px",
              borderRadius: 14,
              background: "#EFF4FF",
              border: "1px solid #BFDBFE",
              cursor: "pointer",
              touchAction: "manipulation",
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: T.accent,
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
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Archivados</div>
              {trashCount > 0 && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 1 }}>
                  {trashCount} elemento{trashCount !== 1 ? "s" : ""} archivados
                </div>
              )}
            </div>
            {trashCount > 0 && (
              <span
                style={{
                  background: T.accent,
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
