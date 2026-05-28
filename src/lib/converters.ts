import { Timestamp } from "firebase/firestore";
import type { FsTimestamp } from "../types";

/**
 * Convierte una coordenada (string o number) a number.
 * Acepta string para manejar valores provenientes de formularios antes de
 * ser normalizados al tipo Coord (number). Retorna 0 si inválido.
 */
export function toNumber(coord: number | string | null | undefined): number {
  if (coord === null || coord === undefined || coord === "") return 0;
  const n = Number(coord);
  return isNaN(n) ? 0 : n;
}

/**
 * Convierte un FsTimestamp (o string ISO legacy) a Date.
 * Retorna new Date() como fallback si el valor es nulo o inválido.
 */
export function toDate(ts: FsTimestamp | string | null | undefined): Date {
  if (!ts) return new Date();
  if (typeof ts === "object" && "toDate" in ts && typeof ts.toDate === "function") {
    return (ts as Timestamp).toDate();
  }
  const d = new Date(ts as string);
  return isNaN(d.getTime()) ? new Date() : d;
}
