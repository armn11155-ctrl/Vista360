// @ts-nocheck — legacy file: migrating to strict TypeScript gradually
import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
} from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import type { User } from "firebase/auth";

// ── Tipos e interfaces ────────────────────────────────────────────
import type { Panel, Cliente, Contrato, Gasto, Proveedor, Factura, Sueldo } from "../../../types";

// ── Servicios y utilidades ────────────────────────────────────────
import { fb } from "../../../services/firestore";
import { T, tCol, catCol } from "../../../config/theme";
import { toast, confirmAsync } from "../../../context/UIContext";
import { fmt, fmtF, dias, mesHoy, mesLabel, hoy, validate, haptic } from "../../../lib/utils";
import { toNumber, toDate } from "../../../lib/converters";
import {
  CIUDADES,
  CAT_GASTOS,
  CAT_PROVE,
  SECTORES,
  ESTADOS_CLI,
  ESTADOS_PRO,
  EMOJIS,
  EMISOR,
} from "../../../config/constants";

// ── Componentes UI ────────────────────────────────────────────────
import {
  Modal,
  FieldGroup,
  Badge,
  Tag,
  Card,
  SecTit,
  PgTit,
  Pagination,
  Spinner,
  SwipeRow,
  SkCard,
  SkPulse,
} from "../../ui";
import { usePagination } from "../../../hooks/usePagination";
import { useVirtualList } from "../../../hooks/useVirtualList";

