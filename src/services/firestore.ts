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
import { db } from "../config/firebase";
import type { FirebaseDoc, ColName } from "../types";

function snapQuery(col: string, ord = "createdAt") {
  try {
    return query(collection(db, col), orderBy(ord, "desc"));
  } catch {
    return collection(db, col);
  }
}

interface DelOptions {
  hardDelete?: boolean;
}

// ── Helpers de URL de Cloudinary ─────────────────────────────────
// Cloudinary permite aplicar transformaciones en la URL sin re-subir la imagen.

/**
 * URL para thumbnail pequeño (lista de gastos, preview en form).
 * ~8-15 KB: WebP, 400px ancho, calidad baja automática.
 */
export function cloudinaryThumb(url: string | undefined | null): string {
  if (!url || !url.includes("cloudinary.com")) return url ?? "";
  return url.replace("/upload/", "/upload/f_webp,q_auto:low,w_400,c_limit/");
}

/**
 * URL para vista de detalle (modal de detalle del gasto).
 * ~40-80 KB: WebP, 800px ancho, calidad buena automática.
 */
export function cloudinaryDetail(url: string | undefined | null): string {
  if (!url || !url.includes("cloudinary.com")) return url ?? "";
  return url.replace("/upload/", "/upload/f_webp,q_auto:good,w_800,c_limit/");
}

/**
 * URL para PDF (resolución alta para impresión).
 * ~200-400 KB: formato original, calidad best, 1600px ancho.
 */
export function cloudinaryPdf(url: string | undefined | null): string {
  if (!url || !url.includes("cloudinary.com")) return url ?? "";
  return url.replace("/upload/", "/upload/q_auto:best,w_1600,c_limit/");
}

/**
 * Extrae el publicId de una URL de Cloudinary.
 * Ej: "https://res.cloudinary.com/mi-cloud/image/upload/v1234/vista360/boletas/abc.jpg"
 *       → "vista360/boletas/abc"
 */
export function cloudinaryPublicId(url: string | undefined | null): string | null {
  if (!url || !url.includes("cloudinary.com")) return null;
  const match = url.match(/\/upload\/(?:[^/]+\/)*(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
  return match ? match[1] : null;
}

export const fb = {
  async get<T extends FirebaseDoc>(col: ColName): Promise<T[]> {
    try {
      const snap = await getDocs(snapQuery(col));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as T);
    } catch {
      try {
        const snap = await getDocs(collection(db, col));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }) as T);
      } catch (e2) {
        console.error("[Firebase] get falló:", e2);
        return [];
      }
    }
  },

  async post<T extends FirebaseDoc>(col: ColName, body: Omit<T, "id" | "createdAt">): Promise<T> {
    const payload = { ...body, createdAt: serverTimestamp() };
    const ref = await addDoc(collection(db, col), payload);
    return { ...body, id: ref.id, createdAt: Timestamp.now() } as unknown as T;
  },

  async patch<T extends FirebaseDoc>(
    col: ColName,
    id: string,
    body: Partial<Omit<T, "id">>,
  ): Promise<T> {
    await updateDoc(doc(db, col, id), body as Record<string, unknown>);
    return { ...body, id } as unknown as T;
  },

  async del(col: ColName, id: string, { hardDelete = false }: DelOptions = {}): Promise<void> {
    if (hardDelete) {
      await deleteDoc(doc(db, col, id));
    } else {
      await updateDoc(doc(db, col, id), { deleted: true, deletedAt: serverTimestamp() });
    }
  },

  subscribe<T extends FirebaseDoc>(
    col: string,
    onData: (items: T[]) => void,
    onErr?: (e: unknown) => void,
  ): () => void {
    const q = snapQuery(col);
    return onSnapshot(
      q,
      snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }) as T)),
      err => {
        console.error(`[Firebase] subscribe ${col}:`, err);
        onErr?.(err);
      },
    );
  },

  /**
   * Sube una imagen a Cloudinary con compresión máxima.
   *
   * Variables de entorno requeridas:
   *   VITE_CLOUDINARY_CLOUD_NAME    — nombre del cloud
   *   VITE_CLOUDINARY_UPLOAD_PRESET — upload preset sin firmar
   *
   * La imagen siempre se comprime antes de subir:
   *   - Máx 1200px de ancho (suficiente para OCR y vista de detalle)
   *   - JPEG calidad 72% (buen balance texto/tamaño)
   *   - Cloudinary aplica optimización adicional automática
   */
  async uploadImagen(file: File): Promise<string> {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error(
        "Cloudinary no configurado. Agrega VITE_CLOUDINARY_CLOUD_NAME y VITE_CLOUDINARY_UPLOAD_PRESET en Vercel.",
      );
    }

    // Siempre comprimir antes de subir
    const fileComprimido = await comprimirImagen(file);

    const formData = new FormData();
    formData.append("file", fileComprimido);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", "vista360/boletas");
    // Cloudinary aplica optimización adicional sobre la imagen ya comprimida
    formData.append("quality", "auto");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          `Cloudinary error ${res.status}: ${(err as { error?: { message?: string } }).error?.message ?? res.statusText}`,
        );
      }

      const data = (await res.json()) as { secure_url: string };
      return data.secure_url;
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error).name === "AbortError") {
        throw new Error("Timeout: la subida de la foto tardó más de 20s. Intenta de nuevo.");
      }
      throw err;
    }
  },

  /**
   * Elimina una imagen de Cloudinary vía el backend (necesita API Secret).
   * No lanza error si falla — la eliminación es best-effort.
   */
  async eliminarImagen(fotoUrl: string): Promise<void> {
    const publicId = cloudinaryPublicId(fotoUrl);
    if (!publicId) return;

    const apiUrl = import.meta.env.VITE_API_URL;
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiUrl || !apiKey) return;

    try {
      await fetch(`${apiUrl}/api/cloudinary/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ publicId }),
        signal: AbortSignal.timeout(8_000),
      });
    } catch (e) {
      // No bloquear flujo principal si falla la eliminación
      console.warn("[Cloudinary] No se pudo eliminar imagen:", publicId, e);
    }
  },
};

/**
 * Comprime siempre la imagen antes de subir a Cloudinary.
 * Objetivo: mínimo peso posible manteniendo legibilidad para OCR.
 *   - Máx 1200px de ancho
 *   - JPEG calidad 72%
 *   - Resultado típico: 80-250 KB para una foto de boleta
 */
async function comprimirImagen(file: File): Promise<File> {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const MAX_W = 1200;
      const scale = img.width > MAX_W ? MAX_W / img.width : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      canvas.toBlob(
        blob => {
          if (!blob) {
            resolve(file);
            return;
          }
          const nombre = file.name.replace(/\.\w+$/, ".jpg");
          resolve(new File([blob], nombre, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.72, // 72% — óptimo para texto de boletas
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}
