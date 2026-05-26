import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { useOnlineStatus } = await import("./useOnlineStatus");

describe("useOnlineStatus", () => {
  const addEventListener    = vi.spyOn(window, "addEventListener");
  const removeEventListener = vi.spyOn(window, "removeEventListener");

  beforeEach(() => {
    vi.clearAllMocks();
    addEventListener.mockImplementation(() => {});
    removeEventListener.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("devuelve true cuando navigator.onLine es true", () => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it("devuelve false cuando navigator.onLine es false", () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it("registra listeners online/offline al montar", () => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    renderHook(() => useOnlineStatus());
    expect(addEventListener).toHaveBeenCalledWith("online",  expect.any(Function));
    expect(addEventListener).toHaveBeenCalledWith("offline", expect.any(Function));
  });

  it("elimina listeners al desmontar", () => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    const { unmount } = renderHook(() => useOnlineStatus());
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith("online",  expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("offline", expect.any(Function));
  });

  it("actualiza estado al disparar evento online", () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    let onlineHandler: EventListener | undefined;
    addEventListener.mockImplementation((event: string, handler: EventListener) => {
      if (event === "online") onlineHandler = handler;
    });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
    act(() => {
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      onlineHandler?.(new Event("online"));
    });
    expect(result.current).toBe(true);
  });
});
