import type { User } from "firebase/auth";
import { T } from "../../config/theme";

interface AppHeaderProps {
  title: string;
  user: User | null;
  userName: string;
  onProfileClick: () => void;
  onSearchClick: () => void;
  onNotifClick: () => void;
  onDrawerClick: () => void;
  notifCount?: number;
  headerColor?: string;
  headerDark?: boolean;
  showProfile?: boolean;
}

// ── CSS liquid glass 3D para botones del header oscuro ───────────
const GLASS_BTN_CSS = `
  .v360-hdr-glass {
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
  /* Highlight superior — efecto lente convexa */
  .v360-hdr-glass::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 55%;
    background: linear-gradient(
      180deg,
      rgba(255,255,255,0.18) 0%,
      rgba(255,255,255,0.0) 100%
    );
    border-radius: inherit;
    pointer-events: none;
    z-index: 0;
  }
  /* Franja especular nítida en borde superior */
  .v360-hdr-glass::after {
    content: "";
    position: absolute;
    top: 0;
    left: 15%;
    right: 15%;
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
  .v360-hdr-glass > * {
    position: relative;
    z-index: 1;
  }
`;

/**
 * Barra superior de la app autenticada.
 * Extraído de AuthenticatedShell — reduce ~150 líneas de JSX inline.
 */
export function AppHeader({
  title,
  user,
  userName,
  onProfileClick,
  onSearchClick,
  onNotifClick,
  onDrawerClick,
  notifCount = 0,
  headerColor = T.bg,
  headerDark = false,
  showProfile = false,
}: AppHeaderProps) {
  void user; // photo URL available for future use

  const userInitials = userName
    .split(" ")
    .map(w => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Clase glass solo cuando el header tiene fondo oscuro
  const glassClass = headerDark ? "v360-hdr-glass" : undefined;

  return (
    <>
      <style>{GLASS_BTN_CSS}</style>
      <nav
        aria-label="Encabezado principal"
        style={{
          flexShrink: 0,
          paddingTop: "env(safe-area-inset-top)",
          paddingLeft: 16,
          paddingRight: 16,
          paddingBottom: 12,
          background: headerColor,
          borderBottom: headerDark ? "none" : `1px solid rgba(229,231,235,0.8)`,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {/* Drawer toggle */}
        <button
          onClick={onDrawerClick}
          aria-label="Abrir menú"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: headerDark ? "rgba(255,255,255,0.10)" : T.text,
            border: headerDark ? "1px solid rgba(255,255,255,0.14)" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: headerDark ? "none" : "0 4px 12px rgba(15,23,41,0.18)",
            cursor: "pointer",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="8" height="8" rx="2" fill="white" />
            <rect x="13" y="3" width="8" height="8" rx="2" fill="white" />
            <rect x="3" y="13" width="8" height="8" rx="2" fill="white" />
            <rect x="13" y="13" width="8" height="8" rx="2" fill="white" />
          </svg>
        </button>

        {/* Title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: headerDark ? "#fff" : T.text,
              lineHeight: 1.1,
            }}
          >
            {title}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {/* Search */}
          <button
            onClick={onSearchClick}
            aria-label="Buscar"
            className={glassClass}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: headerDark ? "rgba(255,255,255,0.10)" : T.white,
              border: headerDark ? "1px solid rgba(255,255,255,0.14)" : `1px solid ${T.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <svg width="17" height="17" fill="none" viewBox="0 0 24 24">
              <path
                d="M21 21L15 15M17 11C17 14.866 13.866 18 10 18C6.134 18 3 14.866 3 11C3 7.134 6.134 4 10 4C13.866 4 17 7.134 17 11Z"
                stroke={headerDark ? "#fff" : T.text}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Notifications */}
          <button
            onClick={onNotifClick}
            aria-label="Notificaciones"
            className={glassClass}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: headerDark ? "rgba(255,255,255,0.10)" : T.white,
              border: headerDark ? "1px solid rgba(255,255,255,0.14)" : `1px solid ${T.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              cursor: "pointer",
            }}
          >
            <svg width="17" height="17" fill="none" viewBox="0 0 24 24">
              <path
                d="M15 17H9M15 17C15 18.657 13.657 20 12 20C10.343 20 9 18.657 9 17M15 17H20L18.784 15.784C18.284 15.284 18 14.612 18 13.914V10C18 7.239 15.761 5 13 5H11C8.239 5 6 7.239 6 10V13.914C6 14.612 5.716 15.284 5.216 15.784L4 17H9"
                stroke={headerDark ? "#fff" : T.text}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {notifCount > 0 && (
              <div
                aria-label={`${notifCount} notificaciones`}
                style={{
                  position: "absolute",
                  top: 7,
                  right: 7,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: T.red,
                  border: `2px solid ${T.white}`,
                  zIndex: 2,
                }}
              />
            )}
          </button>

          {/* Avatar */}
          <button
            onClick={onProfileClick}
            aria-label="Ver perfil"
            aria-current={showProfile ? "page" : undefined}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #1E3A8A 0%, #1E40AF 60%, #2A5BD9 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 800,
              fontSize: 13,
              border: showProfile ? `2px solid ${T.accent}` : "2px solid transparent",
              boxShadow: "0 4px 12px rgba(30,58,138,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
              letterSpacing: "0.5px",
              cursor: "pointer",
            }}
          >
            {userInitials}
          </button>
        </div>
      </nav>
    </>
  );
}
