import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../config/theme", () => ({
  T: { bg:"#fff",card:"#fff",surface:"#f9fafb",border:"#e5e7eb",text:"#111",
       muted:"#6b7280",accent:"#2563eb",white:"#fff" },
}));
vi.mock("../../config/constants", () => ({
  NAV_TAB_IDS: ["paneles","contratos","gastos"],
  BOTTOM_TABS_LIST: [],
  CIUDADES:[], CAT_GASTOS:[], CAT_PROVE:[], SECTORES:[],
  ESTADOS_CLI:[], ESTADOS_PRO:[], EMOJIS:[], EMISOR:{}, ALLOWED_EMAILS:[],
}));

import { BottomTabBar } from "./BottomTabBar";

const tabs = [
  { id: "paneles", label: "Paneles" },
  { id: "contratos", label: "Contratos" },
];
const icons = { paneles: <span>P</span>, contratos: <span>C</span> };
const props = { tabs, icons, showProfile: false, onTabClick: vi.fn(), onAddClick: vi.fn() };

describe("BottomTabBar", () => {
  it("renderiza sin errores", () => {
    expect(() =>
      render(<MemoryRouter><BottomTabBar {...props} /></MemoryRouter>)
    ).not.toThrow();
  });

  it("muestra las pestañas", () => {
    const { getByText } = render(<MemoryRouter><BottomTabBar {...props} /></MemoryRouter>);
    expect(getByText("Paneles")).toBeTruthy();
    expect(getByText("Contratos")).toBeTruthy();
  });

  it("llama a onTabClick al hacer click en una pestaña", () => {
    const onTabClick = vi.fn();
    const { getByText } = render(
      <MemoryRouter><BottomTabBar {...props} onTabClick={onTabClick} /></MemoryRouter>
    );
    fireEvent.click(getByText("Paneles"));
    expect(onTabClick).toHaveBeenCalled();
  });
});
