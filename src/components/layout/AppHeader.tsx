import type { ReactNode } from "react";
import { T } from "../../config/theme";
import { EMISOR } from "../../config/constants";
import type { User } from "firebase/auth";

interface AppHeaderProps {
  title: string;
  user: User | null;
  userName: string;
  onProfileClick: () => void;
  onSearchClick?: () => void;
  onNotifClick?: () => void;
  notifCount?: number;
  rightSlot?: ReactNode;
}

/**
 * Barra superior de la app autenticada.
 * Extraído de AuthenticatedShell para reducir su tamaño.
 */
export function AppHeader({
  title,
  user,
  userName,
  onProfileClick,
  onSearchClick,
  onNotifClick,
  notifCount = 0,
  rightSlot,
}: AppHeaderProps) {
  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const photoURL =
    user?.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=2563EB&color=fff&size=64&bold=true`;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "12px 16px",
        background: T.bg,
        borderBottom: `1px solid ${T.border}`,
        gap: 12,
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Título / logo */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: T.text,
            letterSpacing: "-0.3px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>
          {EMISOR.ruc} · {EMISOR.ciudad}
        </div>
      </div>

      {/* Slot personalizable (e.g. botón de acción) */}
      {rightSlot}

      {/* Búsqueda */}
      {onSearchClick && (
        <button
          onClick={onSearchClick}
          aria-label="Buscar"
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            border: "none",
            background: "rgba(37,99,235,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
            stroke={T.muted} strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
      )}

      {/* Notificaciones */}
      {onNotifClick && (
        <button
          onClick={onNotifClick}
          aria-label={`Notificaciones${notifCount > 0 ? ` (${notifCount})` : ""}`}
          style={{
            position: "relative",
            width: 36,
            height: 36,
            borderRadius: 12,
            border: "none",
            background: "rgba(37,99,235,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
            stroke={T.muted} strokeWidth="2" strokeLinecap="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          {notifCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: 5,
                right: 5,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: T.red,
                border: "1.5px solid white",
              }}
            />
          )}
        </button>
      )}

      {/* Avatar usuario */}
      <button
        onClick={onProfileClick}
        aria-label="Perfil"
        style={{
          flexShrink: 0,
          border: "none",
          background: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        {user?.photoURL ? (
          <img
            src={photoURL}
            alt={userName}
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: `2px solid ${T.accent}`,
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: `linear-gradient(135deg,${T.accent},#1D4ED8)`,
              border: `2px solid ${T.accent}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              color: "#fff",
            }}
          >
            {initials}
          </div>
        )}
      </button>
    </div>
  );
}
