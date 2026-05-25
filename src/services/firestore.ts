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

  /** Crea un documento y devuelve el objeto recién creado con su id. */
  async post<T extends FirebaseDoc>(col: ColName, body: Omit<T, "id" | "createdAt">): Promise<T> {
    const payload = { ...body, createdAt: serverTimestamp() };
    const ref = await addDoc(collection(db, col), payload);
    return { ...body, id: ref.id, createdAt: Timestamp.now() } as unknown as T;
  },

  /** Actualiza campos de un documento y devuelve el objeto parcialmente actualizado. */
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
    col: ColName,
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
   * Sube una imagen a Cloudinary y devuelve la URL segura.
   * Requiere las variables de entorno:
   *   VITE_CLOUDINARY_CLOUD_NAME   — nombre del cloud (ej: "mi-cloud")
   *   VITE_CLOUDINARY_UPLOAD_PRESET — upload preset sin firmar (ej: "boletas_unsigned")
   */
  async uploadImagen(file: File): Promise<string> {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error(
        "Cloudinary no configurado. Agrega VITE_CLOUDINARY_CLOUD_NAME y VITE_CLOUDINARY_UPLOAD_PRESET en Vercel.",
      );
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", "vista360/boletas");

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        `Cloudinary error ${res.status}: ${(err as any).error?.message ?? res.statusText}`,
      );
    }

    const data = await res.json();
    return data.secure_url as string;
  },
};
