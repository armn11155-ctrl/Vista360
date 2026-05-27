import { useState, useCallback, useRef } from "react";
import {
  collection,
  query,
  limit,
  startAfter,
  getDocs,
  type DocumentSnapshot,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "../config/firebase";
import type { ColName, FirebaseDoc } from "../types";

const DEFAULT_PAGE_SIZE = 20;

export interface UseFirestorePaginationResult<T> {
  /** Documentos de la página actual */
  items: T[];
  /** true mientras carga la primera página o una nueva página */
  loading: boolean;
  /** Mensaje de error, si lo hay */
  error: string | null;
  /** true si hay más páginas disponibles */
  hasMore: boolean;
  /** Carga la primera página (reinicia la paginación) */
  loadFirst: () => Promise<void>;
  /** Carga la siguiente página (append a items) */
  loadMore: () => Promise<void>;
  /** Página actual (1-indexed) */
  page: number;
}

/**
 * useFirestorePagination — paginación cursor-based para Firestore.
 *
 * Ventajas sobre leer toda la colección de una vez:
 *  - Reduce lecturas de Firestore (solo paga por lo que muestra)
 *  - Evita cargar 500+ documentos en memoria
 *  - Apropiado para colecciones que crecen con el tiempo
 *
 * Uso:
 * ```tsx
 * const { items, loading, hasMore, loadFirst, loadMore } =
 *   useFirestorePagination<Gasto>("gastos", 12, [orderBy("fecha", "desc")]);
 *
 * useEffect(() => { loadFirst(); }, [loadFirst]);
 * ```
 */
export function useFirestorePagination<T extends FirebaseDoc>(
  col: ColName,
  pageSize: number = DEFAULT_PAGE_SIZE,
  /** Constraints adicionales (where, orderBy). NO incluir limit(). */
  extraConstraints: QueryConstraint[] = [],
): UseFirestorePaginationResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  /** Último documento de la página anterior (cursor) */
  const lastDocRef = useRef<DocumentSnapshot | null>(null);

  const buildQuery = useCallback(
    (after: DocumentSnapshot | null) => {
      const constraints: QueryConstraint[] = [
        ...extraConstraints,
        limit(pageSize + 1), // pedimos uno más para saber si hay siguiente página
      ];
      if (after) constraints.push(startAfter(after));
      return query(collection(db, col), ...constraints);
    },
    [col, pageSize, extraConstraints],
  );

  /** Carga la primera página desde cero */
  const loadFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
    lastDocRef.current = null;
    try {
      const snap = await getDocs(buildQuery(null));
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
      const hasNext = docs.length > pageSize;
      setItems(hasNext ? docs.slice(0, pageSize) : docs);
      setHasMore(hasNext);
      lastDocRef.current = hasNext ? snap.docs[pageSize - 1] : null;
      setPage(1);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [buildQuery, pageSize]);

  /** Carga la siguiente página y la añade a items */
  const loadMore = useCallback(async () => {
    if (!hasMore || loading || !lastDocRef.current) return;
    setLoading(true);
    try {
      const snap = await getDocs(buildQuery(lastDocRef.current));
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
      const hasNext = docs.length > pageSize;
      setItems((prev) => [...prev, ...(hasNext ? docs.slice(0, pageSize) : docs)]);
      setHasMore(hasNext);
      lastDocRef.current = hasNext ? snap.docs[pageSize - 1] : null;
      setPage((p) => p + 1);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [buildQuery, hasMore, loading, pageSize]);

  return { items, loading, error, hasMore, loadFirst, loadMore, page };
}
