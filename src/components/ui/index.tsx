// @ts-nocheck — legacy file: migrating to strict TypeScript gradually
import React, { useState } from "react";
import { T } from "../../config/theme";

// ── SKELETON ──────────────────────────────────────────────────────
interface SkPulseProps {
  w?: string | number;
  h?: number;
  r?: number;
  style?: React.CSSProperties;
}
export const SkPulse = ({ w = "100%", h = 16, r = 8, style = {} }: SkPulseProps) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: r,
      background: "linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.05) 75%)",
      backgroundSize: "200% 100%",
      animation: "skPulse 1.4s ease infinite",
      flexShrink: 0,
      ...style,
    }}
  />
);
export const SkCard = () => (
  <div
    style={{
      background: T.card,
      borderRadius: 20,
      padding: 20,
      border: `1px solid ${T.border}`,
      marginBottom: 14,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <SkPulse w={48} h={48} r={12} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <SkPulse h={14} r={6} />
        <SkPulse w="60%" h={11} r={6} />
      </div>
    </div>
    <SkPulse h={11} r={6} style={{ marginBottom: 8 }} />
    <SkPulse w="80%" h={11} r={6} />
  </div>
);

// ── SPINNER ───────────────────────────────────────────────────────
export const Spinner = () => (
  <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
    <div
      style={{
        width: 32,
        height: 32,
        border: `3px solid ${T.border}`,
        borderTop: `3px solid ${T.accent}`,
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}
    />
  </div>
);

// ── BADGE / TAG ───────────────────────────────────────────────────
interface BadgeProps {
  color: string;
  ch: React.ReactNode;
}
interface TagProps {
  color: string;
  ch: React.ReactNode;
}
const badgeStyle = (c: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 8px",
  borderRadius: 99,
  background: `${c}18`,
  color: c,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.02em",
});
const tagStyle = (c: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 10px",
  borderRadius: 8,
  background: `${c}15`,
  color: c,
  fontSize: 12,
  fontWeight: 600,
});
export const Badge = ({ color, ch }: BadgeProps) => <span style={badgeStyle(color)}>{ch}</span>;
export const Tag = ({ color, ch }: TagProps) => <span style={tagStyle(color)}>{ch}</span>;

// ── CARD ──────────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}
const cardBaseStyle: React.CSSProperties = {
  background: T.card,
  borderRadius: 20,
  padding: 20,
  border: `1px solid ${T.border}`,
  boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 28px -18px rgba(0,0,0,0.6)",
  marginBottom: 14,
};
export const Card = ({ children, style = {} }: CardProps) => (
  <div style={{ ...cardBaseStyle, ...style }}>{children}</div>
);

// ── SECTION TITLE ─────────────────────────────────────────────────
interface SecTitProps {
  ch: React.ReactNode;
}
const secTitStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: T.muted,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 12,
  marginTop: 8,
};
export const SecTit = ({ ch }: SecTitProps) => <div style={secTitStyle}>{ch}</div>;

// ── PAGE TITLE ────────────────────────────────────────────────────
interface PgTitProps {
  icon?: string;
  title: string;
  sub?: string;
  dark?: boolean;
}
export const PgTit = ({ icon, title, sub, dark }: PgTitProps) => (
  <div style={{ marginBottom: 20 }}>
    {icon && <span style={{ fontSize: 28, display: "block", marginBottom: 6 }}>{icon}</span>}
    <div
      style={{
        fontSize: 22,
        fontWeight: 800,
        color: dark ? T.white : T.text,
        letterSpacing: "-0.5px",
      }}
    >
      {title}
    </div>
    {sub && (
      <div style={{ fontSize: 13, color: dark ? "rgba(255,255,255,0.55)" : T.muted, marginTop: 4 }}>
        {sub}
      </div>
    )}
  </div>
);

