/**
 * Estimación de almacenamiento real de Firestore
 *
 * Fórmula oficial de Google Firebase:
 * https://firebase.google.com/docs/firestore/storage-size#document-size
 *
 * Tamaño de un documento =
 *   - Nombre del documento (path completo del proyecto)
 *   - Suma de nombres de campos (bytes UTF-8)
 *   - Suma de valores de campos (según tipo)
 *   - 32 bytes de overhead fijo por documento
 *
 * Importante:
 * - Los índices automáticos duplican aprox. el almacenamiento total
 * - Las URLs de Cloudinary se cuentan como strings en Firestore (no el archivo)
 */

// ── Tamaño de valores según tipo de Firestore ─────────────────────
function bytesValor(v: unknown): number {
  if (v === null || v === undefined) return 1;
  if (typeof v === "boolean")        return 1;
  if (typeof v === "number")         return 8;
  if (typeof v === "string")         return new TextEncoder().encode(v).length;

  // Timestamp de Firestore: { seconds, nanoseconds }
  if (v && typeof v === "object" && "seconds" in v && "nanoseconds" in v) return 8;

  if (Array.isArray(v))
    return v.reduce((s, item) => s + bytesValor(item), 0);

  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>).reduce(
      (s, [key, val]) =>
        s + new TextEncoder().encode(key).length + bytesValor(val),
      0,
    );
  }

  return 0;
}

// ── Tamaño de un documento completo ───────────────────────────────
// Overhead fijo 32 B + nombre del documento (~88 B promedio para rutas típicas)
const DOC_OVERHEAD = 32 + 88;

function bytesDocumento(doc: Record<string, unknown>): number {
  const campoBytes = Object.entries(doc).reduce(
    (s, [key, val]) =>
      s + new TextEncoder().encode(key).length + bytesValor(val),
    0,
  );
  return DOC_OVERHEAD + campoBytes;
}

// ── Colecciones de Vista360 ───────────────────────────────────────
export const COLECCIONES_VISTA360 = [
  "paneles",
  "contratos",
  "clientes",
  "gastos",
  "proveedores",
  "facturas",
  "sueldos",
] as const;

export interface ColStats {
  nombre: string;
  documentos: number;
  bytesData: number;   // datos puros
  bytesTotal: number;  // datos + índices automáticos (~×2)
}

/**
 * Lee TODAS las colecciones de Vista360 desde Firestore y calcula
 * el almacenamiento real usando la fórmula oficial de Google.
 *
 * Los índices automáticos de Firestore aproximadamente duplican
 * el almacenamiento de datos, por eso multiplicamos por 2.
 */
export async function calcularUsoFirestore(
  db: import("firebase/firestore").Firestore,
): Promise<{ cols: ColStats[]; totalData: number; totalConIndices: number }> {
  const { collection, getDocs } = await import("firebase/firestore");

  const cols: ColStats[] = await Promise.all(
    COLECCIONES_VISTA360.map(async nombre => {
      try {
        const snap = await getDocs(collection(db, nombre));
        let bytesData = 0;
        snap.docs.forEach(d => {
          const doc = { id: d.id, ...d.data() } as Record<string, unknown>;
          // Excluir campos que NO se almacenan en Firestore (solo en cliente)
          delete doc._local;
          bytesData += bytesDocumento(doc);
        });
        return {
          nombre,
          documentos: snap.size,
          bytesData,
          bytesTotal: bytesData * 2, // índices automáticos
        };
      } catch {
        return { nombre, documentos: 0, bytesData: 0, bytesTotal: 0 };
      }
    }),
  );

  const totalData       = cols.reduce((s, c) => s + c.bytesData, 0);
  const totalConIndices = cols.reduce((s, c) => s + c.bytesTotal, 0);

  return { cols, totalData, totalConIndices };
}

// ── Helpers de formato ────────────────────────────────────────────
export function fmtBytes(b: number): string {
  if (b === 0)                   return "0 B";
  if (b < 1024)                  return `${b} B`;
  if (b < 1024 * 1024)           return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024)   return `${(b / 1024 / 1024).toFixed(2)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(3)} GB`;
}

export const FIRESTORE_LIMIT_BYTES  = 1  * 1024 * 1024 * 1024; // 1 GB (plan gratuito)
export const CLOUDINARY_LIMIT_BYTES = 25 * 1024 * 1024 * 1024; // 25 GB (plan gratuito)

/**
 * Estimación de almacenamiento Cloudinary basada en gastos con foto.
 * Cada foto comprimida pesa ~150 KB (promedio con compresión 72% JPEG 1200px).
 */
export function estimarBytesCloudinary(gastos: Array<Record<string, unknown>>): number {
  const fotosCount = gastos.filter(g => g.fotoUrl || g.foto_url || g.foto).length;
  return fotosCount * 150 * 1024; // 150 KB por foto
}
