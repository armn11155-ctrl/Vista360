// @ts-nocheck — legacy file: migrating to strict TypeScript gradually
import React, { useState, useMemo, useEffect, useCallback } from "react";
import type { Panel, Cliente, Contrato, Gasto, Proveedor } from "../../types";
import { fb } from "../../services/firestore";
import { T, tCol } from "../../config/theme";
import { toast, confirmAsync } from "../../context/UIContext";
import { fmt, fmtF, dias, haptic } from "../../lib/utils";
import { Modal, FieldGroup, Badge, Card, Spinner } from "../ui";

function BusquedaGlobal({
  open,
  onClose,
  paneles,
  clientes,
  contratos,
  onNavigate,
}: BusquedaGlobalProps) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
      setQ("");
    }
  }, [open]);

  useEffect(() => {
    const handler = e => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const resultados = useMemo(() => {
    const texto = q.trim().toLowerCase();
    if (texto.length < 2) return [];
    const res = [];

    paneles.forEach(p => {
      const haystack = [p.nombre, p.ubicacion, p.ciudad, p.tipo].join(" ").toLowerCase();
      if (haystack.includes(texto)) {
        const contratosPanel = contratos.filter(c => c.panel_id === p.id);
        const activo = contratosPanel.some(c => c.estado === "Activo");
        res.push({
          tipo: "panel",
          id: p.id,
          titulo: p.nombre,
          sub: `${p.ciudad || ""}${p.ubicacion ? " · " + p.ubicacion : ""}`,
          tag: activo ? "Activo" : "Libre",
          tagColor: activo ? T.green : T.muted,
          tab: "paneles",
        });
      }
    });

    clientes.forEach(c => {
      const haystack = [c.empresa, c.contacto, c.celular, c.email, c.ciudad, c.ruc]
        .join(" ")
        .toLowerCase();
      if (haystack.includes(texto)) {
        res.push({
          tipo: "cliente",
          id: c.id,
          titulo: c.empresa,
          sub: `${c.contacto || ""}${c.ciudad ? " · " + c.ciudad : ""}`,
          tag: c.tipo,
          tagColor: c.tipo === "Cliente" ? T.green : T.accent,
          tab: "crm",
        });
      }
    });

    contratos.forEach(ct => {
      const panel = paneles.find(p => p.id === ct.panel_id);
      const cliente = clientes.find(c => c.id === ct.cliente_id);
      const haystack = [
        ct.concepto,
        panel?.nombre,
        cliente?.empresa,
        ct.estado,
        ct.monto?.toString(),
      ]
        .join(" ")
        .toLowerCase();
      if (haystack.includes(texto)) {
        const dRestantes = Math.ceil((new Date(ct.fin).getTime() - Date.now()) / 86400000);
        const tagColor =
          ct.estado === "Activo" ? T.green : ct.estado === "Por vencer" ? T.white : T.red;
        res.push({
          tipo: "contrato",
          id: ct.id,
          titulo: `${panel?.nombre || "Panel"} — ${cliente?.empresa || "Cliente"}`,
          sub: `S/ ${Number(ct.monto || 0).toLocaleString("es-PE")} · vence ${ct.fin ? new Date(ct.fin).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "—"}`,
          tag: ct.estado || "—",
          tagColor,
          tab: "contratos",
        });
      }
    });

    return res.slice(0, 20);
  }, [q, paneles, clientes, contratos]);

  const grupos = useMemo(() => {
    const g: Record<string, typeof resultados> = {};
    resultados.forEach(r => {
      if (!g[r.tipo]) g[r.tipo] = [];
      g[r.tipo].push(r);
    });
    return g;
  }, [resultados]);

  const iconoPor = { panel: "📡", cliente: "🏢", contrato: "📄" };
  const labelPor = { panel: "Paneles", cliente: "Clientes", contrato: "Contratos" };

  if (!open) return null;

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 500,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: "max(60px, env(safe-area-inset-top))",
        padding: "max(60px, env(safe-area-inset-top)) 16px 0",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          display: "flex",
          flexDirection: "column",
          gap: 0,
          maxHeight: "80vh",
        }}
      >
        {/* Barra de búsqueda */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#fff",
            borderRadius: 18,
            padding: "12px 16px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          }}
        >
          <svg
            width="20"
            height="20"
            fill="none"
            viewBox="0 0 24 24"
            style={{ flexShrink: 0, color: T.muted }}
          >
            <path
              d="M21 21L15 15M17 11C17 14.866 13.866 18 10 18C6.134 18 3 14.866 3 11C3 7.134 6.134 4 10 4C13.866 4 17 7.134 17 11Z"
              stroke={T.muted}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar paneles, clientes, contratos…"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: 16,
              color: T.text,
              background: "transparent",
              fontFamily: "'DM Sans',sans-serif",
            }}
          />
          {q && (
            <button
              onClick={() => setQ("")}
              style={{
                background: "#F1F5F9",
                border: "none",
                borderRadius: "50%",
                width: 26,
                height: 26,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                touchAction: "manipulation",
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                <path
                  d="M18 6L6 18M6 6L18 18"
                  stroke={T.muted}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: "#F1F5F9",
              border: "none",
              borderRadius: 8,
              padding: "4px 10px",
              color: T.muted,
              fontSize: 12,
              cursor: "pointer",
              touchAction: "manipulation",
              flexShrink: 0,
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            Esc
          </button>
        </div>

        {/* Resultados */}
        {q.length >= 2 && (
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              marginTop: 8,
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              overflowY: "auto",
            }}
          >
            {resultados.length === 0 ? (
              <div
                style={{ padding: "32px 20px", textAlign: "center", color: T.muted, fontSize: 14 }}
              >
                Sin resultados para <strong style={{ color: T.text }}>"{q}"</strong>
              </div>
            ) : (
              Object.entries(grupos).map(([tipo, items]) => (
                <div key={tipo}>
                  <div
                    style={{
                      padding: "10px 16px 4px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: T.muted,
                      textTransform: "uppercase",
                      letterSpacing: 1.2,
                      borderTop: "1px solid #F1F5F9",
                    }}
                  >
                    {iconoPor[tipo]} {labelPor[tipo]} ({items.length})
                  </div>
                  {items.map(r => (
                    <button
                      key={r.id}
                      onClick={() => {
                        onNavigate(r.tab);
                        onClose();
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "11px 16px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        touchAction: "manipulation",
                        textAlign: "left",
                        borderTop: "1px solid #F8FAFC",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                      onMouseLeave={e => (e.currentTarget.style.background = "none")}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: "#F1F5F9",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                      >
                        {iconoPor[tipo]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: T.text,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {r.titulo}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: T.muted,
                            marginTop: 1,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {r.sub}
                        </div>
                      </div>
                      <span
                        style={{
                          background: r.tagColor + "18",
                          color: r.tagColor,
                          border: `1px solid ${r.tagColor}44`,
                          borderRadius: 6,
                          padding: "2px 8px",
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {r.tag}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {/* Sugerencias cuando está vacío */}
        {q.length < 2 && (
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              marginTop: 8,
              padding: "16px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.muted,
                textTransform: "uppercase",
                letterSpacing: 1.2,
                marginBottom: 12,
              }}
            >
              Accesos rápidos
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                {
                  label: "Ver paneles",
                  svgPath: (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                      <rect
                        x="3"
                        y="3"
                        width="7"
                        height="7"
                        rx="1.5"
                        stroke={T.accent}
                        strokeWidth="2"
                      />
                      <rect
                        x="14"
                        y="3"
                        width="7"
                        height="7"
                        rx="1.5"
                        stroke={T.accent}
                        strokeWidth="2"
                      />
                      <rect
                        x="3"
                        y="14"
                        width="7"
                        height="7"
                        rx="1.5"
                        stroke={T.accent}
                        strokeWidth="2"
                      />
                      <rect
                        x="14"
                        y="14"
                        width="7"
                        height="7"
                        rx="1.5"
                        stroke={T.accent}
                        strokeWidth="2"
                      />
                    </svg>
                  ),
                  tab: "paneles",
                },
                {
                  label: "Ver contratos",
                  svgPath: (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                      <path
                        d="M14 2H6C5.448 2 5 2.448 5 3V21C5 21.552 5.448 22 6 22H18C18.552 22 19 21.552 19 21V7L14 2Z"
                        stroke={T.accent}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <polyline
                        points="14 2 14 8 19 8"
                        stroke={T.accent}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  ),
                  tab: "contratos",
                },
                {
                  label: "Ver clientes",
                  svgPath: (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                      <path
                        d="M17 21V19C17 17.343 15.657 16 14 16H10C8.343 16 7 17.343 7 19V21"
                        stroke={T.accent}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <circle cx="12" cy="8" r="4" stroke={T.accent} strokeWidth="2" />
                    </svg>
                  ),
                  tab: "crm",
                },
                {
                  label: "Facturación",
                  svgPath: (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                      <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="2"
                        stroke={T.accent}
                        strokeWidth="2"
                      />
                      <path
                        d="M7 8H17M7 12H17M7 16H13"
                        stroke={T.accent}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  ),
                  tab: "facturacion",
                },
              ].map(a => (
                <button
                  key={a.tab}
                  onClick={() => {
                    onNavigate(a.tab);
                    onClose();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: "#F8FAFC",
                    border: "1px solid #E5E7EB",
                    borderRadius: 12,
                    cursor: "pointer",
                    touchAction: "manipulation",
                    fontSize: 13,
                    fontWeight: 600,
                    color: T.text,
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center" }}>{a.svgPath}</span>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BusquedaGlobal;
