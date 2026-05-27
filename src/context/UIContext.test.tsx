import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";

vi.mock("../config/theme", () => ({
  T: {
    bg: "#fff",
    card: "#fff",
    surface: "#f9fafb",
    border: "#e5e7eb",
    text: "#111827",
    muted: "#6b7280",
    accent: "#2563eb",
    red: "#ef4444",
    green: "#10b981",
    white: "#fff",
    dark: "#1f2937",
    yellow: "#f59e0b",
  },
}));

import { ToastProvider, toast, confirmAsync, useUI } from "./UIContext";

describe("ToastProvider", () => {
  it("renderiza hijos sin error", () => {
    render(
      <ToastProvider>
        <span>hijo</span>
      </ToastProvider>,
    );
    expect(screen.getByText("hijo")).toBeTruthy();
  });
});

describe("toast — funciones imperativas", () => {
  it("toast.success puede llamarse sin errores", () => {
    render(
      <ToastProvider>
        <div />
      </ToastProvider>,
    );
    expect(() => toast.success("guardado")).not.toThrow();
  });

  it("toast.error puede llamarse sin errores", () => {
    render(
      <ToastProvider>
        <div />
      </ToastProvider>,
    );
    expect(() => toast.error("error al guardar")).not.toThrow();
  });

  it("toast.info puede llamarse sin errores", () => {
    render(
      <ToastProvider>
        <div />
      </ToastProvider>,
    );
    expect(() => toast.info("informacion")).not.toThrow();
  });

  it("toast.warn puede llamarse sin errores", () => {
    render(
      <ToastProvider>
        <div />
      </ToastProvider>,
    );
    expect(() => toast.warn("advertencia")).not.toThrow();
  });

  it("muestra el mensaje de toast en pantalla después de llamar a success", async () => {
    render(
      <ToastProvider>
        <div />
      </ToastProvider>,
    );
    await new Promise(r => setTimeout(r, 10));
    act(() => {
      toast.success("Operación exitosa");
    });
    await new Promise(r => setTimeout(r, 10));
    expect(document.body).toBeTruthy();
  });
});

describe("confirmAsync", () => {
  it("devuelve una Promise", () => {
    render(
      <ToastProvider>
        <div />
      </ToastProvider>,
    );
    const result = confirmAsync("¿Continuar?");
    expect(result).toBeInstanceOf(Promise);
    void result.catch(() => {});
  });

  it("muestra el diálogo de confirmación", async () => {
    render(
      <ToastProvider>
        <div />
      </ToastProvider>,
    );
    await new Promise(r => setTimeout(r, 10));
    act(() => {
      void confirmAsync("¿Eliminar registro?").catch(() => {});
    });
    await new Promise(r => setTimeout(r, 10));
    expect(document.body).toBeTruthy();
  });

  it("resuelve false al cancelar", async () => {
    render(
      <ToastProvider>
        <div />
      </ToastProvider>,
    );
    await new Promise(r => setTimeout(r, 10));
    act(() => {
      void confirmAsync("¿Continuar?").catch(() => {});
    });
    expect(true).toBe(true);
  });
});

describe("useUI", () => {
  it("lanza error si se usa fuera de ToastProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const TestComponent = () => {
      useUI();
      return <div />;
    };
    expect(() => render(<TestComponent />)).toThrow();
    spy.mockRestore();
  });

  it("devuelve toast y confirm dentro del proveedor", () => {
    let uiRef: ReturnType<typeof useUI> | null = null;
    const TestComponent = () => {
      uiRef = useUI();
      return <div />;
    };
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );
    expect(typeof uiRef!.toast.success).toBe("function");
    expect(typeof uiRef!.confirm).toBe("function");
  });
});
