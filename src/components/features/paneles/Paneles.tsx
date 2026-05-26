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

// ══════════════════════════════════════════════════════════════════
// MINI MAPA (sub-componente del modal de edición de paneles)
// ══════════════════════════════════════════════════════════════════
interface MiniMapaPanelProps {
  lat: number;
  lng: number;
  nombre: string;
  foto: string;
  onMove: (lat: number, lng: number, direccion: string) => void;
}

function MiniMapaPanel({ lat, lng, nombre, foto, onMove }: MiniMapaPanelProps) {
  // Normalizar Coord → number en el límite del componente
  const latN = toNumber(lat);
  const lngN = toNumber(lng);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const [ready, setReady] = useState(!!window.L);
  const [geocodingReverse, setGeocodingReverse] = useState(false);

  // Cargar Leaflet si no está ya
  useEffect(() => {
    if (window.L) {
      setReady(true);
      return;
    }
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);

  // Geocodificación inversa — lat/lng → dirección legible
  const reverseGeocode = async (la: number, ln: number) => {
    setGeocodingReverse(true);
    const controller = new AbortController();
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${ln}&format=json&accept-language=es`,
        { signal: controller.signal },
      );
      const d = await r.json();
      const addr = d && typeof d === "object" && d.address ? d.address : {};
      const road = addr.road || addr.pedestrian || addr.suburb || "";
      const city = addr.city || addr.town || addr.county || addr.state || "";
      const short =
        road && city
          ? `${road}, ${city}`
          : d && d.display_name
            ? d.display_name.split(",").slice(0, 3).join(", ")
            : `${la.toFixed(5)}, ${ln.toFixed(5)}`;
      onMove(la, ln, short);
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
      console.warn("[Geocoding] Reverse geocoding falló, usando coords brutas:", e);
      onMove(la, ln, `${la.toFixed(5)}, ${ln.toFixed(5)}`);
    } finally {
      setGeocodingReverse(false);
    }
  };

  // Inicializar mapa
  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;
    const map = window.L.map(containerRef.current, {
      center: [latN, lngN],
      zoom: 16,
      zoomControl: true,
      scrollWheelZoom: true,
    });
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    const icon = window.L.divIcon({
      className: "",
      iconSize: [44, 54],
      iconAnchor: [22, 54],
      html: `<div style="display:flex;flex-direction:column;align-items:center;gap:0">
        <div style="width:40px;height:40px;border-radius:50%;background:white;border:3px solid #2563EB;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 14px #0005;cursor:grab">${foto}</div>
        <div style="width:2px;height:12px;background:#2563EB;margin-top:-2px"></div>
      </div>`,
    });
    const marker = window.L.marker([latN, lngN], { icon, draggable: true }).addTo(map);
    marker.on("dragend", e => {
      const p = e.target.getLatLng();
      reverseGeocode(p.lat, p.lng);
    });
    // También al hacer clic en el mapa, mueve el pin ahí
    map.on("click", e => {
      marker.setLatLng(e.latlng);
      reverseGeocode(e.latlng.lat, e.latlng.lng);
    });
    markerRef.current = marker;
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [ready]);

  // Sincronizar si lat/lng cambian externamente
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([latN, lngN]);
    mapRef.current.setView([latN, lngN], 16);
  }, [latN, lngN]);

  return (
    <div
      style={{
        borderRadius: 14,
        overflow: "hidden",
        border: `1px solid ${T.border}`,
        height: 230,
        position: "relative",
      }}
    >
      {!ready && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: T.surface,
            color: T.muted,
            fontSize: 13,
            zIndex: 10,
          }}
        >
          Cargando mapa…
        </div>
      )}
      {geocodingReverse && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: "50%",
            transform: "translateX(-50%)",
            background: T.surface + "EE",
            borderRadius: 8,
            padding: "5px 12px",
            fontSize: 12,
            color: T.accent,
            zIndex: 1000,
            fontWeight: 600,
          }}
        >
          Obteniendo dirección…
        </div>
      )}
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

function Paneles({ paneles, setPaneles, contratos, loading, setTab, onModalChange }: PanelesProps) {
  const [modal, setModal] = useState<Partial<Panel> | null>(null);
  const [saving, setSaving] = useState(false);

  const empty = {
    nombre: "",
    tipo: "LED",
    precio: 0,
    estado: "Libre",
    foto: "",
    ciudad: "Lima",
    direccion: "",
    lat: "",
    lng: "",
    ancho: "",
    alto: "",
    iluminacion: "Sí",
    visibilidad: "",
    notas: "",
    costoInstalacion: "",
    fechaInstalacion: "",
    vidaUtilAnios: 10,
  };
  const [form, setForm] = useState(empty);

  const openNew = () => {
    setForm(empty);
    setModal("nuevo");
    onModalChange?.(true);
  };
  const openEdit = p => {
    setForm({ ...p });
    setModal(p);
    onModalChange?.(true);
  };

  const guardar = async () => {
    const panelErr = validate.panel(form as Record<string, unknown>);
    if (panelErr) return toast.warn(panelErr);
    setSaving(true);
    const payload = {
      nombre: form.nombre,
      tipo: form.tipo,
      precio: Number(form.precio) || 0,
      estado: form.estado,
      foto: form.foto || "",
      ciudad: form.ciudad,
      direccion: form.direccion || "",
      lat: form.lat ? String(form.lat) : null,
      lng: form.lng ? String(form.lng) : null,
      ancho: form.ancho || "",
      alto: form.alto || "",
      iluminacion: form.iluminacion || "Sí",
      visibilidad: form.visibilidad || "",
      notas: form.notas || "",
      costoInstalacion: Number(form.costoInstalacion) || 0,
      fechaInstalacion: form.fechaInstalacion || "",
      vidaUtilAnios: Number(form.vidaUtilAnios) || 10,
    };
    try {
      if (modal === "nuevo") {
        const r = await fb.post("paneles", payload);
        const saved = r && r.length > 0 && r[0] && r[0].id ? r[0] : null;
        if (saved) {
          setPaneles(p => [...p, saved]);
        } else {
          const fresh = await fb.get("paneles");
          setPaneles(Array.isArray(fresh) ? fresh : []);
        }
        setSaving(false);
        setModal(null);
        onModalChange?.(false);
        toast.success("Panel guardado correctamente");
        if (payload.estado === "Ocupado" && setTab) setTab("historico");
      } else {
        const r = await fb.patch("paneles", modal.id, payload);
        const saved = r && r.length > 0 && r[0] && r[0].id ? r[0] : null;
        if (saved) {
          setPaneles(p => p.map(x => (x.id === modal.id ? saved : x)));
        } else {
          const fresh = await fb.get("paneles");
          setPaneles(Array.isArray(fresh) ? fresh : []);
        }
        setSaving(false);
        setModal(null);
        onModalChange?.(false);
        toast.success("Panel actualizado correctamente");
        if (payload.estado === "Ocupado" && setTab) setTab("historico");
      }
    } catch (e) {
      setSaving(false);
      toast.error("Error al guardar: " + e.message);
    }
  };

  const eliminar = async id => {
    if (
      !(await confirmAsync("Los contratos asociados quedarán sin panel.", {
        title: "¿Eliminar panel?",
        danger: true,
        ok: "Sí, eliminar",
      }))
    )
      return;
    await fb.del("paneles", id);
    setPaneles(p => p.filter(x => x.id !== id));
  };

  // Ocupado real = tiene contrato activo HOY (no el campo estado manual)
  const hoyStrP = new Date().toISOString().slice(0, 10);
  const panelsConContratoHoy = new Set(
    contratos
      .filter(c => !c.deleted && c.inicio <= hoyStrP && c.fin >= hoyStrP)
      .map(c => c.panel_id),
  );
  const libre = paneles.filter(p => !panelsConContratoHoy.has(p.id)).length;
  const ocup = paneles.filter(p => panelsConContratoHoy.has(p.id)).length;

  // Paginación de la lista de paneles (cap. 12 por página para móvil)
  const {
    paginated: panelesPag,
    page: panelPage,
    setPage: setPanelPage,
    totalPages: panelTotalPages,
    total: panelTotal,
    pageSize: panelPageSize,
  } = usePagination(paneles, 12);

  // ── AUTOCOMPLETADO DE DIRECCIÓN EN TIEMPO REAL ──────────────────
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState("");
  const [sugerencias, setSugerencias] = useState<GeoSugerencia[]>([]);
  const [showSug, setShowSug] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const CITY_COORDS = {
    Lima: [-12.0464, -77.0428],
    Arequipa: [-16.409, -71.5375],
    Trujillo: [-8.1116, -79.0288],
    Chiclayo: [-6.7714, -79.8409],
    Piura: [-5.1945, -80.6328],
    Cusco: [-13.532, -71.9675],
    Iquitos: [-3.7491, -73.2538],
    Huancayo: [-12.0651, -75.2049],
    Tacna: [-18.0066, -70.2462],
    Pucallpa: [-8.3791, -74.5539],
    Huánuco: [-9.9306, -76.2422],
    Cajamarca: [-7.1638, -78.5003],
    Ica: [-14.0678, -75.7286],
    Sullana: [-4.9044, -80.6855],
    Juliaca: [-15.5, -70.1333],
    Ayacucho: [-13.1588, -74.2236],
    Chimbote: [-9.0853, -78.5783],
    Tumbes: [-3.5669, -80.4515],
    Puno: [-15.8402, -70.0219],
    Tarapoto: [-6.485, -76.3722],
    Moquegua: [-17.1942, -70.9329],
    Moyobamba: [-6.034, -76.9724],
    "Tingo María": [-9.2966, -75.9987],
    Huaraz: [-9.53, -77.5283],
    "Cerro de Pasco": [-10.6867, -76.2627],
    Abancay: [-13.6385, -72.8805],
    Andahuaylalas: [-13.656, -73.376],
    "Puerto Maldonado": [-12.5931, -69.1893],
    Bagua: [-5.6519, -78.5267],
    Chepen: [-7.2268, -79.4278],
  };

  // Ref para cancelar la sugerencia anterior si el usuario sigue escribiendo
  const sugAbortRef = useRef<AbortController | null>(null);

  // Buscar sugerencias en tiempo real mientras el usuario escribe
  const buscarSugerencias = useCallback(
    async (texto: string) => {
      if (texto.length < 3) {
        setSugerencias([]);
        return;
      }
      // Cancelar petición anterior si aún está en vuelo
      sugAbortRef.current?.abort();
      sugAbortRef.current = new AbortController();
      const query = `${texto}, ${form.ciudad || "Peru"}, Peru`;
      try {
        const r = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=es&bbox=-81.5,-18.5,-68.5,-0.0`,
          { signal: sugAbortRef.current.signal },
        );
        const d = await r.json();
        if (d.features?.length > 0) {
          const sug = d.features.map(f => ({
            label: [f.properties.name, f.properties.street, f.properties.city, f.properties.state]
              .filter(Boolean)
              .join(", "),
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
          }));
          setSugerencias(sug);
          setShowSug(true);
        } else {
          setSugerencias([]);
        }
      } catch (e) {
        if ((e as { name?: string }).name === "AbortError") return;
        console.warn("[Geocoding] buscarSugerencias falló:", e);
        setSugerencias([]);
      }
    },
    [form.ciudad],
  );

  const onDireccionChange = (val: string) => {
    setForm(f => ({ ...f, direccion: val }));
    setGeocodeMsg("");
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscarSugerencias(val), 400);
  };

  const elegirSugerencia = (s: GeoSugerencia) => {
    setForm(f => ({ ...f, direccion: s.label, lat: s.lat.toFixed(6), lng: s.lng.toFixed(6) }));
    setGeocodeMsg(`Ubicado: ${s.label}`);
    setSugerencias([]);
    setShowSug(false);
  };

  const geocodificar = async () => {
    if (!form.direccion.trim()) return setGeocodeMsg(" Escribe una dirección primero");
    setGeocoding(true);
    setGeocodeMsg("Buscando...");
    setSugerencias([]);
    setShowSug(false);
    const enc = encodeURIComponent(`${form.direccion}, ${form.ciudad || ""}, Peru`);
    const controller = new AbortController();

    try {
      const r = await fetch(
        `https://photon.komoot.io/api/?q=${enc}&limit=1&lang=es&bbox=-81.5,-18.5,-68.5,-0.0`,
        { signal: controller.signal },
      );
      const d = await r.json();
      if (d.features?.length > 0) {
        const [lng, lat] = d.features[0].geometry.coordinates;
        const p = d.features[0].properties;
        setForm(f => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
        setGeocodeMsg(` ${[p.name, p.street, p.city].filter(Boolean).join(", ")}`);
        setGeocoding(false);
        return;
      }
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
      console.warn("[Geocoding] Photon falló, intentando Nominatim:", e);
    }
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${enc}&format=json&limit=1&countrycodes=pe`,
        {
          headers: { "User-Agent": "Vista360/1.0", "Accept-Language": "es" },
          signal: controller.signal,
        },
      );
      const d = await r.json();
      if (d.length > 0) {
        setForm(f => ({
          ...f,
          lat: Number(d[0].lat).toFixed(6),
          lng: Number(d[0].lon).toFixed(6),
        }));
        setGeocodeMsg(` ${d[0].display_name.split(",").slice(0, 2).join(", ")}`);
        setGeocoding(false);
        return;
      }
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
      console.warn("[Geocoding] Nominatim también falló, usando coords de ciudad:", e);
    }
    if (coords) {
      setForm(f => ({ ...f, lat: coords[0].toFixed(6), lng: coords[1].toFixed(6) }));
      setGeocodeMsg(` Ubicado aprox. en ${form.ciudad}. Ajusta lat/lng si necesitas precisión.`);
    } else {
      setGeocodeMsg(" No encontrado. Prueba con la dirección más completa.");
    }
    setGeocoding(false);
  };

  return (
    <div>
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
        <div
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
        <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
          <div
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-0.3px",
              lineHeight: 1.2,
            }}
          >
            Paneles
          </div>
          <div
            style={{ fontSize: 12, color: "rgba(180,200,255,0.7)", marginTop: 3, fontWeight: 500 }}
          >
            {paneles.length} paneles · {libre} libres · {ocup} ocupados
          </div>
        </div>
        <button
          onClick={openNew}
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
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuevo
        </button>
      </div>

      {loading ? (
        <SkeletonPaneles />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
          {panelesPag.map(p => {
            const ocupado = panelsConContratoHoy.has(p.id);
            const stateColor = "#3B82F6";
            return (
              <div
                key={p.id}
                style={{
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 24,
                  background: "linear-gradient(160deg,#0F1B36 0%,#0A1430 55%,#070E22 100%)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  boxShadow:
                    "0 14px 40px -18px rgba(8,12,30,0.55), 0 1px 0 rgba(255,255,255,0.04) inset",
                  padding: 20,
                }}
              >
                {/* Diagonal line texture */}
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
                  {/* Top row: thumb + title + Libre pill */}
                  <div
                    style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}
                  >
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
                    <div
                      style={{
                        padding: "6px 14px",
                        borderRadius: 999,
                        border: `1.5px solid #3B82F6`,
                        color: ocupado ? "#fff" : "#3B82F6",
                        fontSize: 13,
                        fontWeight: 700,
                        background: ocupado ? "#3B82F6" : "transparent",
                        flexShrink: 0,
                      }}
                    >
                      {ocupado ? "Ocupado" : "Libre"}
                    </div>
                  </div>

                  {/* Address row */}
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
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.direccion}
                      </span>
                    </div>
                  )}

                  {/* Tipo + Precio row */}
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
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 800,
                          color: "#fff",
                          marginTop: 6,
                          letterSpacing: "-0.01em",
                        }}
                      >
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

                  {/* Action row: white pill + circular trash */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      onClick={() => openEdit(p)}
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
                      >
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                      </svg>
                      Editar
                    </button>
                    <button
                      onClick={() => eliminar(p.id)}
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
          })}
          {paneles.length === 0 && (
            <div
              style={{
                gridColumn: "1/-1",
                textAlign: "center",
                padding: 60,
                color: "#6B7280",
                background: "#fff",
                borderRadius: 22,
                border: "1px dashed #E5E7EB",
              }}
            >
              Sin paneles registrados ·{" "}
              <button
                onClick={openNew}
                style={{
                  color: T.accent,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  touchAction: "manipulation",
                  fontWeight: 700,
                }}
              >
                + Agregar el primero
              </button>
            </div>
          )}
        </div>
      )}
      {!loading && panelTotalPages > 1 && (
        <Pagination
          page={panelPage}
          totalPages={panelTotalPages}
          setPage={setPanelPage}
          total={panelTotal}
          pageSize={panelPageSize}
          dark={false}
        />
      )}

      {modal && (
        <Modal
          title={modal === "nuevo" ? " Nuevo Panel" : "Editar Panel"}
          onClose={() => {
            setModal(null);
            setGeocodeMsg("");
            onModalChange?.(false);
          }}
          onSave={guardar}
          saveLabel={saving ? "Guardando..." : "Guardar Panel "}
        >
          {/* Emoji selector */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.muted,
                textTransform: "uppercase",
                letterSpacing: 1,
                display: "block",
                marginBottom: 8,
              }}
            >
              Ícono
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => setForm(f => ({ ...f, foto: e }))}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    border: `2px solid ${form.foto === e ? T.accent : T.border}`,
                    background: form.foto === e ? T.accent + "22" : "transparent",
                    fontSize: 20,
                    cursor: "pointer",
                    touchAction: "manipulation",
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {inp("Nombre del panel", "nombre", form, setForm, {
              ph: "Panel Norte – Av. Principal",
            })}
            {inp("Ciudad", "ciudad", form, setForm, { type: "select", options: CIUDADES })}
            {inp("Tipo", "tipo", form, setForm, { type: "select", options: ["LED", "Lona"] })}
            {inp("Precio mensual ($)", "precio", form, setForm, { type: "number" })}
            {inp("Estado", "estado", form, setForm, {
              type: "select",
              options: ["Libre", "Ocupado"],
            })}
          </div>

          {/* Dimensiones e info física */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.muted,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 10,
              }}
            >
              Información del panel
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {inp("Ancho (m)", "ancho", form, setForm, { type: "number", ph: "ej: 4" })}
              {inp("Alto (m)", "alto", form, setForm, { type: "number", ph: "ej: 3" })}
              {inp("Iluminación", "iluminacion", form, setForm, {
                type: "select",
                options: ["Sí", "No"],
              })}
              {inp("Visibilidad", "visibilidad", form, setForm, { ph: "ej: Alta, Media, Baja" })}
            </div>
            <div style={{ marginTop: 12 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.muted,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  display: "block",
                  marginBottom: 5,
                }}
              >
                Notas adicionales
              </label>
              <textarea
                value={form.notas || ""}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Observaciones, características especiales, acceso, etc."
                rows={3}
                style={{
                  width: "100%",
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  padding: "10px 13px",
                  color: T.text,
                  fontSize: 14,
                  outline: "none",
                  fontFamily: "inherit",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
          {/* Datos para depreciación / Capital */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.muted,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 10,
              }}
            >
              Capital (depreciación)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {inp("Costo de instalación (S/)", "costoInstalacion", form, setForm, {
                type: "number",
                ph: "ej: 15000",
              })}
              {inp("Vida útil (años)", "vidaUtilAnios", form, setForm, {
                type: "number",
                ph: "10",
              })}
            </div>
            <div style={{ marginTop: 12 }}>
              {inp("Fecha de instalación", "fechaInstalacion", form, setForm, { type: "date" })}
            </div>
          </div>
          {/* Dirección con autocompletado en tiempo real */}
          <div style={{ marginTop: 12 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.muted,
                textTransform: "uppercase",
                letterSpacing: 1,
                display: "block",
                marginBottom: 5,
              }}
            >
              Dirección
            </label>
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={form.direccion || ""}
                  onChange={e => onDireccionChange(e.target.value)}
                  placeholder="Av. Javier Prado Este 123, San Isidro…"
                  autoComplete="off"
                  style={{
                    flex: 1,
                    background: T.surface,
                    border: `1px solid ${showSug && sugerencias.length > 0 ? T.accent : T.border}`,
                    borderRadius: showSug && sugerencias.length > 0 ? "10px 10px 0 0" : "10px",
                    padding: "10px 13px",
                    color: T.text,
                    fontSize: 14,
                    outline: "none",
                    fontFamily: "inherit",
                    transition: "border .2s",
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      geocodificar();
                    }
                    if (e.key === "Escape") {
                      setSugerencias([]);
                      setShowSug(false);
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowSug(false), 200)}
                  onFocus={() => sugerencias.length > 0 && setShowSug(true)}
                />
                <button
                  onClick={geocodificar}
                  disabled={geocoding}
                  style={{
                    padding: "10px 16px",
                    background: geocoding ? T.border : T.accent,
                    border: "none",
                    borderRadius: 10,
                    color: T.white,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    touchAction: "manipulation",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {geocoding ? "" : " Ubicar"}
                </button>
              </div>
              {/* Dropdown sugerencias */}
              {showSug && sugerencias.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 56,
                    background: T.card,
                    border: `1px solid ${T.accent}`,
                    borderTop: "none",
                    borderRadius: "0 0 10px 10px",
                    zIndex: 999,
                    overflow: "hidden",
                    boxShadow: `0 8px 24px rgba(0,0,0,0.5)`,
                  }}
                >
                  {sugerencias.map((s, i) => (
                    <div
                      key={i}
                      onMouseDown={() => elegirSugerencia(s)}
                      style={{
                        padding: "10px 14px",
                        cursor: "pointer",
                        touchAction: "manipulation",
                        borderBottom: i < sugerencias.length - 1 ? `1px solid ${T.border}` : "none",
                        fontSize: 13,
                        color: T.text,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        transition: "background .1s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = T.surface)}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ color: T.accent, flexShrink: 0 }}></span>
                      <span style={{ lineHeight: 1.3 }}>{s.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {geocodeMsg && (
              <div
                style={{
                  marginTop: 7,
                  fontSize: 12,
                  color: geocodeMsg.startsWith("")
                    ? T.green
                    : geocodeMsg.startsWith("")
                      ? T.white
                      : T.red,
                  padding: "6px 10px",
                  background:
                    (geocodeMsg.startsWith("")
                      ? T.green
                      : geocodeMsg.startsWith("")
                        ? T.white
                        : T.red) + "12",
                  borderRadius: 8,
                }}
              >
                {geocodeMsg}
              </div>
            )}
            {!geocodeMsg && form.direccion && form.direccion.length >= 3 && !showSug && (
              <div style={{ marginTop: 6, fontSize: 11, color: T.muted }}>
                Escribe para ver sugerencias automáticas o presiona para ubicar
              </div>
            )}
          </div>
          {/* Mini mapa interactivo — mueve el pin y la dirección se actualiza sola */}
          {(form.lat || form.lng) && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.muted,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Ajusta el pin en el mapa
                </span>
                <button
                  onClick={() => setForm(f => ({ ...f, lat: "", lng: "", direccion: "" }))}
                  style={{
                    background: "none",
                    border: "none",
                    color: T.muted,
                    cursor: "pointer",
                    touchAction: "manipulation",
                    fontSize: 11,
                  }}
                >
                  Limpiar
                </button>
              </div>
              <MiniMapaPanel
                lat={Number(form.lat)}
                lng={Number(form.lng)}
                nombre={form.nombre || "Panel"}
                foto={form.foto || ""}
                onMove={(lat, lng, dir) =>
                  setForm(f => ({
                    ...f,
                    lat: lat.toFixed(6),
                    lng: lng.toFixed(6),
                    direccion: dir || f.direccion,
                  }))
                }
              />
              <div
                style={{
                  marginTop: 6,
                  padding: "8px 12px",
                  background: T.green + "12",
                  border: `1px solid ${T.green}33`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: T.green,
                }}
              >
                {form.direccion || `${form.lat}, ${form.lng}`}
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: T.muted, textAlign: "center" }}>
                Arrastra el marcador para ajustar — la dirección se actualiza automáticamente
              </div>
            </div>
          )}
          {!form.lat && !form.lng && (
            <div
              style={{
                marginTop: 10,
                padding: "9px 13px",
                background: T.accent + "10",
                borderRadius: 10,
                fontSize: 12,
                color: T.muted,
              }}
            >
              Escribe la dirección y presiona <strong style={{ color: T.accent }}> Ubicar</strong> —
              luego ajusta el pin en el mapa si necesitas precisión.
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ── MAPA — Leaflet + OpenStreetMap (100% gratis) ─────────────────

export default Paneles;
