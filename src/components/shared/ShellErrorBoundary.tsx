import { Component } from "react";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Error boundary que envuelve AuthenticatedShell.
 * Captura errores no manejados dentro del shell autenticado y muestra
 * una pantalla de error amigable en lugar de una pantalla en blanco.
 */
export class ShellErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(e: Error): State {
    return { error: e };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#0E1A3B",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            fontFamily: "monospace",
            zIndex: 9999,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 16 }}>💥</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#FF6B6B" }}>
            Error al cargar la app
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: 16,
              fontSize: 12,
              lineHeight: 1.6,
              maxWidth: 380,
              wordBreak: "break-word",
              whiteSpace: "pre-wrap",
            }}
          >
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack?.split("\n").slice(0, 5).join("\n")}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
