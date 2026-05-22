import { Timestamp } from "firebase/firestore";

// ── Enums / Unions ────────────────────────────────────────────────
export type PanelEstado   = "Disponible" | "Ocupado" | "Mantenimiento" | "Libre";
export type ClienteEstado = "Activo" | "Por vencer" | "Inactivo" | "En contacto" | "Propuesta enviada" | "Frío" | "Perdido";
export type ClienteTipo   = "Cliente" | "Prospecto";
export type Moneda        = "PEN" | "USD";
export type FacturaTipo   = "FACTURA" | "BOLETA" | "NOTA_CREDITO" | "NOTA_DEBITO";
export type Coord         = number | string;
export type FsTimestamp   = Timestamp | string;

// ── Domain models ─────────────────────────────────────────────────
// Note: `[key: string]: unknown` is intentional — Firestore documents may contain
// server-generated fields not declared here. Accessed values must be narrowed via
// converters (toNumber, toDate) before use.

export interface Panel {
  id:         string;
  nombre:     string;
  tipo:       string;
  ciudad:     string;
  estado:     PanelEstado;
  lat?:       Coord;
  lng?:       Coord;
  direccion?: string;
  emoji?:     string;
  foto?:      string;
  deleted?:   boolean;
  deletedAt?: FsTimestamp;
  createdAt?: Timestamp | null;
  [key: string]: unknown;
}

export interface Cliente {
  id:        string;
  empresa:   string;
  ruc?:      string;
  contacto?: string;
  celular?:  string;
  email?:    string;
  sector?:   string;
  ciudad?:   string;
  estado:    ClienteEstado;
  tipo?:     ClienteTipo;
  deleted?:  boolean;
  createdAt?: Timestamp | null;
  [key: string]: unknown;
}

export interface Contrato {
  id:          string;
  panel_id:    string;
  cliente_id:  string;
  inicio:      string;
  fin:         string;
  monto:       number;
  pagado:      boolean;
  pagosMeses?: Record<string, boolean>;
  deleted?:    boolean;
  deletedAt?:  FsTimestamp;
  createdAt?:  Timestamp | null;
  [key: string]: unknown;
}

export interface Gasto {
  id:           string;
  descripcion:  string;
  monto:        number;
  categoria:    string;
  fecha:        string;
  proveedor?:   string;
  foto?:        string;
  subtotal?:    number;
  moneda?:      Moneda;
  foto_texto?:  string;
  deleted?:     boolean;
  createdAt?:   Timestamp | null;
  [key: string]: unknown;
}

export interface Proveedor {
  id:        string;
  empresa:   string;
  categoria: string;
  contacto?: string;
  celular?:  string;
  email?:    string;
  ruc?:      string;
  deleted?:  boolean;
  createdAt?: Timestamp | null;
  [key: string]: unknown;
}

export interface Factura {
  id:              string;
  numero?:         string | number;
  serie?:          string;
  tipo?:           FacturaTipo;
  estado?:         string;
  monto?:          number;
  subtotal?:       number;
  igv?:            number;
  total?:          number;
  moneda?:         Moneda;
  cliente_id?:     string;
  cliente_nombre?: string;
  cliente_doc?:    string;
  cliente_email?:  string;
  panel_id?:       string;
  pdf_url?:        string;
  xml_url?:        string;
  fecha_emision?:  string;
  createdAt?:      Timestamp | null;
  [key: string]: unknown;
}

export interface Sueldo {
  id:       string;
  nombre:   string;
  cargo?:   string;
  monto:    number;
  mes:      string;
  pagado?:  boolean;
  createdAt?: Timestamp | null;
  [key: string]: unknown;
}

// ── Utility types ─────────────────────────────────────────────────
export type FirebaseDoc = { id: string; [key: string]: unknown };
export type ColName = "paneles" | "clientes" | "contratos" | "gastos" | "proveedores" | "facturas" | "sueldos";

// ── App state types ───────────────────────────────────────────────
export interface AppData {
  paneles:     Panel[];
  clientes:    Cliente[];
  contratos:   Contrato[];
  gastos:      Gasto[];
  proveedores: Proveedor[];
  loading:     boolean;
  error:       string | null;
}

export interface AppSetters {
  setPaneles:     React.Dispatch<React.SetStateAction<Panel[]>>;
  setClientes:    React.Dispatch<React.SetStateAction<Cliente[]>>;
  setContratos:   React.Dispatch<React.SetStateAction<Contrato[]>>;
  setGastos:      React.Dispatch<React.SetStateAction<Gasto[]>>;
  setProveedores: React.Dispatch<React.SetStateAction<Proveedor[]>>;
}
