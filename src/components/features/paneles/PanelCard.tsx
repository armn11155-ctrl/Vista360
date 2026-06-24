// @ts-nocheck — se migrará a strict TS junto con Paneles.tsx
import { T } from "../../../config/theme";
import { getCarasPanel } from "../../../config/constants";
import { fmt } from "../../../lib/utils";
import type { Panel } from "../../../types";

export interface PanelCardProps {
  panel: Panel;
  /** Ocupación por cara. Para paneles de 1 cara solo importa A. */
  carasOcupadas: { A: boolean; B: boolean };
  onEdit: (panel: Panel) => void;
  onDelete: (id: string) => void;
}

/**
 * Tarjeta de panel individual — diseño dark con degradado azul marino.
 * Muestra nombre, ciudad, tipo, precio mensual y botones de acción.
 */
export function PanelCard({ panel: p, carasOcupadas, onEdit, onDelete }: PanelCardProps) {
  const numCaras = getCarasPanel(p.tipo);
  const ocupado = numCaras === 2 ? carasOcupadas.A || carasOcupadas.B : carasOcupadas.A;
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 24,
        background: "linear-gradient(160deg,#0F1B36 0%,#0A1430 55%,#070E22 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 14px 40px -18px rgba(8,12,30,0.55), 0 1px 0 rgba(255,255,255,0.04) inset",
        padding: 20,
      }}
    >
      {/* Textura diagonal decorativa */}
      <svg
        viewBox="0 0 400 400"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.5,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`pl-${p.id}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#3B6BFF" stopOpacity="0.0" />
            <stop offset="0.5" stopColor="#3B6BFF" stopOpacity="0.5" />
            <stop offset="1" stopColor="#3B6BFF" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {Array.from({ length: 14 }).map((_, i) => (
          <line
            key={i}
            x1={-100 + i * 70}
            y1="-50"
            x2={250 + i * 70}
            y2="450"
            stroke={`url(#pl-${p.id})`}
            strokeWidth={i % 3 === 0 ? 1.2 : 0.6}
            opacity={0.18 + (i % 3) * 0.12}
          />
        ))}
      </svg>

      <div style={{ position: "relative" }}>
        {/* Fila superior: ícono + nombre + badge estado */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 14,
              flexShrink: 0,
              background: "linear-gradient(135deg,#5B8DEF,#243F8C)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1.5px solid rgba(255,255,255,0.18)",
              boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
              fontSize: 28,
            }}
          >
            {p.foto || ""}
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#fff",
                letterSpacing: "-0.01em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {p.nombre}
            </div>
            <div style={{ fontSize: 13, color: "rgba(220,228,250,0.55)", marginTop: 3 }}>
              {p.ciudad}
            </div>
          </div>
          {/* Badges de cara — Unipolar muestra A y B por separado */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
            {numCaras === 2 ? (
              <>
                <div
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    border: "1.5px solid #3B82F6",
                    background: carasOcupadas.A ? "#3B82F6" : "transparent",
                    color: carasOcupadas.A ? "#fff" : "#3B82F6",
                  }}
                >
                  Cara A {carasOcupadas.A ? "·Ocupada" : "·Libre"}
                </div>
                <div
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    border: "1.5px solid #3B82F6",
                    background: carasOcupadas.B ? "#3B82F6" : "transparent",
                    color: carasOcupadas.B ? "#fff" : "#3B82F6",
                  }}
                >
                  Cara B {carasOcupadas.B ? "·Ocupada" : "·Libre"}
                </div>
              </>
            ) : (
              <div
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  border: "1.5px solid #3B82F6",
                  background: ocupado ? "#3B82F6" : "transparent",
                  color: ocupado ? "#fff" : "#3B82F6",
                }}
              >
                {ocupado ? "Ocupado" : "Libre"}
              </div>
            )}
          </div>
        </div>

        {/* Dirección */}
        {p.direccion && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 18,
              fontSize: 13,
              color: "rgba(220,228,250,0.7)",
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.direccion}
            </span>
          </div>
        )}

        {/* Tipo + Precio */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.4fr",
            gap: 14,
            alignItems: "stretch",
            marginBottom: 18,
          }}
        >
          <div style={{ padding: "4px 4px" }}>
            <div
              style={{
                fontSize: 11,
                color: "rgba(220,228,250,0.5)",
                fontWeight: 700,
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              Tipo
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginTop: 6 }}>
              {p.tipo}
            </div>
          </div>
          <div
            style={{
              borderRadius: 14,
              border: "1px solid rgba(16,185,129,0.35)",
              background: "rgba(16,185,129,0.06)",
              padding: "10px 14px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: T.green,
                fontWeight: 700,
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              Precio/mes
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: T.green,
                marginTop: 4,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              {fmt(p.precio)}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => onEdit(p)}
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px 20px",
              borderRadius: 999,
              background: "#fff",
              border: "none",
              cursor: "pointer",
              touchAction: "manipulation",
              color: T.accent,
              fontWeight: 800,
              fontSize: 15,
              fontFamily: "inherit",
              boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
            Editar
          </button>
          <button
            onClick={() => onDelete(p.id)}
            aria-label={`Eliminar ${p.nombre}`}
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              flexShrink: 0,
              background: "rgba(239,68,68,0.14)",
              border: "1px solid rgba(239,68,68,0.28)",
              cursor: "pointer",
              touchAction: "manipulation",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: T.red,
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
              aria-hidden="true"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
