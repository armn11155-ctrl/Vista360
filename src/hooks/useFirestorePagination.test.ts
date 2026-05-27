import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFirestorePagination } from "./useFirestorePagination";

// ── Mock de firebase/firestore ────────────────────────────────────
vi.mock("../config/firebase", () => ({ db: {} }));

const mockGetDocs = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => "mock-collection"),
  query: vi.fn((...args: unknown[]) => args),
  orderBy: vi.fn(() => "mock-orderBy"),
  limit: vi.fn((n: number) => `limit(${n})`),
  startAfter: vi.fn((doc: unknown) => `startAfter(${String(doc)})`),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

/** Genera snapshots de Firestore simulados */
function makeSnap(ids: string[]) {
  const docs = ids.map(id => ({
    id,
    data: () => ({ nombre: `Item ${id}`, createdAt: null }),
  }));
  return { docs };
}

describe("useFirestorePagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carga la primera página correctamente", async () => {
    mockGetDocs.mockResolvedValueOnce(makeSnap(["a", "b", "c"]));

    const { result } = renderHook(() => useFirestorePagination("paneles", 10));

    expect(result.current.loading).toBe(false);
    expect(result.current.items).toHaveLength(0);

    await act(async () => {
      await result.current.loadFirst();
    });

    expect(result.current.items).toHaveLength(3);
    expect(result.current.items[0]?.id).toBe("a");
    expect(result.current.page).toBe(1);
  });

  it("detecta que hay más páginas cuando el resultado supera pageSize", async () => {
    // pageSize=2, devuelve 3 docs → hay siguiente página
    mockGetDocs.mockResolvedValueOnce(makeSnap(["a", "b", "c"]));

    const { result } = renderHook(() => useFirestorePagination("paneles", 2));

    await act(async () => {
      await result.current.loadFirst();
    });

    expect(result.current.items).toHaveLength(2); // solo los 2 primeros
    expect(result.current.hasMore).toBe(true);
  });

  it("marca hasMore=false cuando no hay más páginas", async () => {
    mockGetDocs.mockResolvedValueOnce(makeSnap(["a", "b"]));

    const { result } = renderHook(() => useFirestorePagination("paneles", 10));

    await act(async () => {
      await result.current.loadFirst();
    });

    expect(result.current.hasMore).toBe(false);
  });

  it("captura errores correctamente", async () => {
    mockGetDocs.mockRejectedValueOnce(new Error("Firestore error"));

    const { result } = renderHook(() => useFirestorePagination("paneles", 10));

    await act(async () => {
      await result.current.loadFirst();
    });

    expect(result.current.error).toContain("Firestore error");
    expect(result.current.items).toHaveLength(0);
  });

  it("loadMore acumula los items de múltiples páginas", async () => {
    // Página 1: 3 items (pageSize=2 → hasMore=true)
    mockGetDocs
      .mockResolvedValueOnce(makeSnap(["a", "b", "c"]))
      // Página 2: 2 items (hasMore=false)
      .mockResolvedValueOnce(makeSnap(["d", "e"]));

    const { result } = renderHook(() => useFirestorePagination("paneles", 2));

    await act(async () => {
      await result.current.loadFirst();
    });
    expect(result.current.items).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.items).toHaveLength(4); // a, b + d, e
    expect(result.current.hasMore).toBe(false);
    expect(result.current.page).toBe(2);
  });

  it("no carga más cuando hasMore=false", async () => {
    mockGetDocs.mockResolvedValueOnce(makeSnap(["a"]));

    const { result } = renderHook(() => useFirestorePagination("paneles", 10));

    await act(async () => {
      await result.current.loadFirst();
    });

    await act(async () => {
      await result.current.loadMore(); // no debería hacer nada
    });

    // getDocs solo se llamó una vez (loadFirst)
    expect(mockGetDocs).toHaveBeenCalledTimes(1);
  });
});
