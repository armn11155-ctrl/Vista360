/**
 * Tests del cliente Firestore (fb.*).
 * Firebase se mockea completamente — sin conexión real a Firestore.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock de Firebase ───────────────────────────────────────────────
const mockAddDoc  = vi.fn();
const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockOnSnapshot = vi.fn();
const mockQuery = vi.fn((...args: unknown[]) => args);
const mockOrderBy = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockServerTimestamp = vi.fn(() => ({ _type: "serverTimestamp" }));
const MockTimestamp = { now: vi.fn(() => ({ seconds: 0, nanoseconds: 0 })) };

vi.mock("firebase/firestore", () => ({
  collection:      mockCollection,
  getDocs:         mockGetDocs,
  addDoc:          mockAddDoc,
  updateDoc:       mockUpdateDoc,
  deleteDoc:       mockDeleteDoc,
  doc:             mockDoc,
  orderBy:         mockOrderBy,
  query:           mockQuery,
  serverTimestamp: mockServerTimestamp,
  onSnapshot:      mockOnSnapshot,
  Timestamp:       MockTimestamp,
}));

vi.mock("../config/firebase", () => ({ db: {} }));

// ── Importar después de los mocks ──────────────────────────────────
const { fb } = await import("./firestore");

// ── Helper: snapshot fake ─────────────────────────────────────────
function makeSnap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return { docs: docs.map(d => ({ id: d.id, data: () => d.data })) };
}

// ── Tests ─────────────────────────────────────────────────────────

describe("fb.get", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna documentos de Firestore mapeados con id", async () => {
    mockGetDocs.mockResolvedValue(makeSnap([
      { id: "p1", data: { nombre: "Panel Centro" } },
    ]));
    const result = await fb.get("paneles");
    expect(result).toEqual([{ id: "p1", nombre: "Panel Centro" }]);
  });

  it("retorna array vacío si Firestore lanza error", async () => {
    mockGetDocs.mockRejectedValue(new Error("Firestore error"));
    const result = await fb.get("paneles");
    expect(result).toEqual([]);
  });
});

describe("fb.post", () => {
  beforeEach(() => vi.clearAllMocks());

  it("crea documento y retorna objeto con id generado", async () => {
    mockAddDoc.mockResolvedValue({ id: "new-id" });
    const result = await fb.post("clientes", { empresa: "Acme S.A." });
    expect(result).toMatchObject({ id: "new-id", empresa: "Acme S.A." });
    expect(mockAddDoc).toHaveBeenCalledOnce();
  });

  it("incluye createdAt en el resultado", async () => {
    mockAddDoc.mockResolvedValue({ id: "abc" });
    const result = await fb.post("clientes", { empresa: "Test" });
    expect(result).toHaveProperty("createdAt");
  });
});

describe("fb.patch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("actualiza el documento y retorna objeto con id", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    const result = await fb.patch("paneles", "p1", { estado: "Ocupado" });
    expect(result).toMatchObject({ id: "p1", estado: "Ocupado" });
    expect(mockUpdateDoc).toHaveBeenCalledOnce();
  });
});

describe("fb.del (soft delete)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("llama updateDoc con deleted:true por defecto", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await fb.del("paneles", "p1");
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ deleted: true }),
    );
  });

  it("llama deleteDoc cuando hardDelete es true", async () => {
    mockDeleteDoc.mockResolvedValue(undefined);
    await fb.del("paneles", "p1", { hardDelete: true });
    expect(mockDeleteDoc).toHaveBeenCalledOnce();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});

describe("fb.subscribe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invoca onData con los documentos del snapshot", () => {
    const snap = makeSnap([{ id: "c1", data: { empresa: "OOH Corp" } }]);
    mockOnSnapshot.mockImplementation((_q: unknown, cb: (s: typeof snap) => void) => {
      cb(snap);
      return () => {};
    });
    const onData = vi.fn();
    fb.subscribe("clientes", onData);
    expect(onData).toHaveBeenCalledWith([{ id: "c1", empresa: "OOH Corp" }]);
  });

  it("retorna función de unsubscribe", () => {
    const unsub = vi.fn();
    mockOnSnapshot.mockReturnValue(unsub);
    const result = fb.subscribe("clientes", vi.fn());
    result();
    expect(unsub).toHaveBeenCalledOnce();
  });
});
