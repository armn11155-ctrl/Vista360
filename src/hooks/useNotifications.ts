import { useEffect } from "react";
import type { Contrato, Cliente, Panel } from "../types";

const STORAGE_KEY = "v360_notif";

/**
 * TTL por tipo de clave:
 *   cv_  contrato por vencer   → 90 días  (un umbral por contrato, no repetir)
 *   fp_  factura pendiente     →  7 días  (recordatorio semanal mientras siga sin pagar)
 *   pl_  panel libre           → 30 días  (recordatorio mensual mientras siga libre)
 *   ci_  cliente inactivo      → 30 días  (recordatorio mensual mientras siga inactivo)
 *   meta_ meta mensual         → 28 días  (una vez por mes natural)
 */
const TTL_MS: Record<string, number> = {
  cv: 90 * 24 * 60 * 60 * 1000,
  fp: 7 * 24 * 60 * 60 * 1000,
  pl: 30 * 24 * 60 * 60 * 1000,
  ci: 30 * 24 * 60 * 60 * 1000,
  meta: 28 * 24 * 60 * 60 * 1000,
};

const UMBRALES_DIAS = [30, 15] as const;

interface Params {
  contractsActive: Contrato[];
  paneles: Panel[];
  clientesActive: Cliente[];
  swRef: React.RefObject<ServiceWorkerRegistration | null>;
}

// ── Persistencia ────────────────────────────────────────────────
/** Devuelve el registro de notificaciones ya enviadas, limpiando las expiradas. */
function loadStored(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const now = Date.now();
    const cleaned: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const ts =
        typeof v === "number"
          ? v
          : typeof v === "object" && v !== null
            ? (((v as Record<string, unknown>).ts as number | undefined) ?? 0)
            : 0;
      if (!ts) continue;
      const prefix = k.split("_")[0] as string;
      const ttl = TTL_MS[prefix] ?? TTL_MS["cv"] ?? (90 * 24 * 60 * 60 * 1000);
      if (now - ts < ttl) cleaned[k] = ts; // aún vigente → conservar
    }
    return cleaned;
  } catch {
    return {};
  }
}

function saveStored(data: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignorar */
  }
}

// ── Hook principal ──────────────────────────────────────────────
/**
 * Envía notificaciones push nativas para cinco tipos de alertas:
 *
 *  1. Contratos por vencer        — a 30 y 15 días (⚠️ si ≤5 días)
 *  2. Facturas pendientes          — contrato activo sin marcar como pagado
 *  3. Paneles libres >30 días      — sin contrato activo durante más de un mes
 *  4. Clientes inactivos +90 días  — sin ningún contrato reciente
 *  5. Meta mensual alcanzada       — cuando los cobros del mes superan S/10,000
 *
 * Cada tipo tiene su propio TTL para no repetir mientras la
 * situación no haya cambiado. Usa showNotification() del SW
 * (vibración en Android); cae a new Notification() como fallback.
 */
