/**
 * Tests de los helpers de URL de Cloudinary en firestore.ts
 * Estos helpers son críticos para la visualización de fotos de gastos.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(), getDocs: vi.fn(), addDoc: vi.fn(), updateDoc: vi.fn(),
  deleteDoc: vi.fn(), doc: vi.fn(), query: vi.fn(), orderBy: vi.fn(),
  onSnapshot: vi.fn(), serverTimestamp: vi.fn(), Timestamp: { now: vi.fn() },
}));
vi.mock("../config/firebase", () => ({ db: {} }));

const { cloudinaryThumb, cloudinaryDetail, cloudinaryPdf, cloudinaryPublicId } =
  await import("./firestore");

const BASE_URL =
  "https://res.cloudinary.com/mi-cloud/image/upload/v1234567890/vista360/boletas/factura.jpg";

describe("cloudinaryThumb", () => {
  it("inserta transformación de thumbnail en la URL", () => {
    const result = cloudinaryThumb(BASE_URL);
    expect(result).toContain("/upload/f_webp,q_auto:low,w_400,c_limit/");
    expect(result).toContain("factura.jpg");
  });

  it("no modifica URLs que no son de Cloudinary", () => {
    const external = "https://example.com/foto.jpg";
    expect(cloudinaryThumb(external)).toBe(external);
  });

  it("retorna string vacío para undefined", () => {
    expect(cloudinaryThumb(undefined)).toBe("");
  });

  it("retorna string vacío para null", () => {
    expect(cloudinaryThumb(null)).toBe("");
  });
});

describe("cloudinaryDetail", () => {
  it("inserta transformación de detalle (800px) en la URL", () => {
    const result = cloudinaryDetail(BASE_URL);
    expect(result).toContain("w_800");
    expect(result).toContain("q_auto:good");
  });
});

describe("cloudinaryPdf", () => {
  it("inserta transformación de alta resolución (1600px) para PDF", () => {
    const result = cloudinaryPdf(BASE_URL);
    expect(result).toContain("w_1600");
    expect(result).toContain("q_auto:best");
  });
});

describe("cloudinaryPublicId", () => {
  it("extrae el publicId de una URL de Cloudinary con versión", () => {
    const result = cloudinaryPublicId(BASE_URL);
    expect(result).toBe("vista360/boletas/factura");
  });

  it("extrae el publicId de una URL sin número de versión", () => {
    const url = "https://res.cloudinary.com/mi-cloud/image/upload/vista360/boletas/foto.jpg";
    expect(cloudinaryPublicId(url)).toBe("vista360/boletas/foto");
  });

  it("retorna null para URLs que no son de Cloudinary", () => {
    expect(cloudinaryPublicId("https://example.com/foto.jpg")).toBeNull();
  });

  it("retorna null para undefined", () => {
    expect(cloudinaryPublicId(undefined)).toBeNull();
  });

  it("retorna null para null", () => {
    expect(cloudinaryPublicId(null)).toBeNull();
  });
});
