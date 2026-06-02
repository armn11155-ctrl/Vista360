import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PanelCard } from "./PanelCard";
import type { Panel } from "../../../types";

vi.mock("../../../config/theme", () => ({
  T: {
    green: "#10B981",
    red: "#EF4444",
    accent: "#2563EB",
    muted: "#6B7280",
    white: "#fff",
    text: "#111827",
    border: "#E5E7EB",
    surface: "#F9FAFB",
    card: "#fff",
    bg: "#fff",
  },
}));

const mockPanel: Panel = {
  id: "panel-001",
  nombre: "Panel Norte Lima",
  tipo: "LED",
  ciudad: "Lima",
  estado: "Libre",
  foto: "🖥",
  direccion: "Av. Javier Prado Este 123",
};

describe("PanelCard", () => {
  it("muestra el nombre del panel", () => {
    render(
      <PanelCard
        panel={mockPanel}
        carasOcupadas={{ A: false, B: false }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Panel Norte Lima")).toBeTruthy();
  });

  it("muestra la ciudad del panel", () => {
    render(
      <PanelCard
        panel={mockPanel}
        carasOcupadas={{ A: false, B: false }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Lima")).toBeTruthy();
  });

  it("muestra el tipo del panel", () => {
    render(
      <PanelCard
        panel={mockPanel}
        carasOcupadas={{ A: false, B: false }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("LED")).toBeTruthy();
  });

  it("muestra 'Libre' cuando no está ocupado", () => {
    render(
      <PanelCard
        panel={mockPanel}
        carasOcupadas={{ A: false, B: false }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Libre")).toBeTruthy();
  });

  it("muestra 'Ocupado' cuando está ocupado", () => {
    render(
      <PanelCard
        panel={mockPanel}
        carasOcupadas={{ A: true, B: false }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Ocupado")).toBeTruthy();
  });

  it("llama a onEdit cuando se hace clic en Editar", () => {
    const onEdit = vi.fn();
    render(
      <PanelCard
        panel={mockPanel}
        carasOcupadas={{ A: false, B: false }}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Editar"));
    expect(onEdit).toHaveBeenCalledWith(mockPanel);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("llama a onDelete con el id correcto al eliminar", () => {
    const onDelete = vi.fn();
    render(
      <PanelCard
        panel={mockPanel}
        carasOcupadas={{ A: false, B: false }}
        onEdit={vi.fn()}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByLabelText(/eliminar panel norte lima/i));
    expect(onDelete).toHaveBeenCalledWith("panel-001");
  });

  it("muestra la dirección cuando está disponible", () => {
    render(
      <PanelCard
        panel={mockPanel}
        carasOcupadas={{ A: false, B: false }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Av. Javier Prado Este 123")).toBeTruthy();
  });

  it("no muestra la dirección cuando no está definida", () => {
    const { direccion: _d, ...panelSinDireccion } = mockPanel;
    render(
      <PanelCard
        panel={panelSinDireccion}
        carasOcupadas={{ A: false, B: false }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByText("Av. Javier Prado Este 123")).toBeNull();
  });
});
