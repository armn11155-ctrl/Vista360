// @ts-nocheck — legacy file: migrating to strict TypeScript gradually
import { useState, useMemo } from "react";

interface UsePaginationResult<T> {
  page: number;
  setPage: (p: number) => void;
  totalPages: number;
  total: number;
  pageSize: number;
  paged: T[];
  paginated: T[]; // alias for backwards compatibility
}

export function usePagination<T>(items: T[], pageSize = 10): UsePaginationResult<T> {
  const [page, setPage] = useState(1);
  const safeItems = Array.isArray(items) ? items : [];
  const totalPages = Math.max(1, Math.ceil(safeItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => safeItems.slice((safePage - 1) * pageSize, safePage * pageSize),
    [safeItems, safePage, pageSize],
  );
  return {
    page: safePage,
    setPage,
    totalPages,
    total: safeItems.length,
    pageSize,
    paged,
    paginated: paged, // alias — several components use this name
  };
}
