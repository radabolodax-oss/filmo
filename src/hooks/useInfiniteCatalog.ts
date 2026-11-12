import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CatalogRowRecipe,
  InfiniteCatalogRow,
  fetchCatalogPage,
  fetchInfiniteCatalogBatch,
} from '../utils/infiniteCatalogRows';

interface UseInfiniteCatalogOptions {
  initialBatchSize?: number;
  batchSize?: number;
  enabled?: boolean;
}

const MAX_ITEMS_PER_ROW = 120;

export function useInfiniteCatalog(
  recipes: CatalogRowRecipe[],
  options: UseInfiniteCatalogOptions = {},
) {
  const {
    initialBatchSize = 6,
    batchSize = 4,
    enabled = true,
  } = options;

  const [rows, setRows] = useState<InfiniteCatalogRow[]>([]);
  const [isLoadingBatch, setIsLoadingBatch] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const rowsRef = useRef<InfiniteCatalogRow[]>([]);
  const cursorRef = useRef(0);
  const loadingBatchRef = useRef(false);
  const loadingRowsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  rowsRef.current = rows;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadBatch = useCallback(async (count: number) => {
    if (!enabled || loadingBatchRef.current || recipes.length === 0) return;
    loadingBatchRef.current = true;
    setIsLoadingBatch(true);

    try {
      let attempts = 0;
      let collected: InfiniteCatalogRow[] = [];

      // Retry next recipes if an entire batch returned empty (e.g. strict region cycle)
      while (attempts < 2 && collected.length === 0) {
        const { rows: fetched, nextCursor } = await fetchInfiniteCatalogBatch(
          recipes,
          cursorRef.current,
          count,
        );
        cursorRef.current = nextCursor;
        collected = fetched;
        attempts += 1;
      }

      if (mountedRef.current && collected.length > 0) {
        setRows((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const unique = collected.filter((r) => !existingIds.has(r.id));
          return unique.length > 0 ? [...prev, ...unique] : prev;
        });
      }
    } finally {
      loadingBatchRef.current = false;
      if (mountedRef.current) {
        setIsLoadingBatch(false);
      }
    }
  }, [enabled, recipes]);

  // Initial batch (includes KR / IN / NG cultural categories immediately)
  useEffect(() => {
    if (!enabled || cursorRef.current > 0) return;
    loadBatch(initialBatchSize);
  }, [enabled, initialBatchSize, loadBatch]);

  // Infinite vertical scroll observer with generous lookahead
  useEffect(() => {
    if (!enabled) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadBatch(batchSize);
        }
      },
      { rootMargin: '900px 0px', threshold: 0 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, batchSize, loadBatch, rows.length]);

  const loadMoreRowItems = useCallback(async (rowId: string) => {
    const target = rowsRef.current.find((r) => r.id === rowId);
    if (!target || !target.hasMore || target.items.length >= MAX_ITEMS_PER_ROW) return;
    if (loadingRowsRef.current.has(rowId)) return;

    loadingRowsRef.current.add(rowId);
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, isLoadingMore: true } : r)),
    );

    try {
      const { items: newItems, totalPages } = await fetchCatalogPage(
        target.recipe,
        target.nextPage,
      );

      if (!mountedRef.current) return;

      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== rowId) return r;
          const seen = new Set(r.items.map((item) => item.id));
          const merged = [...r.items];
          for (const item of newItems) {
            if (!seen.has(item.id) && merged.length < MAX_ITEMS_PER_ROW) {
              seen.add(item.id);
              merged.push(item);
            }
          }
          const nextPage = r.nextPage + 1;
          return {
            ...r,
            items: merged,
            nextPage,
            hasMore: nextPage <= totalPages && merged.length < MAX_ITEMS_PER_ROW,
            isLoadingMore: false,
          };
        }),
      );
    } catch {
      if (mountedRef.current) {
        setRows((prev) =>
          prev.map((r) => (r.id === rowId ? { ...r, isLoadingMore: false } : r)),
        );
      }
    } finally {
      loadingRowsRef.current.delete(rowId);
    }
  }, []);

  return {
    rows,
    isLoadingBatch,
    sentinelRef,
    loadMoreRowItems,
  };
}
