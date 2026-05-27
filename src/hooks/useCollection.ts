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
 * Expone `setData` para mutaciones optimistas desde los componentes feature.
 *
 * Mejoras:
 * - Timeout de 8s: si Firestore no responde (sin red, reglas bloqueando),
 *   pone loading=false con error en lugar de quedarse colgado para siempre.
 * - Cada colección falla de forma independiente; las demás siguen funcionando.
 */
const COLLECTION_TIMEOUT_MS = 8_000;

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

    // Timeout de seguridad: si el snapshot no llega en 8s, liberamos la UI
    const timer = setTimeout(() => {
      setLoading(false);
      setError(`Tiempo de espera agotado para "${col}". Verifica tu conexión.`);
    }, COLLECTION_TIMEOUT_MS);

    const unsub = fb.subscribe<T>(
      col,
      items => {
        clearTimeout(timer);
        setData(items);
        setLoading(false);
        setError(null);
      },
      err => {
        clearTimeout(timer);
        setError(String(err));
        setLoading(false);
      },
    );

    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [col]);

  return { data, setData, loading, error, refetch };
}
