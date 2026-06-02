import {
  soundDelete,
  soundCreate,
  soundSuccess,
  soundError,
  soundSave,
} from "./sounds";

type ValidationResult = string | null;

export const hoy = () => new Date();
export const mesHoy = () => {
  const h = hoy();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
};
export const dias = (f: string): number =>
  Math.ceil((new Date(f).getTime() - hoy().getTime()) / 86400000);
export const fmt = (n: number | null | undefined): string =>
  `S/ ${Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtS2 = fmt; // alias: formato S/ con 2 decimales
/** Formato compacto: 1500 → "S/ 1.5K", 1200000 → "S/ 1.2M" */
export const fmtK = (n: number): string => {
  if (Math.abs(n) >= 1_000_000) return `S/ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `S/ ${(n / 1_000).toFixed(1)}K`;
  return fmt(n);
};
export const fmtF = (s: string | null | undefined): string =>
  s
    ? new Date(s).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
export const mesLabel = (m: string): string =>
  new Date(m + "-02")
    .toLocaleDateString("es-PE", { month: "long", year: "numeric" })
    .replace(/^\w/, c => c.toUpperCase());

export const haptic = (
  type: "light" | "medium" | "success" | "error" | "delete" | "create" | "save" = "light",
) => {
  try {
    // ── Sonido (import estático para no romper la cadena de gesto de usuario) ──
    if (type === "delete") soundDelete();
    else if (type === "create") soundCreate();
    else if (type === "save") soundSave();
    else if (type === "success") soundSuccess();
    else if (type === "error") soundError();
    // "light" y "medium" solo vibran, sin sonido
    // ── Vibración ──
    if (navigator.vibrate) {
      const patterns: Record<string, number[]> = {
        light: [10],
        medium: [20],
        success: [10, 50, 20],
        error: [30, 20, 30],
        delete: [30, 20, 30],
        create: [10, 50, 20],
        save: [10, 40, 15],
      };
      navigator.vibrate(patterns[type] || [10]);
    }
  } catch {
    /* silencioso */
  }
};

export const validate = {
  ruc(ruc?: string): ValidationResult {
    if (!ruc) return null;
    const clean = ruc.replace(/\D/g, "");
    if (clean.length !== 11) return "El RUC debe tener exactamente 11 dígitos";
    if (!["10", "20"].includes(clean.slice(0, 2))) return "RUC inválido (debe empezar por 10 o 20)";
    const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const suma = pesos.reduce((acc, p, i) => acc + p * Number(clean[i]), 0);
    const resto = suma % 11;
    const digEsp = resto === 1 ? 1 : resto === 0 ? 0 : 11 - resto;
    if (digEsp !== Number(clean[10])) return "RUC inválido (dígito verificador incorrecto)";
    return null;
  },
  email(email?: string): ValidationResult {
    if (!email) return null;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? null : "El email no tiene un formato válido";
  },
  fechasContrato(inicio: string, fin: string): ValidationResult {
    if (!inicio || !fin) return "Las fechas de inicio y fin son obligatorias";
    if (fin < inicio) return "La fecha de fin no puede ser anterior a la de inicio";
    return null;
  },
  monto(monto: number | string): ValidationResult {
    const n = Number(monto);
    if (isNaN(n) || n <= 0) return "El monto debe ser mayor a 0";
    return null;
  },
  panel(form: Record<string, unknown>): ValidationResult {
    if (!String(form.nombre ?? "").trim()) return "El nombre del panel es obligatorio";
    return null;
  },
  cliente(form: Record<string, unknown>): ValidationResult {
    if (!String(form.empresa ?? "").trim()) return "El nombre de la empresa es obligatorio";
    const emailErr = validate.email(form.email as string | undefined);
    if (emailErr) return emailErr;
    const rucErr = validate.ruc(form.ruc as string | undefined);
    if (rucErr) return rucErr;
    return null;
  },
  contrato(form: Record<string, unknown>): ValidationResult {
    if (!form.panel_id) return "Selecciona un panel";
    if (!form.cliente_id) return "Selecciona un cliente";
    const fechaErr = validate.fechasContrato(form.inicio as string, form.fin as string);
    if (fechaErr) return fechaErr;
    const montoErr = validate.monto(form.monto as number);
    if (montoErr) return montoErr;
    return null;
  },
  gasto(form: Record<string, unknown>): ValidationResult {
    if (!String(form.descripcion ?? "").trim()) return "La descripción del gasto es obligatoria";
    const montoErr = validate.monto(form.monto as number);
    if (montoErr) return montoErr;
    if (!form.fecha) return "La fecha del gasto es obligatoria";
    return null;
  },
  proveedor(form: Record<string, unknown>): ValidationResult {
    if (!String(form.empresa ?? "").trim()) return "El nombre de la empresa es obligatorio";
    const emailErr = validate.email(form.email as string | undefined);
    if (emailErr) return emailErr;
    const rucErr = validate.ruc(form.ruc as string | undefined);
    if (rucErr) return rucErr;
    return null;
  },
};
