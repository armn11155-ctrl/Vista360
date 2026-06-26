export const ESTADOS_CLI = ["Activo", "Por vencer", "Inactivo"];
export const ESTADOS_PRO = ["En contacto", "Propuesta enviada", "Ganado", "Frío", "Perdido"];
export const SECTORES = [
  "Alimentación",
  "Finanzas",
  "Retail",
  "Telecomunicaciones",
  "Alimentos",
  "Automotriz",
  "Salud",
  "Educación",
  "Otro",
];
export const CIUDADES = [
  "Lima",
  "Arequipa",
  "Trujillo",
  "Chiclayo",
  "Piura",
  "Cusco",
  "Iquitos",
  "Huancayo",
  "Tacna",
  "Pucallpa",
  "Huánuco",
  "Otra",
];
export const CAT_GASTOS = [
  "Mantenimiento",
  "Personal",
  "Transporte",
  "Administrativo",
  "Servicios",
  "Marketing",
  "Otro",
];
export const CAT_PROVE = [
  "Impresión",
  "Materiales",
  "Mantenimiento",
  "Servicios",
  "Transporte",
  "Tecnología",
  "Otro",
];
// ── Tipos de panel y número de caras ──────────────────────────────────
/** Tipos de panel disponibles */
export const TIPOS_PANEL = ["Unipolar", "Mural", "Valla", "Led", "Tótem", "Otro"] as const;

export type TipoPanel = (typeof TIPOS_PANEL)[number] | string;

/**
 * Retorna el número de caras (faces) que tiene un panel según su tipo.
 * Unipolares tienen 2 caras (A y B). El resto tienen 1 cara.
 */
export const getCarasPanel = (tipo: string): 1 | 2 =>
  tipo?.toLowerCase().includes("unipolar") ? 2 : 1;

// ── Íconos para paneles — reemplazados de P1-P10 a emojis visuales ──
export const EMOJIS = ["🏙️", "🌆", "🏢", "🏬", "🛣️", "🌉", "🏗️", "🗼", "🌃", "🏪"];

export const EMISOR = {
  razonSocial: import.meta.env.VITE_EMISOR_RAZON_SOCIAL ?? "",
  ruc: import.meta.env.VITE_EMISOR_RUC ?? "",
  direccion: import.meta.env.VITE_EMISOR_DIRECCION ?? "",
  ciudad: import.meta.env.VITE_EMISOR_CIUDAD ?? "",
  actividad: import.meta.env.VITE_EMISOR_ACTIVIDAD ?? "",
};

// Bottom nav
export const BOTTOM_TABS_LIST = [
  { id: "hoy", label: "Inicio" },
  { id: "paneles", label: "Paneles" },
  { id: "__add__", label: "" },
  { id: "contratos", label: "Contratos" },
  { id: "crm", label: "Clientes" },
];
export const NAV_TAB_IDS = BOTTOM_TABS_LIST.filter(t => t.id !== "__add__").map(t => t.id);

// Emails permitidos (whitelist)
export const ALLOWED_EMAILS: string[] = (import.meta.env.VITE_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e: string) => e.trim())
  .filter(Boolean);

// ── Dueño / gerente ──────────────────────────────────────────────
// Único(s) correo(s) con acceso a Finanzas (patrimonio, liquidez,
// activos, deudas, fondos, objetivos). Cualquier otro correo que
// agregues a VITE_ALLOWED_EMAILS entra a la app como "trabajador":
// puede usar todo lo demás (Paneles, Contratos, Clientes, Gastos,
// Proveedores, Facturación, Mapa, Histórico, Reportes) pero no ve
// Finanzas, ni en el menú ni en los datos (ver firestore.rules).
export const OWNER_EMAILS: string[] = [
  "armn.101@hotmail.com",
  "armn.11155@gmail.com",
];
