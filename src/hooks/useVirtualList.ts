// @ts-nocheck — legacy file: migrating to strict TypeScript gradually
import { useState, useRef, useCallback } from "react";

interface VirtualItem<T> {
  item: T;
  index: number;
  offsetTop: number;
}
interface UseVirtualListOptions {
  itemHeight: number;
  overscan?: number;
  containerHeight?: number;
}
interface UseVirtualListResult<T> {
  virtualItems: VirtualItem<T>[];
  totalHeight: number;
  containerProps: { ref: React.MutableRefObject<HTMLDivElement | null>; onScroll: () => void };
}

export function useVirtualList<T>(
  items: T[],
  { itemHeight, overscan = 3, containerHeight = 600 }: UseVirtualListOptions,
): UseVirtualListResult<T> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.floor((scrollTop + containerHeight) / itemHeight) + overscan,
  );
  const virtualItems: VirtualItem<T>[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    virtualItems.push({ item: items[i], index: i, offsetTop: i * itemHeight });
  }
  const containerProps = {
    ref: containerRef,
    onScroll: useCallback(() => {
      if (containerRef.current) setScrollTop(containerRef.current.scrollTop);
    }, []),
  };
  return { virtualItems, totalHeight, containerProps };
}
