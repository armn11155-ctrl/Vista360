import type React from "react";
import { Timestamp } from "firebase/firestore";

// ── Enums / Unions ────────────────────────────────────────────────
export type PanelEstado = "Disponible" | "Ocupado" | "Mantenimiento" | "Libre";
export type ClienteEstado =
  | "Activo"
  | "Por vencer"
  | "Inactivo"
  | "En contacto"
  | "Propuesta enviada"
  | "Ganado"
  | "Frío"
  | "Perdido";
export type ClienteTipo = "Cliente" | "Prospecto";
export type Moneda = "PEN" | "USD";
export type FacturaTipo = "FACTURA" | "BOLETA" | "NOTA_CREDITO" | "NOTA_DEBITO";

/**
 * Coordenada geográfica. Siempre número (lat/lng en decimal degrees).
 * Si llega como string desde un formulario, parsear con Number() antes de guardar.
 */
export type Coord = number;

/**
 * Timestamp de Firestore. Todos los campos de fecha se almacenan como
 * Timestamp; no usar strings ISO en Firestore para fechas de auditoría.
 * Excepción: fechas de negocio tipo "2024-03" se guardan como string (mes).
 */
export type FsTimestamp = Timestamp;

// ── Base types para Firestore ─────────────────────────────────────
/**
 * Restricción mínima para documentos Firestore: solo requiere `id`.
 * Usada como generic constraint en useCollection / useFirestorePagination.
 */
export type FirestoreBase = { id: string };

/**
 * Tipo legacy con index signature; solo se usa en las funciones del
 * servicio firestore.ts que necesitan acceder a campos desconocidos.
 * No extiendas los modelos de dominio de este tipo.
 */
export type FirebaseDoc = { id: string; [key: string]: unknown };

// ── Domain models (tipado estricto, sin index signature) ──────────

export interface Panel {
  id: string;
  nombre: string;
  tipo: string;
  ciudad: string;
  estado: PanelEstado;
  lat?: Coord;
  lng?: Coord;
  direccion?: string;
  /** Precio mensual del panel en soles (PEN). */
  precio?: number;
  /** Identificador visual del tipo de panel (ej: "🏙️", "🛣️"). Máx 2 chars. */
  icono?: string;
  foto?: string;
  deleted?: boolean;
  deletedAt?: FsTimestamp;
  createdAt?: Timestamp | null;
}

export interface Cliente {
  id: string;
  empresa: string;
  ruc?: string;
  contacto?: string;
  celular?: string;
  email?: string;
  sector?: string;
  ciudad?: string;
  estado: ClienteEstado;
  tipo?: ClienteTipo;
  panelInteres?: string;
  notas?: string;
  origen?: string;
  /** Última cotización enviada desde el CRM (para avisar si no hay respuesta) */
  ultima_cotizacion_at?: string;
  ultima_cotizacion_monto?: number;
  ultima_cotizacion_panel?: string;
  deleted?: boolean;
  createdAt?: Timestamp | null;
}

export interface Contrato {
  id: string;
  panel_id: string;
  cliente_id: string;
  /** Cara del panel: 'A' | 'B' para unipolares (2 caras), null para murales (1 cara).
   *  Contratos legacy sin este campo se tratan como que ocupan todas las caras. */
  cara?: "A" | "B" | null;
  inicio: string;
  fin: string;
  monto: number;
  pagado: boolean;
  pagosMeses?: Record<string, boolean>;
  /** Factura que originó este contrato (si fue creado automáticamente) */
  factura_id?: string;
  factura_numero?: string;
  /** Estado de la factura vinculada. Si es Emitida/Cobrada, los meses están bloqueados. */
  factura_estado?: string;
  /** Fotos de la campaña instalada, con fecha — evidencia para el cliente */
  fotos_campania?: { url: string; fecha: string }[];
  /** Meses bloqueados por factura SUNAT. key: "YYYY-MM", value: "Emitida"|"Cobrada" */
  mesesFacturados?: Record<string, string>;
  deleted?: boolean;
  deletedAt?: FsTimestamp;
  createdAt?: Timestamp | null;
}

export interface Gasto {
  id: string;
  descripcion: string;
  monto: number;
  categoria: string;
  fecha: string;
  proveedor?: string;
  foto?: string;
  subtotal?: number;
  moneda?: Moneda;
  foto_texto?: string;
  /** Plantilla recurrente — se vuelve a crear sola cada mes (ver cron en facturacion-api) */
  recurrente?: boolean;
  recurrente_dia?: number;
  /** Presente solo en los gastos generados automáticamente: apunta a la plantilla que los originó */
  recurrente_origen_id?: string;
  deleted?: boolean;
  createdAt?: Timestamp | null;
}

export interface Proveedor {
  id: string;
  empresa: string;
  categoria: string;
  contacto?: string;
  celular?: string;
  email?: string;
  ruc?: string;
  deleted?: boolean;
  createdAt?: Timestamp | null;
}

export interface Factura {
  id: string;
  numero?: string | number;
  serie?: string;
  tipo?: FacturaTipo;
  estado?: string;
  monto?: number;
  subtotal?: number;
  igv?: number;
  total?: number;
  moneda?: Moneda;
  cliente_id?: string;
  cliente_nombre?: string;
  cliente_doc?: string;
  cliente_email?: string;
  panel_id?: string;
  pdf_url?: string;
  xml_url?: string;
  fecha_emision?: string;
  createdAt?: Timestamp | null;
}

export interface Sueldo {
  id: string;
  nombre: string;
  cargo?: string;
  monto: number;
  mes: string;
  pagado?: boolean;
  createdAt?: Timestamp | null;
}

/**
 * Solicitud enviada desde el formulario público de la página web.
 * Llega sin validar (cualquiera la puede crear, ver reglas de Firestore).
 * El admin la revisa en la app y la Acepta (se convierte en Cliente) o
 * la Rechaza (se borra). Nunca se usa directamente como Cliente.
 */
export interface SolicitudWeb {
  id: string;
  contacto: string;
  empresa: string;
  celular: string;
  email: string;
  panelInteres?: string;
  notas?: string;
  tipo: "Prospecto";
  estado: "En contacto";
  origen: "web";
  createdAt?: Timestamp | null;
}

// ── Utility types ─────────────────────────────────────────────────
export type ColName =
  | "paneles"
  | "clientes"
  | "contratos"
  | "gastos"
  | "proveedores"
  | "facturas"
  | "sueldos"
  | "solicitudesWeb";

// ── App state types ───────────────────────────────────────────────
export interface AppData {
  paneles: Panel[];
  clientes: Cliente[];
  contratos: Contrato[];
  gastos: Gasto[];
  proveedores: Proveedor[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface AppSetters {
  setPaneles: React.Dispatch<React.SetStateAction<Panel[]>>;
  setClientes: React.Dispatch<React.SetStateAction<Cliente[]>>;
  setContratos: React.Dispatch<React.SetStateAction<Contrato[]>>;
  setGastos: React.Dispatch<React.SetStateAction<Gasto[]>>;
  setProveedores: React.Dispatch<React.SetStateAction<Proveedor[]>>;
}
