import { Timestamp } from "firebase/firestore";
import type { Coord, FsTimestamp } from "../types";

/** Convierte una coordenada Firestore (string o number) a number. Retorna 0 si inválido. */
export function toNumber(coord: Coord | null | undefined): number {
  if (coord === null || coord === undefined || coord === "") return 0;
  const n = Number(coord);
  return isNaN(n) ? 0 : n;
}

/** Convierte un FsTimestamp a Date. Retorna new Date() como fallback. */
export function toDate(ts: FsTimestamp | null | undefined): Date {
  if (!ts) return new Date();
  if (typeof ts === "object" && "toDate" in ts && typeof ts.toDate === "function") {
    return (ts as Timestamp).toDate();
  }
  const d = new Date(ts as string);
  return isNaN(d.getTime()) ? new Date() : d;
}
