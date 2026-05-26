import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { usePagination } = await import("./usePagination");

const makeItems = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: String(i + 1), name: `Item ${i + 1}` }));

describe("usePagination", () => {
  it("comienza en página 1 por defecto", () => {
    const { result } = renderHook(() => usePagination(makeItems(25), 10));
    expect(result.current.page).toBe(1);
  });

  it("paged devuelve los items de la página actual", () => {
    const { result } = renderHook(() => usePagination(makeItems(25), 10));
    expect(result.current.paged).toHaveLength(10);
    expect(result.current.paged[0]).toEqual({ id: "1", name: "Item 1" });
  });

  it("paginated es alias de paged", () => {
    const { result } = renderHook(() => usePagination(makeItems(25), 10));
    expect(result.current.paginated).toEqual(result.current.paged);
  });

  it("calcula totalPages correctamente", () => {
    const { result } = renderHook(() => usePagination(makeItems(25), 10));
    expect(result.current.totalPages).toBe(3);
  });

  it("totalPages es 1 con menos items que pageSize", () => {
    const { result } = renderHook(() => usePagination(makeItems(5), 10));
    expect(result.current.totalPages).toBe(1);
  });

  it("totalPages es 1 sin items", () => {
    const { result } = renderHook(() => usePagination([], 10));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.paged).toHaveLength(0);
  });

  it("total refleja la cantidad total de items", () => {
    const { result } = renderHook(() => usePagination(makeItems(17), 5));
    expect(result.current.total).toBe(17);
  });

  it("setPage navega a la página correcta", () => {
    const { result } = renderHook(() => usePagination(makeItems(25), 10));
    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);
    expect(result.current.paged[0]).toEqual({ id: "11", name: "Item 11" });
  });

  it("setPage no supera la última página", () => {
    const { result } = renderHook(() => usePagination(makeItems(10), 10));
    act(() => result.current.setPage(99));
    expect(result.current.page).toBe(1);
  });

  it("la última página puede tener menos items", () => {
    const { result } = renderHook(() => usePagination(makeItems(25), 10));
    act(() => result.current.setPage(3));
    expect(result.current.paged).toHaveLength(5);
  });

  it("pageSize es el tamaño de página configurado", () => {
    const { result } = renderHook(() => usePagination(makeItems(20), 7));
    expect(result.current.pageSize).toBe(7);
  });

  it("vuelve a la última página válida si los items se reducen", () => {
    const { result, rerender } = renderHook(
      ({ items }: { items: { id: string; name: string }[] }) => usePagination(items, 10),
      { initialProps: { items: makeItems(25) } },
    );
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);
    // Reducir items — safePage clampea automáticamente
    rerender({ items: makeItems(5) });
    expect(result.current.page).toBe(1);
  });
});
