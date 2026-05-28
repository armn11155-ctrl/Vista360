import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVirtualList } from "./useVirtualList";

const items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }));

describe("useVirtualList", () => {
  it("calcula totalHeight correctamente", () => {
    const { result } = renderHook(() =>
      useVirtualList(items, { itemHeight: 60, containerHeight: 300 }),
    );
    expect(result.current.totalHeight).toBe(100 * 60);
  });

  it("retorna solo los items visibles + overscan", () => {
    const { result } = renderHook(() =>
      useVirtualList(items, { itemHeight: 60, containerHeight: 300, overscan: 0 }),
    );
    // containerHeight / itemHeight = 300/60 = 5 items visible from top
    expect(result.current.virtualItems.length).toBeLessThanOrEqual(6);
    expect(result.current.virtualItems[0]?.index).toBe(0);
  });

  it("expone containerProps con ref y onScroll", () => {
    const { result } = renderHook(() => useVirtualList(items, { itemHeight: 60 }));
    expect(result.current.containerProps.ref).toBeDefined();
    expect(typeof result.current.containerProps.onScroll).toBe("function");
  });

  it("onScroll es estable entre renders (useCallback)", () => {
    const { result, rerender } = renderHook(() => useVirtualList(items, { itemHeight: 60 }));
    const first = result.current.containerProps.onScroll;
    rerender();
    expect(result.current.containerProps.onScroll).toBe(first);
  });

  it("calcula offsetTop de cada item correctamente", () => {
    const { result } = renderHook(() =>
      useVirtualList(items, { itemHeight: 50, containerHeight: 150, overscan: 0 }),
    );
    const vItems = result.current.virtualItems;
    vItems.forEach(v => {
      expect(v.offsetTop).toBe(v.index * 50);
    });
  });

  it("lista vacía produce totalHeight 0 y sin items virtuales", () => {
    const { result } = renderHook(() => useVirtualList([], { itemHeight: 60 }));
    expect(result.current.totalHeight).toBe(0);
    expect(result.current.virtualItems).toHaveLength(0);
  });

  it("onScroll actualiza los items virtuales al hacer scroll", () => {
    const { result } = renderHook(() =>
      useVirtualList(items, { itemHeight: 60, containerHeight: 300, overscan: 0 }),
    );
    // Simulate scroll by setting scrollTop on the ref
    const div = document.createElement("div");
    Object.defineProperty(div, "scrollTop", { value: 600, writable: true });
    (result.current.containerProps.ref as React.MutableRefObject<HTMLDivElement>).current = div;

    act(() => {
      result.current.containerProps.onScroll();
    });

    // After scrolling 600px with itemHeight 60, start index ~= 10
    const firstIndex = result.current.virtualItems[0]?.index ?? 0;
    expect(firstIndex).toBeGreaterThanOrEqual(8);
  });
});
