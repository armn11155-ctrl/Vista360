import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("../config/theme", () => ({
  T: { bg:"#0F172A",card:"#1E293B",text:"#F1F5F9",white:"#fff",accent:"#3B82F6" },
}));
vi.mock("../components/layout/Logo360", () => ({
  Logo360: () => <img alt="Vista360" />,
}));

import Splash from "./Splash";

describe("Splash", () => {
  it("renderiza sin errores", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    expect(() => render(<Splash done={done} />)).not.toThrow();
    vi.useRealTimers();
  });

  it("muestra el logo", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    const { container } = render(<Splash done={done} />);
    expect(container.querySelector("img")).toBeTruthy();
    vi.useRealTimers();
  });
});
