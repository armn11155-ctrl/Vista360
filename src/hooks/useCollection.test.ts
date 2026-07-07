import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Mocks ─────────────────────────────────────────────────────────
const mockSubscribe = vi.fn();
const mockGet = vi.fn();

vi.mock("../services/firestore", () => ({
  fb: { subscribe: mockSubscribe, get: mockGet },
}));

const { useCollection } = await import("./useCollection");

describe("useCollection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("comienza en estado loading=true", () => {
    mockSubscribe.mockReturnValue(() => {});
    const { result } = renderHook(() => useCollection("paneles"));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("actualiza data cuando onSnapshot emite documentos", async () => {
    type Item = { id: string; nombre: string };
    const items: Item[] = [{ id: "p1", nombre: "Panel" }];
    mockSubscribe.mockImplementation((_col: unknown, onData: (data: Item[]) => void) => {
      onData(items);
      return () => {};
    });

    const { result } = renderHook(() => useCollection("paneles"));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(items);
    expect(result.current.error).toBeNull();
  });

  it("establece error cuando Firestore lanza", async () => {
    mockSubscribe.mockImplementation(
      (_col: unknown, _onData: unknown, onErr: (e: Error) => void) => {
        onErr(new Error("Permission denied"));
        return () => {};
      },
    );

    const { result } = renderHook(() => useCollection("paneles"));
    expect(result.current.error).toContain("Permission denied");
    expect(result.current.loading).toBe(false);
  });

  it("llama al unsubscribe al desmontar el hook", () => {
    const unsub = vi.fn();
    mockSubscribe.mockReturnValue(unsub);

    const { unmount } = renderHook(() => useCollection("paneles"));
    unmount();
    expect(unsub).toHaveBeenCalledOnce();
  });

  it("refetch llama fb.get y actualiza data", async () => {
    mockSubscribe.mockReturnValue(() => {});
    const newItems = [{ id: "p2", nombre: "Panel 2" }];
    mockGet.mockResolvedValue(newItems);

    const { result } = renderHook(() => useCollection("paneles"));
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data).toEqual(newItems);
  });
});
