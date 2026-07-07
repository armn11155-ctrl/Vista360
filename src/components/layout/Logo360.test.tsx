import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Logo360 } from "./Logo360";

describe("Logo360", () => {
  it("renderiza la imagen del logo", () => {
    const { container } = render(<Logo360 />);
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.alt).toBe("Vista360");
  });

  it("usa el ancho por defecto de 200", () => {
    const { container } = render(<Logo360 />);
    expect(container.querySelector("img")?.width).toBe(200);
  });

  it("acepta un ancho personalizado", () => {
    const { container } = render(<Logo360 width={120} />);
    expect(container.querySelector("img")?.width).toBe(120);
  });
});
