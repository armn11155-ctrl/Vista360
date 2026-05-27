import { useEffect } from "react";
import type { Contrato, Cliente, Panel } from "../types";

const STORAGE_KEY = "v360_notif";
const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 días
const UMBRALES_DIAS = [30, 15] as const;

interface Params {
  contractsActive: Contrato[];
  paneles: Panel[];
  clientesActive: Cliente[];
  swRef: React.RefObject<ServiceWorkerRegistration | null>;
}

/**
 * Envía notificaciones push de vencimiento de contratos.
 *
 * - Solo actúa si el permiso de Notification es "granted".
 * - Persiste las notificaciones ya enviadas en localStorage con TTL de 90 días
 *   para no repetirlas en cada render.
 * - Usa showNotification() del SW para Android (vibración incluida);
 *   cae a new Notification() como fallback.
 * - Avisa a los 30 y 15 días antes del vencimiento.
 */
export function useNotifications({ contractsActive, paneles, clientesActive, swRef }: Params) {
  useEffect(() => {
    if (!contractsActive.length || !paneles.length || !clientesActive.length) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    const hoy = new Date();

    // ── Cargar y limpiar el registro de notificaciones ya enviadas ──
    let enviadas: Record<string, boolean> = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean | { ts: number; val: boolean }>;
        const cutoff = Date.now() - TTL_MS;
        const cleaned: Record<string, boolean> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "boolean") {
            // Formato legacy: conservar si el contrato aún existe
            const cid = k.split("_")[0];
            if (contractsActive.some(c => c.id === cid)) cleaned[k] = v;
          } else if (typeof v === "object" && v !== null && (v as { ts: number }).ts > cutoff) {
            cleaned[k] = (v as { ts: number; val: boolean }).val;
          }
        }
        enviadas = cleaned;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      }
    } catch {
      /* ignorar errores de localStorage */
    }

    // ── Disparar notificaciones pendientes ──
    contractsActive.forEach(c => {
      const diasRestantes = Math.ceil((new Date(c.fin).getTime() - hoy.getTime()) / 86_400_000);

      UMBRALES_DIAS.forEach(umbral => {
        if (diasRestantes <= 0 || diasRestantes > umbral) return;

        const key = `${c.id}_${umbral}`;
        if (enviadas[key]) return;

        const panel = paneles.find(p => p.id === c.panel_id);
        const cliente = clientesActive.find(cl => cl.id === c.cliente_id);
        if (!panel || !cliente) return;

        const titulo =
          diasRestantes <= 5
            ? `⚠️ Vence en ${diasRestantes} día${diasRestantes === 1 ? "" : "s"} — ${panel.nombre}`
            : `📅 Vence en ${diasRestantes} días — ${panel.nombre}`;
        const cuerpo = `Cliente: ${cliente.empresa} · S/ ${c.monto}/mes`;

        try {
          if (swRef.current?.showNotification) {
            swRef.current.showNotification(titulo, {
              body: cuerpo,
              tag: key,
              icon: "/favicon.ico",
              badge: "/favicon.ico",
              ...({ vibrate: [200, 100, 200] } as Record<string, unknown>),
              requireInteraction: diasRestantes <= 5,
            });
          } else {
            new Notification(titulo, { body: cuerpo, tag: key });
          }
          enviadas[key] = true;
        } catch {
          /* ignorar errores de Notification API */
        }
      });
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enviadas));
    } catch {
      /* ignorar errores de localStorage */
    }
  }, [contractsActive, paneles, clientesActive, swRef]);
}
