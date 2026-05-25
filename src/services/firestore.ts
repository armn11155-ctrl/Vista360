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
   * Sube una imagen a Cloudinary y devuelve la URL segura (formato WebP optimizado).
   *
   * Variables de entorno requeridas en Vercel / .env.local:
   *   VITE_CLOUDINARY_CLOUD_NAME    — nombre del cloud (ej: "mi-cloud")
   *   VITE_CLOUDINARY_UPLOAD_PRESET — upload preset sin firmar (ej: "boletas_unsigned")
   *
   * El preset debe tener habilitado:
   *   - Folder: vista360/boletas
   *   - Incoming transformations: q_auto,f_webp (opcional, mejora velocidad)
   */
  async uploadImagen(file: File): Promise<string> {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error(
        "Cloudinary no configurado. Agrega VITE_CLOUDINARY_CLOUD_NAME y VITE_CLOUDINARY_UPLOAD_PRESET en Vercel.",
      );
    }

    // Comprimir imagen antes de subir si es demasiado grande (> 2 MB)
    const fileToUpload = file.size > 2 * 1024 * 1024 ? await comprimirImagen(file) : file;

    const formData = new FormData();
    formData.append("file", fileToUpload);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", "vista360/boletas");
    // Transformaciones en Cloudinary: calidad automática + formato WebP
    formData.append("quality", "auto");
    formData.append("fetch_format", "webp");

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
};

/**
 * Comprime una imagen usando Canvas antes de subir a Cloudinary.
 * Escala a máx 1600px de ancho y aplica calidad JPEG 85%.
 */
async function comprimirImagen(file: File): Promise<File> {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const MAX_W = 1600;
      const scale = img.width > MAX_W ? MAX_W / img.width : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(file); // fallback: subir original
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      canvas.toBlob(
        blob => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.85,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}
