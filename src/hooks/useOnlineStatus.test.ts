import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { useOnlineStatus } = await import("./useOnlineStatus");

describe("useOnlineStatus", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("devuelve true cuando navigator.onLine es true", () => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true, writable: true });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it("devuelve false cuando navigator.onLine es false", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
      writable: true,
    });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it("registra listeners online/offline al montar", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true, writable: true });
    renderHook(() => useOnlineStatus());
    expect(addSpy).toHaveBeenCalledWith("online", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith("offline", expect.any(Function));
  });

  it("elimina listeners al desmontar", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true, writable: true });
    const { unmount } = renderHook(() => useOnlineStatus());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("online", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("offline", expect.any(Function));
  });

  it("actualiza a true al disparar evento online", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
      writable: true,
    });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);

    act(() => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
        writable: true,
      });
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current).toBe(true);
  });

  it("actualiza a false al disparar evento offline", () => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true, writable: true });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
        writable: true,
      });
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current).toBe(false);
  });
});
