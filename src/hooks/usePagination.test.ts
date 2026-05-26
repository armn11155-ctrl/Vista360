import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { usePagination } = await import("./usePagination");

const makeItems = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i + 1), name: `Item ${i + 1}` }));

describe("usePagination", () => {
  it("devuelve la primera página por defecto", () => {
    const items = makeItems(25);
    const { result } = renderHook(() => usePagination(items, 10));
    expect(result.current.page).toBe(1);
    expect(result.current.pageItems).toHaveLength(10);
    expect(result.current.pageItems[0]).toEqual({ id: "1", name: "Item 1" });
  });

  it("calcula el total de páginas correctamente", () => {
    const { result } = renderHook(() => usePagination(makeItems(25), 10));
    expect(result.current.totalPages).toBe(3);
  });

  it("totalPages es 1 cuando hay menos items que pageSize", () => {
    const { result } = renderHook(() => usePagination(makeItems(5), 10));
    expect(result.current.totalPages).toBe(1);
  });

  it("totalPages es 1 cuando no hay items", () => {
    const { result } = renderHook(() => usePagination([], 10));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.pageItems).toHaveLength(0);
  });

  it("next() avanza a la siguiente página", () => {
    const { result } = renderHook(() => usePagination(makeItems(25), 10));
    act(() => result.current.next());
    expect(result.current.page).toBe(2);
    expect(result.current.pageItems[0]).toEqual({ id: "11", name: "Item 11" });
  });

  it("prev() retrocede a la página anterior", () => {
    const { result } = renderHook(() => usePagination(makeItems(25), 10));
    act(() => result.current.next());
    act(() => result.current.prev());
    expect(result.current.page).toBe(1);
  });

  it("no pasa de la última página con next()", () => {
    const { result } = renderHook(() => usePagination(makeItems(10), 10));
    act(() => result.current.next());
    expect(result.current.page).toBe(1);
  });

  it("no baja de la primera página con prev()", () => {
    const { result } = renderHook(() => usePagination(makeItems(10), 10));
    act(() => result.current.prev());
    expect(result.current.page).toBe(1);
  });

  it("la última página puede tener menos items", () => {
    const { result } = renderHook(() => usePagination(makeItems(25), 10));
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.page).toBe(3);
    expect(result.current.pageItems).toHaveLength(5);
  });

  it("vuelve a página 1 cuando cambian los items", () => {
    const { result, rerender } = renderHook(
      ({ items }: { items: { id: string; name: string }[] }) => usePagination(items, 10),
      { initialProps: { items: makeItems(25) } },
    );
    act(() => result.current.next());
    expect(result.current.page).toBe(2);
    rerender({ items: makeItems(5) });
    expect(result.current.page).toBe(1);
  });
});