// ── MODAL ─────────────────────────────────────────────────────────
interface ModalProps {
  title: string;
  onClose: () => void;
  onSave?: () => void | Promise<void>;
  saveLabel?: string;
  children: React.ReactNode;
}
export function Modal({ title, onClose, onSave, saveLabel = "Guardar", children }: ModalProps) {
  // Detecta apertura del teclado virtual (visualViewport API) y eleva el modal
  const [kbH, setKbH] = React.useState(0);
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const k = window.innerHeight - vv.offsetTop - vv.height;
      setKbH(Math.max(0, Math.round(k)));
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        // El bottom sube cuando aparece el teclado → el modal se eleva automáticamente
        bottom: kbH,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        transition: "bottom 0.2s ease",
      }}
    >
      <div
        style={{
          background: T.card,
          borderTop: `1px solid ${T.border}`,
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px",
          width: "100%",
          maxWidth: 540,
          maxHeight: `calc(92dvh - ${kbH}px)`,
          overflowY: "auto",
          paddingBottom: `calc(24px + env(safe-area-inset-bottom))`,
          transition: "max-height 0.2s ease",
          boxShadow: "0 -16px 48px -12px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 800, color: T.text }}>{title}</span>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "none",
              borderRadius: 10,
              fontSize: 20,
              cursor: "pointer",
              color: T.muted,
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              touchAction: "manipulation",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        {children}
        {onSave && (
          <button
            onClick={onSave}
            style={{
              width: "100%",
              marginTop: 20,
              padding: "15px",
              background: T.accent,
              color: "#fff",
              border: "none",
              borderRadius: 14,
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              touchAction: "manipulation",
              fontFamily: "inherit",
              boxShadow: `0 8px 20px -6px ${T.accent}66`,
            }}
          >
            {saveLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ── FIELD GROUP ───────────────────────────────────────────────────
interface FieldGroupProps {
  label: string;
  children: React.ReactNode;
}
export function FieldGroup({ label, children }: FieldGroupProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 700,
          color: T.muted,
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

// ── PAGINATION ────────────────────────────────────────────────────
interface PaginationProps {
  page: number;
  totalPages: number;
  setPage: (p: number) => void;
  total: number;
  pageSize: number;
  dark?: boolean;
}
export function Pagination({
  page,
  totalPages,
  setPage,
  total,
  pageSize,
  dark = true,
}: PaginationProps) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1,
    to = Math.min(page * pageSize, total);
  const bg = dark ? T.dark : T.white,
    border = dark ? "rgba(59,130,246,0.22)" : T.border;
  const text = dark ? "rgba(255,255,255,0.55)" : T.muted;
  const btnBg = dark ? "rgba(255,255,255,0.06)" : "#F1F5F9";
  const pages: (number | "…")[] = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }
  const btn = (label: string | number, onClick: () => void, active = false, disabled = false) => (
    <button
      key={String(label) + String(active)}
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 32,
        height: 32,
        borderRadius: 8,
        border: "none",
        background: active ? T.accent : disabled ? "transparent" : btnBg,
        color: active
          ? "#fff"
          : disabled
            ? "rgba(255,255,255,0.2)"
            : dark
              ? "rgba(255,255,255,0.75)"
              : "#374151",
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        cursor: disabled ? "default" : "pointer",
        touchAction: "manipulation",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 6px",
      }}
    >
      {label}
    </button>
  );
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        marginTop: 20,
        padding: "10px 14px",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 16,
      }}
    >
      <span style={{ fontSize: 11, color: text, fontWeight: 600, flexShrink: 0 }}>
        {from}–{to} de {total}
      </span>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {btn("‹", () => setPage(page - 1), false, page === 1)}
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`dots-${i}`} style={{ color: text, fontSize: 13, padding: "0 4px" }}>
              …
            </span>
          ) : (
            btn(p, () => setPage(p as number), p === page)
          ),
        )}
        {btn("›", () => setPage(page + 1), false, page === totalPages)}
      </div>
    </div>
  );
}

