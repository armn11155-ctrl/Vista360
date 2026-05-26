import React, { Component } from "react";
import { T } from "../../config/theme";

interface State {
  hasError: boolean;
  msg: string;
  stack: string;
  retryCount: number;
}

interface Props {
  label: string;
  children: React.ReactNode;
  /** Callback opcional para reportar errores a un servicio externo */
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

/**
 * Error boundary por módulo.
 *
 * Uso:
 *   <ErrorBoundary label="Gastos">
 *     <Gastos ... />
 *   </ErrorBoundary>
 *
 * Características:
 *  - Muestra un panel de error aislado sin romper el resto de la app
 *  - Botón "Reintentar" que desmonta y remonta el árbol hijo
 *  - Registra en consola el stack trace completo para debugging
 *  - Acepta onError para integrar con Sentry u otro servicio de monitoreo
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, msg: "", stack: "", retryCount: 0 };

  static getDerivedStateFromError(e: Error): Partial<State> {
    return { hasError: true, msg: e.message, stack: e.stack ?? "" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log estructurado para debugging
    console.error(
      `[ErrorBoundary:${this.props.label}]`,
      error.message,
      "\n--- Component stack ---\n",
      info.componentStack,
      "\n--- Error stack ---\n",
      error.stack,
    );
    this.props.onError?.(error, info);
  }

  private retry = () => {
    this.setState(prev => ({
      hasError: false,
      msg: "",
      stack: "",
      retryCount: prev.retryCount + 1,
    }));
  };

  render() {
    if (!this.state.hasError) {
      // key={retryCount} fuerza un remount completo del árbol al reintentar
      return (
        <React.Fragment key={this.state.retryCount}>
          {this.props.children}
        </React.Fragment>
      );
    }

    return (
      <div
        role="alert"
        style={{
          margin: 16,
          padding: "20px 18px",
          borderRadius: 16,
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.2)",
        }}
      >
        {/* Encabezado */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(239,68,68,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke={T.red} strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.red }}>
              Error en {this.props.label}
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
              El resto de la app sigue funcionando
            </div>
          </div>
        </div>

        {/* Mensaje de error */}
        <div
          style={{
            background: "rgba(239,68,68,0.04)",
            border: "1px solid rgba(239,68,68,0.12)",
            borderRadius: 9,
            padding: "9px 12px",
            fontSize: 11.5,
            color: "#7F1D1D",
            fontFamily: "monospace",
            marginBottom: 14,
            wordBreak: "break-word",
          }}
        >
          {this.state.msg || "Error desconocido"}
        </div>

        {/* Acciones */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={this.retry}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 9,
              border: "none",
              background: T.red,
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
            </svg>
            Reintentar
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 16px",
              borderRadius: 9,
              border: "1px solid rgba(239,68,68,0.25)",
              background: "transparent",
              color: T.red,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Recargar app
          </button>
        </div>

        {/* Stack trace (solo en desarrollo) */}
        {import.meta.env.DEV && this.state.stack && (
          <details style={{ marginTop: 12 }}>
            <summary style={{ fontSize: 10.5, color: T.muted, cursor: "pointer" }}>
              Stack trace (solo visible en desarrollo)
            </summary>
            <pre
              style={{
                marginTop: 8,
                padding: "8px 10px",
                borderRadius: 8,
                background: "#FEF2F2",
                fontSize: 9.5,
                color: "#991B1B",
                overflow: "auto",
                maxHeight: 200,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {this.state.stack}
            </pre>
          </details>
        )}
      </div>
    );
  }
}
