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
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/Error en Gastos/i)).toBeTruthy();
    expect(screen.getByText(/Explosión controlada de prueba/i)).toBeTruthy();
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

  it("el botón Reintentar recupera el renderizado normal si el error se resolvió", () => {
    // Renderiza con error
    const { rerender } = render(
      <ErrorBoundary label="Módulo">
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();

    // El usuario corrige la condición y pulsa Reintentar
    // (simulamos el retry que desmonta/remonta los children)
    fireEvent.click(screen.getByText("Reintentar"));

    // Después del retry, rerender con prop fixed
    rerender(
      <ErrorBoundary label="Módulo">
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
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
