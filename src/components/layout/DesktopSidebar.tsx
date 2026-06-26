import { useLocation } from "react-router-dom";
import { T } from "../../config/theme";

interface DesktopSidebarProps {
  onTabClick: (path: string) => void;
  onTrashOpen: () => void;
  onProfileClick: () => void;
  userName: string;
  userInitials: string;
  trashCount: number;
  showProfile: boolean;
}

const NAV_ITEMS: ({ id: string; path: string; label: string } | null)[] = [
  { id: "hoy",       path: "/",            label: "Inicio"      },
  { id: "paneles",   path: "/paneles",     label: "Paneles"     },
  { id: "contratos", path: "/contratos",   label: "Contratos"   },
  { id: "crm",       path: "/crm",         label: "Clientes"    },
  { id: "gastos",      path: "/gastos",      label: "Gastos"      },
  { id: "proveedores", path: "/proveedores", label: "Proveedores" },
  { id: "mapa",        path: "/mapa",        label: "Mapa"        },
  { id: "facturacion", path: "/facturacion", label: "Facturación" },
  { id: "historico",   path: "/historico",   label: "Histórico"   },
  { id: "reportes",    path: "/reportes",    label: "Reportes"    },
  { id: "capital",     path: "/capital",     label: "Capital"     },
];

