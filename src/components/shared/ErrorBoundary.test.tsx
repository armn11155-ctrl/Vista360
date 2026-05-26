import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

// Componente que lanza un error al renderizar
function Bomb({ shouldThrow = false }: { shouldThrow?: boolean }) {
  if (shouldThrow) throw new Error("Explosión controlada de prueba");
  return <div>Contenido normal</div>;
}

// Silenciar console.error durante los tests de error boundary
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalError;
});

describe("ErrorBoundary", () => {
  it("renderiza children cuando no hay error", () => {
    render(
      <ErrorBoundary label="Test">
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Contenido normal")).toBeTruthy();
  });

  it("muestra panel de error cuando un hijo lanza", () => {
    render(
      <ErrorBoundary label="Gastos">
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toBeTruthy();
    expect(screen.getByText(/Error en Gastos/i)).toBeTruthy();
    // El mensaje de error aparece en el div de mensaje (no usar getByText que matchea también el stack trace)
    const msgBox = alert.querySelector("div[style*='font-family: monospace']");
    expect(msgBox?.textContent).toContain("Explosión controlada de prueba");
  });

  it("muestra el botón Reintentar", () => {
    render(
      <ErrorBoundary label="Módulo">
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Reintentar")).toBeTruthy();
  });

  it("muestra el botón Recargar app", () => {
    render(
      <ErrorBoundary label="Módulo">
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Recargar app")).toBeTruthy();
  });

  it("el botón Reintentar limpia el estado de error del boundary", () => {
    // Nota: el retry remonta los children — si el hijo sigue lanzando,
    // el boundary vuelve a capturar el error (comportamiento correcto).
    // Este test verifica que el ESTADO interno se resetea al pulsar Reintentar.
    let shouldThrow = true;

    const { rerender } = render(
      <ErrorBoundary label="Módulo">
        <Bomb shouldThrow={shouldThrow} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();

    // Cambiar la condición ANTES de hacer click en Reintentar
    // para que el hijo no lance al remontar
    shouldThrow = false;
    rerender(
      <ErrorBoundary label="Módulo">
        <Bomb shouldThrow={shouldThrow} />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByText("Reintentar"));

    // Ahora el hijo no lanza — debería renderizar normalmente
    expect(screen.getByText("Contenido normal")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("llama onError cuando se captura un error", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary label="Módulo" onError={onError}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledOnce();
    const [error] = onError.mock.calls[0] as [Error];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("Explosión");
  });

  it("informa que el resto de la app sigue funcionando", () => {
    render(
      <ErrorBoundary label="Módulo">
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/el resto de la app sigue funcionando/i)).toBeTruthy();
  });
});
