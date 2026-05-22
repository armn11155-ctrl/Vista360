import { useState, useEffect, useCallback } from "react";
import { fb } from "../services/firestore";
import type { FirebaseDoc, ColName } from "../types";

interface UseCollectionResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook para cargar y suscribirse a una colección Firestore en tiempo real.
 * Uso: const { data, loading } = useCollection<Panel>("paneles");
 */
export function useCollection<T extends FirebaseDoc>(col: ColName): UseCollectionResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const items = await fb.get<T>(col);
      setData(items);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [col]);

  useEffect(() => {
    setLoading(true);
    const unsub = fb.subscribe<T>(
      col,
      items => {
        setData(items);
        setLoading(false);
        setError(null);
      },
      err => {
        setError(String(err));
        setLoading(false);
      },
    );
    return unsub;
  }, [col]);

  return { data, loading, error, refetch };
}
