"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AdminRequestError, type AdminListResponse } from "@/lib/admin-list";

/** Search input whose committed `query` trails the typed `input` by `delay` ms. */
export function useDebouncedSearch(delay = 300) {
  const [input, setInputState] = useState("");
  const [query, setQuery] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const setInput = useCallback(
    (value: string) => {
      setInputState(value);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setQuery(value.trim()), delay);
    },
    [delay]
  );

  return { input, query, setInput };
}

/** Runs a mutation and reports success as a boolean instead of throwing. */
export async function run<V>(
  mutate: (variables: V) => Promise<unknown>,
  variables: V
): Promise<boolean> {
  try {
    await mutate(variables);
    return true;
  } catch {
    return false;
  }
}

/** State that falls back to `initial` whenever `resetKey` changes, without an effect. */
export function useResettableState<T>(resetKey: string, initial: T) {
  const [state, setState] = useState({ key: resetKey, value: initial });
  const value = state.key === resetKey ? state.value : initial;

  const set = useCallback(
    (next: T | ((prev: T) => T)) =>
      setState((prev) => {
        const current = prev.key === resetKey ? prev.value : initial;
        return {
          key: resetKey,
          value: typeof next === "function" ? (next as (prev: T) => T)(current) : next,
        };
      }),
    [resetKey, initial]
  );

  return [value, set] as const;
}

/**
 * Shows a query error once, however many components observe the query.
 * `id` lets sonner replace instead of stack toasts from sibling observers.
 */
export function useAdminErrorToast(error: Error | null, id: string, fallback: string) {
  const t = useTranslations();
  const message =
    error instanceof AdminRequestError && error.status === 403
      ? t("admin.accessDenied")
      : error
        ? fallback
        : null;

  useEffect(() => {
    if (message) toast.error(message, { id });
  }, [message, id]);
}

type ListSnapshot = Array<[QueryKey, unknown]>;

/** Cancels, snapshots and patches every cached page of a list for an optimistic update. */
export async function patchListPages<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  patch: (items: T[]) => T[]
): Promise<ListSnapshot> {
  await queryClient.cancelQueries({ queryKey });
  const snapshot = queryClient.getQueriesData({ queryKey });
  queryClient.setQueriesData<AdminListResponse<T, unknown>>({ queryKey }, (old) => {
    if (!old) return old;
    const items = patch(old.items);
    return { ...old, items, total: old.total - (old.items.length - items.length) };
  });
  return snapshot;
}

export function restoreListPages(queryClient: QueryClient, snapshot: ListSnapshot | undefined) {
  snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));
}
