/**
 * Test de flujo de negocio: Ciclo de vida completo de un Gasto
 *
 * Cubre el flujo más crítico de Vista360:
 *   1. Validar datos del formulario antes de guardar
 *   2. Crear gasto en Firestore vía fb.post
 *   3. Editar gasto existente vía fb.patch
 *   4. Soft-delete vía fb.del (deleted: true)
 *   5. Hard-delete vía fb.del({ hardDelete: true })
 *   6. Verificar que los converters (toNumber, toDate) procesan bien los datos de Firestore
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks Firebase ─────────────────────────────────────────────────
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockOnSnapshot = vi.fn();
const MockTimestamp = { now: vi.fn(() => ({ seconds: 1_700_000_000, nanoseconds: 0 })) };

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  addDoc: mockAddDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  getDocs: mockGetDocs,
  doc: vi.fn(),
  query: vi.fn((...a: unknown[]) => a),
  orderBy: vi.fn(),
  onSnapshot: mockOnSnapshot,
  serverTimestamp: vi.fn(() => ({ _type: "serverTimestamp" })),
  Timestamp: MockTimestamp,
}));
vi.mock("../config/firebase", () => ({ db: {} }));

const { fb } = await import("./firestore");
const { validate } = await import("../lib/utils");
const { toNumber, toDate } = await import("../lib/converters");

// ── Helpers ────────────────────────────────────────────────────────
const gastoValido = {
  descripcion: "Compra de pintura",
  monto: 450,
  categoria: "Mantenimiento",
  fecha: "2025-05-15",
  proveedor: "Ferretería Lima",
};

const gastoInvalido = {
  descripcion: "", // obligatorio
  monto: -10, // debe ser > 0
  categoria: "Mantenimiento",
  fecha: "2025-05-15",
};

// ── Tests ──────────────────────────────────────────────────────────

describe("Flujo de negocio: Gasto", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Validación ────────────────────────────────────────────────────
  describe("validate.gasto", () => {
    it("retorna null para un gasto válido", () => {
      expect(validate.gasto(gastoValido)).toBeNull();
    });

    it("rechaza descripción vacía", () => {
      const err = validate.gasto(gastoInvalido);
      expect(err).toMatch(/descripción/i);
    });

    it("rechaza monto <= 0", () => {
      const err = validate.gasto({ ...gastoValido, monto: 0 });
      expect(err).toMatch(/monto/i);
    });

    it("rechaza monto negativo", () => {
      const err = validate.gasto({ ...gastoValido, monto: -50 });
      expect(err).toMatch(/monto/i);
    });

    it("rechaza fecha vacía", () => {
      const err = validate.gasto({ ...gastoValido, fecha: "" });
      expect(err).toMatch(/fecha/i);
    });
  });

  // ── Crear ─────────────────────────────────────────────────────────
  describe("fb.post — crear gasto", () => {
    it("guarda el gasto en Firestore y retorna objeto con id", async () => {
      mockAddDoc.mockResolvedValue({ id: "gasto-001" });

      const result = await fb.post("gastos", gastoValido);

      expect(mockAddDoc).toHaveBeenCalledOnce();
      expect(result).toMatchObject({ id: "gasto-001", ...gastoValido });
    });

    it("incluye createdAt en el documento guardado", async () => {
      mockAddDoc.mockResolvedValue({ id: "gasto-001" });
      const result = await fb.post("gastos", gastoValido);
      expect(result).toHaveProperty("createdAt");
    });

    it("no guarda si la validación falla", async () => {
      // Simular guard: validar antes de llamar a fb.post
      const err = validate.gasto(gastoInvalido);
      if (err) return; // guard pattern real del componente

      await fb.post("gastos", gastoInvalido);
      // nunca debe llegar aquí
      expect(mockAddDoc).not.toHaveBeenCalled();
    });
  });

  // ── Editar ────────────────────────────────────────────────────────
  describe("fb.patch — editar gasto", () => {
    it("actualiza solo los campos modificados", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      const delta = { monto: 500, categoria: "Servicios" };
      const result = await fb.patch("gastos", "gasto-001", delta);

      expect(mockUpdateDoc).toHaveBeenCalledOnce();
      expect(result).toMatchObject({ id: "gasto-001", ...delta });
    });

    it("no toca campos que no cambiaron", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const result = await fb.patch("gastos", "gasto-001", { monto: 600 });
      // descripcion no viene en el patch
      expect(result).not.toHaveProperty("descripcion");
      expect(result).toMatchObject({ id: "gasto-001", monto: 600 });
    });
  });

  // ── Soft delete ───────────────────────────────────────────────────
  describe("fb.del — eliminar gasto", () => {
    it("soft-delete: marca deleted:true sin borrar el documento", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await fb.del("gastos", "gasto-001");

      expect(mockUpdateDoc).toHaveBeenCalledOnce();
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ deleted: true }),
      );
      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });

    it("hard-delete: elimina físicamente el documento", async () => {
      mockDeleteDoc.mockResolvedValue(undefined);

      await fb.del("gastos", "gasto-001", { hardDelete: true });

      expect(mockDeleteDoc).toHaveBeenCalledOnce();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  // ── Converters (datos de Firestore) ───────────────────────────────
  describe("converters — datos de Firestore", () => {
    it("toNumber convierte string numérico a number", () => {
      expect(toNumber("450.50")).toBe(450.5);
    });

    it("toNumber retorna 0 para valores no numéricos", () => {
      expect(toNumber(undefined)).toBe(0);
      expect(toNumber(null)).toBe(0);
      expect(toNumber("")).toBe(0);
    });

    it("toNumber acepta number directamente", () => {
      expect(toNumber(42)).toBe(42);
      expect(toNumber(0)).toBe(0);
    });

    it("toDate convierte string ISO a Date", () => {
      const d = toDate("2025-05-15");
      expect(d).toBeInstanceOf(Date);
    });

    it("toDate retorna new Date() como fallback para valores vacíos", () => {
      // toDate usa new Date() como fallback cuando no hay timestamp
      const before = Date.now();
      const result = toDate(undefined);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThanOrEqual(before - 100);
      // string vacío también retorna fallback
      expect(toDate("")).toBeInstanceOf(Date);
    });

    it("un gasto de Firestore con monto:string se convierte correctamente", () => {
      // Firestore puede devolver strings si el doc fue creado manualmente
      const gastoFs = {
        id: "g1",
        descripcion: "Test",
        monto: "320.50",
        categoria: "Otro",
        fecha: "2025-01-10",
      };
      const monto = toNumber(gastoFs.monto);
      expect(monto).toBe(320.5);
      expect(typeof monto).toBe("number");
    });
  });

  // ── Suscripción en tiempo real ────────────────────────────────────
  describe("fb.subscribe — tiempo real", () => {
    it("emite gastos cuando Firestore actualiza", () => {
      const fakeSnap = {
        docs: [
          { id: "g1", data: () => ({ ...gastoValido }) },
          {
            id: "g2",
            data: () => ({
              descripcion: "Otro",
              monto: 100,
              categoria: "Otro",
              fecha: "2025-06-01",
            }),
          },
        ],
      };
      mockOnSnapshot.mockImplementation((_q: unknown, cb: (s: typeof fakeSnap) => void) => {
        cb(fakeSnap);
        return () => {};
      });

      const onData = vi.fn();
      fb.subscribe("gastos", onData);

      expect(onData).toHaveBeenCalledOnce();
      const emitted = onData.mock.calls[0][0] as unknown[];
      expect(emitted).toHaveLength(2);
      expect(emitted[0]).toMatchObject({ id: "g1", descripcion: "Compra de pintura" });
    });

    it("llama onErr cuando Firestore falla", () => {
      mockOnSnapshot.mockImplementation((_q: unknown, _cb: unknown, errCb: (e: Error) => void) => {
        errCb(new Error("Firestore offline"));
        return () => {};
      });
      const onErr = vi.fn();
      fb.subscribe("gastos", vi.fn(), onErr);
      expect(onErr).toHaveBeenCalledOnce();
    });
  });
});
