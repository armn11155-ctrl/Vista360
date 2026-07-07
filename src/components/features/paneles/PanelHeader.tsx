// @ts-nocheck — se migrará a strict TS junto con Paneles.tsx

export interface PanelHeaderProps {
  total: number;
  libres: number;
  ocupados: number;
  onNew: () => void;
}

/**
 * Cabecera de la sección de paneles.
 * Fondo azul marino (#1E3A8A) con texto blanco.
 */
export function PanelHeader({ total, libres, ocupados, onNew }: PanelHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: "linear-gradient(135deg, #07101F 0%, #0d1f4e 50%, #112260 100%)",
        borderRadius: 18,
        padding: "16px 20px",
        marginBottom: 18,
        boxShadow: "0 4px 18px rgba(7,16,31,0.55)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Destello decorativo superior-derecha */}
      <div
        style={{
          position: "absolute",
          top: -30,
          right: -30,
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.07)",
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
          background: "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#FFFFFF",
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
            color: "#FFFFFF",
            letterSpacing: "-0.3px",
            lineHeight: 1.2,
          }}
        >
          Paneles
        </div>
        <div
          style={{ fontSize: 12, color: "rgba(255,255,255,0.70)", marginTop: 3, fontWeight: 500 }}
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
          background: "rgba(255,255,255,0.18)",
          border: "1px solid rgba(255,255,255,0.35)",
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
