import { useState, useEffect, useCallback, Dispatch, SetStateAction } from "react";
import { fb } from "../services/firestore";
import type { FirebaseDoc, ColName } from "../types";

interface UseCollectionResult<T> {
  data: T[];
  setData: Dispatch<SetStateAction<T[]>>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook genérico para suscribirse a una colección Firestore en tiempo real.
 *
 * Expone `setData` para mutaciones optimistas desde los componentes feature,
 * de forma que el estado local se actualiza inmediatamente mientras Firestore
 * confirma el cambio en background.
 *
 * Uso:
 *   const { data, setData, loading, error } = useCollection<Panel>("paneles");
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

  return { data, setData, loading, error, refetch };
}
