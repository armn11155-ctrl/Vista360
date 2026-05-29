export const ESTADOS_CLI = ["Activo", "Por vencer", "Inactivo"];
export const ESTADOS_PRO = ["En contacto", "Propuesta enviada", "Frío", "Perdido"];
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
export const EMOJIS = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"];

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
