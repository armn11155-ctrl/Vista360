// @ts-nocheck — legacy file: migrating to strict TypeScript gradually
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { T } from "../config/theme";

interface ToastEntry {
  id: number;
  type: "success" | "error" | "info" | "warn";
  msg: string;
}
interface ConfirmPayload {
  msg: string;
  opts: { title?: string; ok?: string; cancel?: string; danger?: boolean };
  resolve: (value: boolean) => void;
}
interface UIContextValue {
  toast: typeof toast;
  confirm: typeof confirmAsync;
}

const UIContext = createContext<UIContextValue | null>(null);

export const useUI = (): UIContextValue => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI debe usarse dentro de <ToastProvider>");
  return ctx;
};

// Puente imperativo — permite usar toast/confirm fuera del árbol React
const _uiRef: {
  addToast: ((type: ToastEntry["type"], msg: string) => void) | null;
  showConfirm: ((payload: ConfirmPayload) => void) | null;
} = { addToast: null, showConfirm: null };

export const toast = {
  success: (msg: string) => _uiRef.addToast?.("success", msg),
  error: (msg: string) => _uiRef.addToast?.("error", msg),
  info: (msg: string) => _uiRef.addToast?.("info", msg),
  warn: (msg: string) => _uiRef.addToast?.("warn", msg),
};

export const confirmAsync = (msg: string, opts: ConfirmPayload["opts"] = {}) =>
  new Promise<boolean>(resolve => _uiRef.showConfirm?.({ msg, opts, resolve }));

let _toastSeq = 0;

export function ToastProvider({ children }: { children?: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [confirm, setConfirm] = useState<ConfirmPayload | null>(null);

  const addToast = useCallback((type: ToastEntry["type"], msg: string) => {
    const id = ++_toastSeq;
    setToasts(t => [...t, { id, type, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3800);
  }, []);

  const showConfirm = useCallback((payload: ConfirmPayload) => setConfirm(payload), []);

  useEffect(() => {
    _uiRef.addToast = addToast;
    _uiRef.showConfirm = showConfirm;
    return () => {
      _uiRef.addToast = null;
      _uiRef.showConfirm = null;
    };
  }, [addToast, showConfirm]);

  const ctxValue = useMemo<UIContextValue>(() => ({ toast, confirm: confirmAsync }), []);

  const ICONS = {
    success: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    error: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
    info: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    warn: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  };
  const COLORS = {
    success: { bg: "#0F172A", border: T.green, icon: T.green },
    error: { bg: "#0F172A", border: T.red, icon: T.red },
    info: { bg: "#0F172A", border: "#3B82F6", icon: "#3B82F6" },
    warn: { bg: "#0F172A", border: T.amber, icon: T.amber },
  };

  return (
    <UIContext.Provider value={ctxValue}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        aria-label="Notificaciones"
        style={{
          position: "fixed",
          bottom: "calc(90px + env(safe-area-inset-bottom))",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "center",
          pointerEvents: "none",
          width: "min(340px,92vw)",
        }}
      >
        {toasts.map(({ id, type, msg }) => {
          const c = COLORS[type];
          return (
            <div
              key={id}
              style={{
                background: c.bg,
                border: `1px solid ${c.border}44`,
                borderLeft: `3px solid ${c.border}`,
                borderRadius: 14,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                animation: "fadeUp .2s ease",
                pointerEvents: "auto",
                width: "100%",
              }}
            >
              <span style={{ color: c.icon, flexShrink: 0 }}>{ICONS[type]}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", lineHeight: 1.4 }}>
                {msg}
              </span>
            </div>
          );
        })}
      </div>
      {confirm && (
        <div
          role="presentation"
          onKeyDown={e => {
            if (e.key === "Escape") {
              confirm.resolve(false);
              setConfirm(null);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 9998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-desc"
            style={{
              background: "#fff",
              borderRadius: 22,
              padding: "28px 24px",
              width: "100%",
              maxWidth: 320,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <div
              id="confirm-title"
              style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 8 }}
            >
              {confirm.opts?.title || "Confirmar"}
            </div>
            <div
              id="confirm-desc"
              style={{ fontSize: 13, color: T.muted, marginBottom: 24, lineHeight: 1.5 }}
            >
              {confirm.msg}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                autoFocus
                onClick={() => {
                  confirm.resolve(false);
                  setConfirm(null);
                }}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "transparent",
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  color: T.muted,
                  fontFamily: "inherit",
                }}
              >
                {confirm.opts?.cancel || "Cancelar"}
              </button>
              <button
                onClick={() => {
                  confirm.resolve(true);
                  setConfirm(null);
                }}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: confirm.opts?.danger ? T.red : "#0F172A",
                  border: "none",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  color: "#fff",
                  fontFamily: "inherit",
                }}
              >
                {confirm.opts?.ok || "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
}
