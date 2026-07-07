import { useState, useEffect } from "react";

/**
 * Detecta el estado de conexión online/offline del navegador.
 * Usa navigator.onLine como valor inicial y escucha los eventos
 * window "online" y "offline" para actualizaciones en tiempo real.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