// ── SWIPE ROW ─────────────────────────────────────────────────────
interface SwipeRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  onEdit?: () => void;
  deleteLabel?: string;
  /** Color de fondo del contenedor (debe coincidir con la card hija para evitar el flash blanco) */
  bg?: string;
}
export function SwipeRow({
  children,
  onDelete,
  onEdit,
  deleteLabel = "Eliminar",
  bg = T.bg,
}: SwipeRowProps) {
  const slideRef = React.useRef<HTMLDivElement>(null);
  // Toda la lógica de arrastre vive en refs para evitar re-renders durante el drag
  const drag = React.useRef<{
    active: boolean;
    x0: number;
    y0: number;
    off0: number;
    dir: "h" | "v" | null;
  }>({ active: false, x0: 0, y0: 0, off0: 0, dir: null });
  const offRef = React.useRef(0);

  // Ancho de las acciones: Editar(64) + Eliminar(88) = 152 | solo Eliminar = 88
  const OPEN = onEdit ? -152 : -88;

  /** Mueve el contenido deslizable directo al DOM (sin re-render). */
  const applyTransform = (px: number, animate: boolean) => {
    offRef.current = px;
    if (!slideRef.current) return;
    slideRef.current.style.transition = animate ? "transform .25s cubic-bezier(.4,0,.2,1)" : "none";
    slideRef.current.style.transform = `translateX(${px}px)`;
  };

  const snapTo = (open: boolean) => applyTransform(open ? OPEN : 0, true);

  const onPointerDown = (e: React.PointerEvent) => {
    // Solo botón izquierdo en ratón; cualquier touch
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { active: true, x0: e.clientX, y0: e.clientY, off0: offRef.current, dir: null };
    applyTransform(offRef.current, false); // apaga transición durante el arrastre
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;

    // Esperamos 6 px para determinar dirección del gesto
    if (!d.dir) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      d.dir = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
    }
    if (d.dir === "v") return; // gesto vertical → deja que el scroll nativo actúe

    // Gesto horizontal: seguir el dedo con resistencia al sobre-deslizar
    const next = Math.min(0, Math.max(OPEN - 24, d.off0 + dx));
    applyTransform(next, false);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;

    const dx = e.clientX - d.x0;

    // Si fue un tap (sin gesto horizontal detectado), no hacer nada
    if (d.dir !== "h") return;

    // Snap: abrir si se arrastró más de 40 px a la izquierda o ya pasó el punto medio
    const shouldOpen = dx < -40 || offRef.current < OPEN / 2;
    snapTo(shouldOpen);
  };

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        marginBottom: 10,
        background: bg,
        // pan-y: el browser maneja el scroll vertical y cede el horizontal a JS
        touchAction: "pan-y",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current.active = false;
        snapTo(false);
      }}
    >
      {/* Acciones reveladas al deslizar */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          display: "flex",
          alignItems: "stretch",
          borderRadius: "0 22px 22px 0",
          overflow: "hidden",
        }}
      >
        {onEdit && (
          <button
            onClick={onEdit}
            style={{
              background: T.accent,
              color: "#fff",
              border: "none",
              padding: "0 20px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              touchAction: "manipulation",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              minWidth: 64,
            }}
          >
            <svg
              width="18"
              height="18"
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
        )}
        <button
          onClick={onDelete}
          style={{
            background: T.red,
            color: "#fff",
            border: "none",
            padding: "0 20px",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
            touchAction: "manipulation",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            minWidth: 76,
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
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
          </svg>
          {deleteLabel}
        </button>
      </div>

      {/* Contenido deslizable — manipulado directo al DOM vía ref */}
      <div ref={slideRef} style={{ willChange: "transform" }}>
        {children}
      </div>
    </div>
  );
}

// ── OFFLINE BANNER ────────────────────────────────────────────────
export function OfflineBanner() {
  return (
    <div
      style={{
        background: T.amber,
        color: "#1A1300",
        textAlign: "center",
        padding: "8px 16px",
        fontSize: 13,
        fontWeight: 700,
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9000,
      }}
    >
      Sin conexión — mostrando datos guardados
    </div>
  );
}
