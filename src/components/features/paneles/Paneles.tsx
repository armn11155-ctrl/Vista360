// @ts-nocheck — legacy file: migrating to strict TypeScript gradually
import { useState, useCallback, useRef } from "react";
import type { Panel, Contrato } from "../../../types";
import { fb } from "../../../services/firestore";
import { T } from "../../../config/theme";
import { toast, confirmAsync } from "../../../context/UIContext";
import { validate, haptic } from "../../../lib/utils";
import { CIUDADES, EMOJIS, TIPOS_PANEL, getCarasPanel } from "../../../config/constants";
import { Modal, Pagination } from "../../ui";
import { usePagination } from "../../../hooks/usePagination";

// ── Sub-componentes extraídos ─────────────────────────────────────
import { MiniMapaPanel } from "./MiniMapaPanel";
import { PanelCard } from "./PanelCard";
import { PanelHeader } from "./PanelHeader";

interface GeoSugerencia {
  label: string;
  lat: number;
  lng: number;
}
interface PanelesProps {
  paneles: Panel[];
  setPaneles: React.Dispatch<React.SetStateAction<Panel[]>>;
  contratos: Contrato[];
  loading: boolean;
  setTab?: (tab: string) => void;
  onModalChange?: (open: boolean) => void;
}

function inp(label: string, key: string, form: any, setForm: any, opts: any = {}) {
  const { type = "text", options = [], ph = "" } = opts;
  const s: any = {
    width: "100%",
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    padding: "10px 13px",
    color: T.text,
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: T.muted,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {label}
      </label>
      {type === "select" ? (
        <select
          value={form[key] || ""}
          onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
          style={{ ...s, cursor: "pointer" }}
        >
          {options.map((o: string) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={form[key] || ""}
          onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
          placeholder={ph}
          style={s}
        />
      )}
    </div>
  );
}

function SkeletonPaneles() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            height: 180,
            borderRadius: 24,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        />
      ))}
    </div>
  );
}

