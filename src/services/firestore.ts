import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, orderBy, query, serverTimestamp, onSnapshot, Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import type { FirebaseDoc, ColName } from "../types";

function snapQuery(col: string, ord = "createdAt") {
  try { return query(collection(db, col), orderBy(ord, "desc")); }
  catch { return collection(db, col); }
}

interface DelOptions { hardDelete?: boolean; }

export const fb = {
  async get<T extends FirebaseDoc>(col: ColName): Promise<T[]> {
    try {
      const snap = await getDocs(snapQuery(col));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as T));
    } catch {
      try {
        const snap = await getDocs(collection(db, col));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as T));
      } catch(e2) { console.error("[Firebase] get falló:", e2); return []; }
    }
  },

  async post<T extends FirebaseDoc>(col: ColName, body: Omit<T, "id" | "createdAt">): Promise<T[]> {
    const payload = { ...body, createdAt: serverTimestamp() };
    const ref     = await addDoc(collection(db, col), payload);
    // Usamos unknown como paso intermedio para evitar el error TS2352
    return [{ ...body, id: ref.id, createdAt: Timestamp.now() } as unknown as T];
  },

  async patch<T extends FirebaseDoc>(col: ColName, id: string, body: Partial<Omit<T, "id">>): Promise<T[]> {
    await updateDoc(doc(db, col, id), body as Record<string, unknown>);
    return [{ ...body, id } as unknown as T];
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
      snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as T))),
      err  => { console.error(`[Firebase] subscribe ${col}:`, err); onErr?.(err); },
    );
  },
};
