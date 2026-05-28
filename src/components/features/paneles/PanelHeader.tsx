// @ts-nocheck — se migrará a strict TS junto con Paneles.tsx

export interface PanelHeaderProps {
  total: number;
  libres: number;
  ocupados: number;
  onNew: () => void;
}

/**
 * Cabecera de la sección de paneles.
 * Muestra contadores y el botón de crear nuevo panel.
 */
export function PanelHeader({ total, libres, ocupados, onNew }: PanelHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: "linear-gradient(135deg,#0F1729 0%,#1E3A8A 100%)",
        borderRadius: 18,
        padding: "16px 20px",
        marginBottom: 18,
        boxShadow: "0 6px 24px rgba(15,23,41,0.32)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Brillo superior decorativo */}
      <div
        aria-hidden="true"
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

      {/* Ícono de pantalla */}
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
        aria-hidden="true"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      </div>

      {/* Títulos y contadores */}
      <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: "#93C5FD",
            letterSpacing: "-0.3px",
            lineHeight: 1.2,
          }}
        >
          Paneles
        </div>
        <div
          style={{ fontSize: 12, color: "rgba(147,197,253,0.85)", marginTop: 3, fontWeight: 500 }}
        >
          {total} paneles · {libres} libres · {ocupados} ocupados
        </div>
      </div>

      {/* Botón nuevo */}
      <button
        onClick={onNew}
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
          backdropFilter: "blur(4px)",
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
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Nuevo
      </button>
    </div>
  );
}