function Paneles({ paneles, setPaneles, contratos, loading, setTab, onModalChange }: PanelesProps) {
  const [modal, setModal] = useState<Partial<Panel> | null>(null);
  const [saving, setSaving] = useState(false);
  const emptyForm = {
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
  const [form, setForm] = useState(emptyForm);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState("");
  const [sugerencias, setSugerencias] = useState<GeoSugerencia[]>([]);
  const [showSug, setShowSug] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sugAbortRef = useRef<AbortController | null>(null);

  const buscarSugerencias = useCallback(
    async (texto: string) => {
      if (texto.length < 3) {
        setSugerencias([]);
        return;
      }
      sugAbortRef.current?.abort();
      sugAbortRef.current = new AbortController();
      try {
        const r = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(`${texto}, ${form.ciudad || "Peru"}, Peru`)}&limit=5&lang=es&bbox=-81.5,-18.5,-68.5,-0.0`,
          { signal: sugAbortRef.current.signal },
        );
        const d = await r.json();
        if (d.features?.length > 0) {
          setSugerencias(
            d.features.map((f: any) => ({
              label: [f.properties.name, f.properties.street, f.properties.city, f.properties.state]
                .filter(Boolean)
                .join(", "),
              lat: f.geometry.coordinates[1],
              lng: f.geometry.coordinates[0],
            })),
          );
          setShowSug(true);
        } else setSugerencias([]);
      } catch (e: any) {
        if (e.name !== "AbortError") setSugerencias([]);
      }
    },
    [form.ciudad],
  );

  const onDireccionChange = (val: string) => {
    setForm(f => ({ ...f, direccion: val }));
    setGeocodeMsg("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscarSugerencias(val), 400);
  };

  const elegirSugerencia = (s: GeoSugerencia) => {
    setForm(f => ({ ...f, direccion: s.label, lat: s.lat.toFixed(6), lng: s.lng.toFixed(6) }));
    setGeocodeMsg(`Ubicado: ${s.label}`);
    setSugerencias([]);
    setShowSug(false);
  };

  const geocodificar = async () => {
    if (!form.direccion?.trim()) return setGeocodeMsg(" Escribe una dirección primero");
    setGeocoding(true);
    setGeocodeMsg("Buscando...");
    setSugerencias([]);
    setShowSug(false);
    const enc = encodeURIComponent(`${form.direccion}, ${form.ciudad || ""}, Peru`);
    try {
      const r = await fetch(
        `https://photon.komoot.io/api/?q=${enc}&limit=1&lang=es&bbox=-81.5,-18.5,-68.5,-0.0`,
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
    } catch {
      /* fallback */
    }
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${enc}&format=json&limit=1&countrycodes=pe`,
        { headers: { "User-Agent": "Vista360/1.0", "Accept-Language": "es" } },
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
    } catch {
      /* noop */
    }
    setGeocodeMsg(" No encontrado. Prueba con la dirección más completa.");
    setGeocoding(false);
  };

  const openNew = () => {
    setForm(emptyForm);
    setModal("nuevo");
    onModalChange?.(true);
  };
  const openEdit = (p: Panel) => {
    setForm({ ...p });
    setModal(p);
    onModalChange?.(true);
  };
  const closeModal = () => {
    setModal(null);
    setGeocodeMsg("");
    setSugerencias([]);
    onModalChange?.(false);
  };

  const guardar = async () => {
    const err = validate.panel(form as Record<string, unknown>);
    if (err) return toast.warn(err);
    setSaving(true);
    const payload: any = {
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
        haptic("create");
        const r = await fb.post("paneles", payload);
        const saved = r?.[0]?.id ? r[0] : null;
        if (saved) setPaneles(p => [...p, saved]);
        else setPaneles(await fb.get("paneles"));
        toast.success("Panel guardado correctamente");
        if (payload.estado === "Ocupado" && setTab) setTab("historico");
      } else {
        haptic("success");
        const r = await fb.patch("paneles", (modal as Panel).id, payload);
        const saved = r?.[0]?.id ? r[0] : null;
        if (saved) setPaneles(p => p.map(x => (x.id === (modal as Panel).id ? saved : x)));
        else setPaneles(await fb.get("paneles"));
        toast.success("Panel actualizado correctamente");
      }
      closeModal();
    } catch (e: any) {
      toast.error("Error al guardar: " + e.message);
    }
    setSaving(false);
  };

  const eliminar = async (id: string) => {
    if (
      !(await confirmAsync("Los contratos asociados quedarán sin panel.", {
        title: "¿Eliminar panel?",
        danger: true,
        ok: "Sí, eliminar",
      }))
    )
      return;
    haptic("delete");
    await fb.del("paneles", id);
    setPaneles(p => p.filter(x => x.id !== id));
  };

  const hoyStr = new Date().toISOString().slice(0, 10);

  // ── Ocupación por cara (Unipolar = 2 caras A/B, Mural = 1 cara) ──────
  const carasMap = new Map<string, { A: boolean; B: boolean }>();
  contratos
    .filter(c => !c.deleted && c.inicio <= hoyStr && c.fin >= hoyStr)
    .forEach(c => {
      const cur = carasMap.get(c.panel_id) ?? { A: false, B: false };
      // Contratos legacy sin cara ocupan todas las caras del panel
      if (!c.cara || c.cara === "A") cur.A = true;
      if (!c.cara || c.cara === "B") cur.B = true;
      carasMap.set(c.panel_id, cur);
    });

  const libres = paneles.filter(p => !carasMap.has(p.id)).length;
  const ocupados = paneles.filter(p => carasMap.has(p.id)).length;
  const { paginated, page, setPage, totalPages, total, pageSize } = usePagination(paneles, 12);

  return (
    <div>
      <PanelHeader total={paneles.length} libres={libres} ocupados={ocupados} onNew={openNew} />
      {loading ? (
        <SkeletonPaneles />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
          {paginated.map(p => (
            <PanelCard
              key={p.id}
              panel={p}
              carasOcupadas={carasMap.get(p.id) ?? { A: false, B: false }}
              onEdit={openEdit}
              onDelete={eliminar}
            />
          ))}
          {paneles.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: 60,
                color: "#6B7280",
                background: "#fff",
                borderRadius: 22,
                border: "1px dashed #E5E7EB",
              }}
            >
              Sin paneles ·{" "}
              <button
                onClick={openNew}
                style={{
                  color: T.accent,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                + Agregar el primero
              </button>
            </div>
          )}
        </div>
      )}
      {!loading && totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          setPage={setPage}
          total={total}
          pageSize={pageSize}
          dark={false}
        />
      )}
      {modal && (
        <Modal
          title={modal === "nuevo" ? "Nuevo Panel" : "Editar Panel"}
          onClose={closeModal}
          onSave={guardar}
          saveLabel={saving ? "Guardando..." : "Guardar Panel"}
        >
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
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {inp("Nombre del panel *", "nombre", form, setForm, {
              ph: "Panel Norte – Av. Principal",
            })}
            {inp("Ciudad", "ciudad", form, setForm, { type: "select", options: CIUDADES })}
            {inp("Tipo", "tipo", form, setForm, { type: "select", options: ["LED", "Lona"] })}
            {inp("Precio mensual (S/)", "precio", form, setForm, { type: "number" })}
            {inp("Estado", "estado", form, setForm, {
              type: "select",
              options: ["Libre", "Ocupado"],
            })}
          </div>
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
              {inp("Visibilidad", "visibilidad", form, setForm, { ph: "Alta, Media, Baja" })}
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
                placeholder="Observaciones, acceso, etc."
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
              {inp("Costo instalación (S/)", "costoInstalacion", form, setForm, {
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
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") geocodificar();
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
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    touchAction: "manipulation",
                    flexShrink: 0,
                  }}
                >
                  {geocoding ? "…" : "Ubicar"}
                </button>
              </div>
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
                  }}
                >
                  {sugerencias.map((s, i) => (
                    <div
                      key={i}
                      onMouseDown={() => elegirSugerencia(s)}
                      style={{
                        padding: "10px 14px",
                        cursor: "pointer",
                        borderBottom: i < sugerencias.length - 1 ? `1px solid ${T.border}` : "none",
                        fontSize: 13,
                        color: T.text,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      📍 <span>{s.label}</span>
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
                  padding: "6px 10px",
                  borderRadius: 8,
                  color: geocodeMsg.startsWith(" ") ? T.green : T.red,
                  background: (geocodeMsg.startsWith(" ") ? T.green : T.red) + "12",
                }}
              >
                {geocodeMsg}
              </div>
            )}
          </div>
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
              Escribe la dirección y presiona <strong style={{ color: T.accent }}>Ubicar</strong> —
              luego ajusta el pin si necesitas precisión.
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

export default Paneles;