function Mapa({ paneles, clientes, contratos }: MapaProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  const [sel, setSel] = useState<Panel | null>(null);
  const [leafletReady, setLeafletReady] = useState(false);

  const getInfo = pid => {
    const c = contratos.find(x => x.panel_id === pid);
    return c ? { ...c, cliente: clientes.find(x => x.id === c.cliente_id) } : null;
  };

  const PERU_CENTER = [-9.19, -75.02];
  const cityCoords = {
    Lima: [-12.0464, -77.0428],
    Arequipa: [-16.409, -71.537],
    Trujillo: [-8.112, -79.029],
    Chiclayo: [-6.771, -79.841],
    Piura: [-5.194, -80.633],
    Cusco: [-13.532, -71.967],
    Iquitos: [-3.749, -73.254],
    Huancayo: [-12.065, -75.205],
    Tacna: [-18.006, -70.248],
    Pucallpa: [-8.379, -74.554],
    Otra: [-9.19, -75.02],
  };

  useEffect(() => {
    if (window.L) {
      setLeafletReady(true);
      return;
    }
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    s.onload = () => setLeafletReady(true);
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!leafletReady || !mapRef.current || leafletRef.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, { center: PERU_CENTER, zoom: 5, zoomControl: false, zoomSnap: 0.5, wheelPxPerZoomLevel: 80 });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);
    leafletRef.current = map;
    return () => {
      map.remove();
      leafletRef.current = null;
    };
  }, [leafletReady]);

  useEffect(() => {
    if (!leafletRef.current || !window.L) return;
    const L = window.L;
    const map = leafletRef.current;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    const bounds = [];
    paneles.forEach(p => {
      let lat: number | null = p.lat ? toNumber(p.lat) || null : null;
      let lng: number | null = p.lng ? toNumber(p.lng) || null : null;
      if (!lat || !lng) {
        const base = cityCoords[p.ciudad] || PERU_CENTER;
        lat = base[0] + (Math.random() - 0.5) * 0.06;
        lng = base[1] + (Math.random() - 0.5) * 0.06;
      }
      bounds.push([lat, lng]);
      const isSelected = sel?.panel?.id === p.id;
      const baseColor = panelsConContratoHoy.has(p.id) ? T.red : "#3B82F6";
      const color = isSelected ? T.accent : baseColor;
      const shadow = isSelected
        ? "rgba(37,99,235,0.55)"
        : p.estado === "Ocupado"
          ? "rgba(239,68,68,0.5)"
          : "rgba(16,185,129,0.5)";
      const ringSize = isSelected ? 64 : 52;
      const innerSize = isSelected ? 44 : 40;
      const borderW = isSelected ? 4 : 3;
      const icon = L.divIcon({
        className: "",
        html: `<div style="position:relative;width:${ringSize}px;height:${ringSize}px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:${ringSize}px;height:${ringSize}px;border-radius:50%;background:${color}22;animation:markerPulse 2s ease-in-out infinite;"></div>
          ${isSelected ? `<div style="position:absolute;width:${ringSize - 8}px;height:${ringSize - 8}px;border-radius:50%;border:2px solid ${color};opacity:0.5;"></div>` : ""}
          <div style="width:${innerSize}px;height:${innerSize}px;border-radius:50%;background:white;border:${borderW}px solid ${color};display:flex;align-items:center;justify-content:center;font-size:${isSelected ? 20 : 18}px;box-shadow:0 0 ${isSelected ? 22 : 16}px ${shadow};position:relative;z-index:1;">${p.foto || ""}</div>
        </div>`,
        iconSize: [ringSize, ringSize],
        iconAnchor: [ringSize / 2, ringSize / 2],
      });
      const marker = L.marker([lat, lng], { icon }).addTo(map);
      marker.on("click", () =>
        setSel(prev => (prev?.panel?.id === p.id ? null : { panel: p, info: getInfo(p.id) })),
      );
      markersRef.current.push(marker);
    });
    if (bounds.length === 1) map.setView(bounds[0], 14);
    else if (bounds.length > 1 && !sel) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
  }, [paneles, leafletReady, sel?.panel?.id]);

  const hoyStrM = new Date().toISOString().slice(0, 10);
  const panelsConContratoHoy = new Set(
    contratos
      .filter(c => !c.deleted && c.inicio <= hoyStrM && c.fin >= hoyStrM)
      .map(c => c.panel_id),
  );

  const sinCoords = paneles.filter(p => !p.lat || !p.lng);

  return (
    <div
      style={{
        margin: "-20px -16px",
        minHeight: "100%",
        background: "#ffffff",
        paddingBottom: "calc(100px + env(safe-area-inset-bottom))",
      }}
    >
      <div style={{ padding: "16px 16px 12px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.5px" }}>
          Mapa de Paneles
        </div>
        <div style={{ fontSize: 13, color: "#64748B", marginTop: 3 }}>
          CartoDB Dark · Clic en un pin para ver detalles
        </div>
      </div>

      {sinCoords.length > 0 && (
        <div
          style={{
            background: T.accent + "12",
            border: "1px solid rgba(37,99,235,0.25)",
            borderRadius: 12,
            padding: "10px 16px",
            marginBottom: 14,
            fontSize: 13,
            color: T.white,
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <span>
            <strong>{sinCoords.length} panel(es)</strong> sin coordenadas exactas — aparecen
            aproximados por ciudad. Ve a <strong>Paneles → Editar → Ubicar</strong> para
            precisarlos.
          </span>
        </div>
      )}

      <Card style={{ padding: 0, overflow: "hidden", position: "relative", borderRadius: 20 }}>
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            zIndex: 500,
            background: T.dark,
            borderRadius: 22,
            padding: "10px 16px",
            display: "flex",
            gap: 14,
            boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          }}
        >
          {[
            ["#3B82F6", "Libre"],
            [T.red, "Ocupado"],
          ].map(([c, l]) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: c,
                  boxShadow: `0 0 6px ${c}`,
                }}
              />
              <span style={{ fontSize: 13, color: T.white, fontWeight: 600 }}>{l}</span>
            </div>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 500,
            background: T.dark,
            borderRadius: 22,
            padding: "10px 16px",
            fontSize: 13,
            color: T.white,
            fontWeight: 600,
            boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          }}
        >
          {paneles.length} panel{paneles.length !== 1 ? "es" : ""}
        </div>

        {!leafletReady && (
          <div
            style={{
              height: 560,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: T.muted,
              gap: 10,
              background: "#f8fafc",
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                border: `2px solid ${T.border}`,
                borderTopColor: T.accent,
                borderRadius: "50%",
                animation: "spin .7s linear infinite",
              }}
            />
            Cargando mapa...
          </div>
        )}
        <style>{`
          .leaflet-pane, .leaflet-top, .leaflet-bottom, .leaflet-control { z-index: auto !important; }
          .leaflet-map-pane { z-index: auto !important; }
        `}</style>
        <div
          ref={mapRef}
          style={{
            height: 560,
            width: "100%",
            display: leafletReady ? "block" : "none",
            isolation: "isolate",
            position: "relative",
            zIndex: 0,
          }}
        />

        {/* ── Panel de detalle al hacer clic en un pin ── */}
        {sel &&
          (() => {
            const p = sel.panel;
            const info = sel.info;
            const isOcup = panelsConContratoHoy.has(p.id);
            const accentColor = isOcup ? T.red : "#3B82F6";
            const contrato = info;
            const diasVence = contrato
              ? Math.ceil((new Date(contrato.fin).getTime() - Date.now()) / 86400000)
              : null;
            return (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  zIndex: 500,
                  background: "#0B1224",

                  WebkitBackdropFilter: "blur(20px)",
                  padding: "14px 18px 22px",
                  borderRadius: "22px 22px 0 0",
                  boxShadow: "0 -20px 50px rgba(0,0,0,0.4)",
                }}
              >
                {/* Drag handle */}
                <div
                  style={{
                    width: 42,
                    height: 5,
                    borderRadius: 3,
                    background: "rgba(255,255,255,0.18)",
                    margin: "0 auto 16px",
                  }}
                />

                {/* Header: thumbnail + title + address + close */}
                <div
                  style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 14,
                      background:
                        "linear-gradient(155deg, rgba(59,130,246,0.18) 0%, rgba(15,28,55,0.6) 100%)",
                      border: "1px solid rgba(59,130,246,0.28)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 30,
                      flexShrink: 0,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                    }}
                  >
                    {p.foto || ""}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: T.white,
                        letterSpacing: "-0.4px",
                        lineHeight: 1.2,
                        marginBottom: 6,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {p.nombre}
                    </div>
                    {p.direccion && (
                      <div
                        style={{
                          fontSize: 13,
                          color: "rgba(255,255,255,0.55)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontWeight: 500,
                        }}
                      >
                        <span
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {p.direccion}
                          {p.ciudad ? `, ${p.ciudad}` : ""}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setSel(null)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.08)",
                      border: "none",
                      color: "rgba(255,255,255,0.6)",
                      cursor: "pointer",
                      touchAction: "manipulation",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M18 6L6 18M6 6l12 12"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>

                {/* Card de info */}
                {isOcup && contrato ? (
                  <>
                    {/* Card principal: Cliente + monto */}
                    <div
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 16,
                        padding: "14px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 54,
                          height: 54,
                          borderRadius: 12,
                          background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          boxShadow: "0 6px 16px rgba(239,68,68,0.35)",
                        }}
                      >
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="8" r="3.5" stroke="white" strokeWidth="2" />
                          <path
                            d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 800,
                            color: T.white,
                            letterSpacing: "-0.3px",
                            marginBottom: 3,
                          }}
                        >
                          Panel ocupado
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "rgba(255,255,255,0.55)",
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          Cliente:{" "}
                          <span style={{ color: T.white, fontWeight: 700 }}>
                            {contrato.cliente?.empresa || "—"}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "rgba(255,255,255,0.55)",
                            fontWeight: 500,
                            marginTop: 1,
                          }}
                        >
                          Facturando:{" "}
                          <span style={{ color: "#3B82F6", fontWeight: 800 }}>
                            {fmt(contrato.monto)}/mes
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Vence + Pago */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: 14,
                          padding: "11px 14px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10.5,
                            color: "rgba(255,255,255,0.45)",
                            fontWeight: 700,
                            marginBottom: 3,
                            textTransform: "uppercase",
                            letterSpacing: 0.6,
                          }}
                        >
                          Vence
                        </div>
                        <div
                          style={{
                            fontSize: 13.5,
                            fontWeight: 800,
                            color: diasVence > 15 ? T.green : diasVence > 0 ? T.white : T.red,
                          }}
                        >
                          {diasVence > 0 ? `en ${diasVence}d` : `hace ${Math.abs(diasVence)}d`}
                        </div>
                      </div>
                      <div
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: 14,
                          padding: "11px 14px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10.5,
                            color: "rgba(255,255,255,0.45)",
                            fontWeight: 700,
                            marginBottom: 3,
                            textTransform: "uppercase",
                            letterSpacing: 0.6,
                          }}
                        >
                          Pago
                        </div>
                        <div
                          style={{
                            fontSize: 13.5,
                            fontWeight: 800,
                            color: contrato.pagado ? T.green : T.white,
                          }}
                        >
                          {contrato.pagado ? "Cobrado" : "Pendiente"}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 16,
                      padding: "14px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                    }}
                  >
                    {/* Check azul */}
                    <div
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: 12,
                        background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        boxShadow: "0 6px 16px rgba(37,99,235,0.45)",
                      }}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M5 12.5L10 17.5L19 7.5"
                          stroke="white"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    {/* Info de precio */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          color: T.white,
                          letterSpacing: "-0.3px",
                          marginBottom: 5,
                        }}
                      >
                        Panel disponible
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "rgba(255,255,255,0.55)",
                          fontWeight: 500,
                          lineHeight: 1.4,
                        }}
                      >
                        Precio de lista:{" "}
                        <span style={{ color: T.white, fontWeight: 700 }}>{fmt(p.precio)}/mes</span>
                      </div>
                      {p.precio > 0 && (
                        <div
                          style={{
                            fontSize: 13,
                            color: "rgba(255,255,255,0.55)",
                            fontWeight: 500,
                            lineHeight: 1.4,
                          }}
                        >
                          Anual estimado:{" "}
                          <span style={{ color: "#3B82F6", fontWeight: 800 }}>
                            {fmt(p.precio * 12)}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Botones +/- */}
                    <div
                      style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}
                    >
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          leafletRef.current?.zoomIn();
                        }}
                        style={{
                          width: 36,
                          height: 30,
                          borderRadius: 9,
                          background: "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          color: T.white,
                          fontSize: 18,
                          fontWeight: 600,
                          cursor: "pointer",
                          touchAction: "manipulation",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          lineHeight: 1,
                        }}
                      >
                        +
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          leafletRef.current?.zoomOut();
                        }}
                        style={{
                          width: 36,
                          height: 30,
                          borderRadius: 9,
                          background: "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          color: T.white,
                          fontSize: 20,
                          fontWeight: 600,
                          cursor: "pointer",
                          touchAction: "manipulation",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          lineHeight: 1,
                        }}
                      >
                        −
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
      </Card>
      <style>{`@keyframes markerPulse{0%,100%{transform:scale(1);opacity:.4}50%{transform:scale(1.6);opacity:.1}}`}</style>
    </div>
  );
}

// ── CONTRATOS ────────────────────────────────────────────────────

export default Mapa;