export function useNotifications({ contractsActive, paneles, clientesActive, swRef }: Params) {
  useEffect(() => {
    if (!contractsActive.length || !paneles.length || !clientesActive.length) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    const hoy = new Date();
    const ahora = Date.now();
    const stored = loadStored();

    /** Envía una notificación solo si no está dentro de su TTL. */
    const push = (key: string, titulo: string, cuerpo: string, urgente = false) => {
      const prefix = key.split("_")[0] as string;
      const ttl = TTL_MS[prefix] ?? TTL_MS["cv"] ?? (90 * 24 * 60 * 60 * 1000);
      if (stored[key] !== undefined && ahora - stored[key] < ttl) return;

      try {
        const opts = {
          body: cuerpo,
          tag: key,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          requireInteraction: urgente,
          ...({ vibrate: urgente ? [300, 100, 300, 100, 300] : [200, 100, 200] } as Record<
            string,
            unknown
          >),
        };
        if (swRef.current?.showNotification) {
          swRef.current.showNotification(titulo, opts);
        } else {
          new Notification(titulo, { body: cuerpo, tag: key, icon: "/icon-192.png" });
        }
        stored[key] = ahora;
      } catch {
        /* ignorar errores de Notification API */
      }
    };

    // ── 1. Contratos por vencer ──────────────────────────────────
    contractsActive.forEach(c => {
      const diasRestantes = Math.ceil((new Date(c.fin).getTime() - hoy.getTime()) / 86_400_000);

      UMBRALES_DIAS.forEach(umbral => {
        if (diasRestantes <= 0 || diasRestantes > umbral) return;
        const panel = paneles.find(p => p.id === c.panel_id);
        const cliente = clientesActive.find(cl => cl.id === c.cliente_id);
        if (!panel || !cliente) return;

        const urgente = diasRestantes <= 5;
        const titulo = urgente
          ? `⚠️ Vence en ${diasRestantes} día${diasRestantes === 1 ? "" : "s"} — ${panel.nombre}`
          : `📅 Vence en ${diasRestantes} días — ${panel.nombre}`;
        const cuerpo = `Cliente: ${cliente.empresa} · S/ ${c.monto}/mes`;
        push(`cv_${c.id}_${umbral}`, titulo, cuerpo, urgente);
      });
    });

    // ── 2. Facturas pendientes ───────────────────────────────────
    // Contrato vigente (no vencido) y no marcado como pagado
    contractsActive
      .filter(c => !c.pagado && Number(c.monto) > 0 && new Date(c.fin) >= hoy)
      .forEach(c => {
        const cliente = clientesActive.find(cl => cl.id === c.cliente_id);
        const panel = paneles.find(p => p.id === c.panel_id);
        if (!cliente || !panel) return;
        push(
          `fp_${c.id}`,
          `💰 Factura pendiente — ${cliente.empresa}`,
          `${panel.nombre} · S/ ${c.monto} sin registrar como pagado`,
        );
      });

    // ── 3. Paneles libres más de 30 días ────────────────────────
    paneles.forEach(p => {
      // ¿Tiene algún contrato vigente?
      const tieneActivo = contractsActive.some(c => c.panel_id === p.id && new Date(c.fin) >= hoy);
      if (tieneActivo) return;

      // Fecha del último contrato de este panel (0 si nunca tuvo)
      const ultimoFin = contractsActive
        .filter(c => c.panel_id === p.id)
        .reduce((max, c) => Math.max(max, new Date(c.fin).getTime()), 0);

      const diasLibre = ultimoFin ? Math.floor((ahora - ultimoFin) / 86_400_000) : 999; // nunca tuvo contrato → siempre supera el umbral

      if (diasLibre < 30) return; // libre menos de un mes → ignorar

      const cuanto = diasLibre >= 60 ? `${Math.floor(diasLibre / 30)} meses` : "1 mes";

      push(
        `pl_${p.id}`,
        `📋 Panel libre — ${p.nombre}`,
        `Sin contrato activo hace más de ${cuanto}. Oportunidad de venta.`,
      );
    });

    // ── 4. Clientes inactivos +90 días ───────────────────────────
    clientesActive.forEach(cl => {
      const tieneReciente = contractsActive.some(
        c => c.cliente_id === cl.id && ahora - new Date(c.fin).getTime() < 90 * 24 * 60 * 60 * 1000,
      );
      if (tieneReciente) return;
      push(
        `ci_${cl.id}`,
        `👤 Cliente inactivo — ${cl.empresa}`,
        `Sin contratos en los últimos 3 meses. ¿Le ofrecemos un panel?`,
      );
    });

    // ── 5. Meta mensual alcanzada ────────────────────────────────
    const mesKey = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
    const ingresoMes = contractsActive
      .filter(c => c.pagado && String(c.inicio ?? "").startsWith(mesKey))
      .reduce((acc, c) => acc + Number(c.monto ?? 0), 0);

    if (ingresoMes >= 10_000) {
      push(
        `meta_${mesKey}`,
        `🏆 ¡Meta mensual alcanzada!`,
        `Superaste S/ ${ingresoMes.toLocaleString("es-PE")} este mes. ¡Excelente trabajo!`,
      );
    }

    saveStored(stored);
  }, [contractsActive, paneles, clientesActive, swRef]);
}