const ICONS: Record<string, React.ReactNode> = {
  hoy: (
    <svg width="19" height="19" fill="none" viewBox="0 0 24 24">
      <path d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.552 5.448 21 6 21H9M19 10L21 12M19 10V20C19 20.552 18.552 21 18 21H15M9 21V15C9 14.448 9.448 14 10 14H14C14.552 14 15 14.448 15 15V21M9 21H15"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  paneles: (
    <svg width="19" height="19" fill="none" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  contratos: (
    <svg width="19" height="19" fill="none" viewBox="0 0 24 24">
      <path d="M9 12H15M9 16H15M17 21H7C5.895 21 5 20.105 5 19V5C5 3.895 5.895 3 7 3H14L19 8V19C19 20.105 18.105 21 17 21Z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  crm: (
    <svg width="19" height="19" fill="none" viewBox="0 0 24 24">
      <path d="M17 21V19C17 17.343 15.657 16 14 16H10C8.343 16 7 17.343 7 19V21M12 13C14.209 13 16 11.209 16 9C16 6.791 14.209 5 12 5C9.791 5 8 6.791 8 9C8 11.209 9.791 13 12 13Z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  gastos: (
    <svg width="19" height="19" fill="none" viewBox="0 0 24 24">
      <path d="M3 10H21M7 15H8M12 15H13M6 19H18C19.105 19 20 18.105 20 17V7C20 5.895 19.105 5 18 5H6C4.895 5 4 5.895 4 7V17C4 18.105 4.895 19 6 19Z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  proveedores: (
    <svg width="19" height="19" fill="none" viewBox="0 0 24 24">
      <path d="M19 21V5C19 3.895 18.105 3 17 3H7C5.895 3 5 3.895 5 5V21M3 21H21M9 21V15H15V21"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  mapa: (
    <svg width="19" height="19" fill="none" viewBox="0 0 24 24">
      <path d="M9 20L3 17V4L9 7M9 20L15 17M9 20V7M15 17L21 20V7L15 4M15 17V4M9 7L15 4"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  facturacion: (
    <svg width="19" height="19" fill="none" viewBox="0 0 24 24">
      <path d="M9 5H7C5.895 5 5 5.895 5 7V19C5 20.105 5.895 21 7 21H17C18.105 21 19 20.105 19 19V7C19 5.895 18.105 5 17 5H15M9 5C9 5.552 9.448 6 10 6H14C14.552 6 15 5.552 15 5M9 5C9 4.448 9.448 4 10 4H14C14.552 4 15 4.448 15 5M12 11V17M9 14H15"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  historico: (
    <svg width="19" height="19" fill="none" viewBox="0 0 24 24">
      <path d="M12 8V12L15 15M21 12C21 16.971 16.971 21 12 21C7.029 21 3 16.971 3 12C3 7.029 7.029 3 12 3C16.971 3 21 7.029 21 12Z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  reportes: (
    <svg width="19" height="19" fill="none" viewBox="0 0 24 24">
      <path d="M9 19V13M12 19V7M15 19V13M3 20H21"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  capital: (
    <svg width="19" height="19" fill="none" viewBox="0 0 24 24">
      <path d="M13 7H7M13 11H7M17 15H7M3 5C3 3.895 3.895 3 5 3H19C20.105 3 21 3.895 21 5V19C21 20.105 20.105 21 19 21H5C3.895 21 3 20.105 3 19V5Z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};

export function DesktopSidebar({
  onTabClick,
  onTrashOpen,
  onProfileClick,
  userName,
  userInitials,
  trashCount,
  showProfile,
}: DesktopSidebarProps) {
  const location = useLocation();
  const activePath = showProfile ? "/perfil" : location.pathname;

  return (
    <aside
      style={{
        width: 175,
        flexShrink: 0,
        height: "100vh",
        position: "sticky",
        top: 0,
        display: "flex",
        flexDirection: "column",
        background: T.white,
        borderRight: "1px solid rgba(15,23,41,0.07)",
        overflowY: "auto",
        overflowX: "hidden",
        zIndex: 10,
      }}
    >
      {/* ── Perfil del usuario ── */}
      <div
        style={{
          padding: "12px",
          borderBottom: "1px solid rgba(15,23,41,0.06)",
        }}
      >
        <button
          onClick={onProfileClick}
          aria-current={showProfile ? "page" : undefined}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            borderRadius: 14,
            background: showProfile
              ? "linear-gradient(90deg,#DBE7FF 0%,#ECF2FF 100%)"
              : "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            outline: "none",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg,#081740,#1558D6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: "0.5px",
              flexShrink: 0,
              boxShadow: "0 2px 8px rgba(21,88,214,0.35)",
              border: showProfile ? `2px solid ${T.accent}` : "2px solid transparent",
            }}
          >
            {userInitials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: showProfile ? T.accent : "#0F1729",
                letterSpacing: "-0.2px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {userName || "Mi cuenta"}
            </div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>Ver perfil</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={showProfile ? T.accent : "#94A3B8"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </button>
      </div>

      {/* ── Navegación ── */}
      <nav style={{ flex: 1, padding: "10px 10px", overflowY: "auto" }}>
        {NAV_ITEMS.map((item, idx) => {
          if (item === null) {
            return (
              <div
                key={`sep-${idx}`}
                style={{ height: 1, background: "#F1F3F8", margin: "6px 6px" }}
              />
            );
          }
          const active = activePath === item.path || (item.path === "/" && activePath === "/");
          return (
            <button
              key={item.id}
              onClick={() => onTabClick(item.path)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                marginBottom: 2,
                borderRadius: 14,
                background: active
                  ? "linear-gradient(90deg,#DBE7FF 0%,#ECF2FF 100%)"
                  : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s ease",
                textAlign: "left",
                outline: "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: active ? T.white : "#F5F7FB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: active ? T.accent : "#1E3A8A",
                  flexShrink: 0,
                  boxShadow: active
                    ? "0 3px 10px rgba(37,99,235,0.18)"
                    : "inset 0 0 0 1px rgba(15,23,41,0.04)",
                }}
              >
                {ICONS[item.id]}
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? T.accent : "#0F1729",
                  letterSpacing: "-0.2px",
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ── Archivados ── */}
      <div style={{ padding: "10px 10px 20px", borderTop: "1px solid #F1F3F8" }}>
        <button
          onClick={onTrashOpen}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 14,
            background: "#EFF4FF",
            border: "1px solid #BFDBFE",
            cursor: "pointer",
            position: "relative",
            overflow: "visible",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: T.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1D4ED8" }}>Archivados</div>
            {trashCount > 0 && (
              <div style={{ fontSize: 11, color: "#3B82F6", marginTop: 1 }}>
                {trashCount} elemento{trashCount !== 1 ? "s" : ""}
              </div>
            )}
          </div>
          {trashCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                background: T.accent,
                color: "#fff",
                borderRadius: 99,
                minWidth: 18,
                height: 18,
                padding: "0 5px",
                fontSize: 10,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 1px 4px rgba(37,99,235,0.4)",
                border: "2px solid #fff",
              }}
            >
              {trashCount}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
