// @ts-nocheck — legacy file: migrating to strict TypeScript gradually
import { useState, useMemo } from "react";

interface UsePaginationResult<T> {
  page: number;
  setPage: (p: number) => void;
  totalPages: number;
  paged: T[];
}

export function usePagination<T>(items: T[], pageSize = 10): UsePaginationResult<T> {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const paged = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );
  return { page, setPage, totalPages, paged };
}
