import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/lib/api-error";
import { generateTempId } from "@/lib/utils";
import { normalizeCapabilities, type BundleSeedKey, type Capability } from "@/lib/permission-bundles";
import { isRateLimitError, handleRateLimitError } from "@/lib/rate-limit-client";

export interface PermissionBundleUsage {
  shareCount: number;
  tokenCount: number;
  isGuestBundle: boolean;
}

export interface PermissionBundle {
  id: string;
  calendarId: string;
  name: string;
  seedKey: BundleSeedKey | null;
  capabilities: Capability[];
  createdAt: string;
  updatedAt: string;
}

export interface PermissionBundleWithUsage extends PermissionBundle {
  usage: PermissionBundleUsage;
}

/** Carries the service layer's error detail (forbidden capabilities, usage counts) alongside the HTTP status. */
export class PermissionBundleApiError extends ApiError {
  constructor(
    message: string,
    status: number,
    public readonly details?: unknown
  ) {
    super(message, status);
    this.name = "PermissionBundleApiError";
  }
}

/** Thrown instead of PermissionBundleApiError on a 429 so onError can show the rate-limit toast. */
class RateLimitError extends Error {
  constructor(public response: Response) {
    super("Rate limit exceeded");
    this.name = "RateLimitError";
  }
}

async function parseErrorResponse(
  response: Response,
  fallback: string
): Promise<never> {
  if (isRateLimitError(response)) {
    throw new RateLimitError(response);
  }
  const body = await response.json().catch(() => ({}));
  throw new PermissionBundleApiError(
    body.error || fallback,
    response.status,
    body.details
  );
}

async function fetchBundlesApi(
  calendarId: string
): Promise<PermissionBundleWithUsage[]> {
  const response = await fetch(`/api/calendars/${calendarId}/bundles`);
  if (!response.ok) {
    return parseErrorResponse(response, "Failed to fetch permission bundles");
  }
  return response.json();
}

async function createBundleApi(
  calendarId: string,
  input: { name: string; capabilities: Capability[] }
): Promise<PermissionBundle> {
  const response = await fetch(`/api/calendars/${calendarId}/bundles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    return parseErrorResponse(response, "Failed to create permission bundle");
  }
  return response.json();
}

async function updateBundleApi(
  calendarId: string,
  bundleId: string,
  input: { name?: string; capabilities?: Capability[] }
): Promise<PermissionBundle> {
  const response = await fetch(
    `/api/calendars/${calendarId}/bundles/${bundleId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
  if (!response.ok) {
    return parseErrorResponse(response, "Failed to update permission bundle");
  }
  return response.json();
}

async function deleteBundleApi(
  calendarId: string,
  bundleId: string
): Promise<void> {
  const response = await fetch(
    `/api/calendars/${calendarId}/bundles/${bundleId}`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    return parseErrorResponse(response, "Failed to delete permission bundle");
  }
}

async function cloneBundleApi(
  calendarId: string,
  bundleId: string,
  name: string
): Promise<PermissionBundle> {
  const response = await fetch(
    `/api/calendars/${calendarId}/bundles/${bundleId}/clone`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }
  );
  if (!response.ok) {
    return parseErrorResponse(response, "Failed to clone permission bundle");
  }
  return response.json();
}

interface MutationContext {
  previous?: PermissionBundleWithUsage[];
}

const EMPTY_USAGE: PermissionBundleUsage = {
  shareCount: 0,
  tokenCount: 0,
  isGuestBundle: false,
};

/** create/update/clone all 409 only on a name collision (delete's 409 carries `details.usage` instead). */
function isNameConflict(err: unknown): boolean {
  return (
    err instanceof PermissionBundleApiError &&
    err.status === 409 &&
    !(err.details && typeof err.details === "object" && "usage" in err.details)
  );
}

/**
 * CRUD for a calendar's permission bundles (Stufe 2, 7.3), optimistic per the
 * onMutate/onError/onSettled pattern in hooks/useShifts.ts. Every mutation
 * also invalidates queryKeys.calendars.all — a bundle's capabilities can
 * change what every holder of it is effectively allowed to do.
 */
export function useCalendarBundles(calendarId: string | undefined) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.permissionBundles.byCalendar(calendarId!);

  const { data: bundles = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchBundlesApi(calendarId!),
    enabled: !!calendarId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: queryKeys.calendars.all });
  };

  const rollback = (context?: MutationContext) => {
    if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
  };

  const buildOptimisticBundle = (
    name: string,
    capabilities: Capability[]
  ): PermissionBundleWithUsage => ({
    id: `temp-${generateTempId()}`,
    calendarId: calendarId!,
    name,
    seedKey: null,
    capabilities,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usage: EMPTY_USAGE,
  });

  const createMutation = useMutation<
    PermissionBundle,
    Error,
    { name: string; capabilities: Capability[] },
    MutationContext
  >({
    mutationFn: (input) => createBundleApi(calendarId!, input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PermissionBundleWithUsage[]>(queryKey);
      const optimistic = buildOptimisticBundle(
        input.name,
        normalizeCapabilities(input.capabilities)
      );
      queryClient.setQueryData<PermissionBundleWithUsage[]>(queryKey, (old = []) => [
        ...old,
        optimistic,
      ]);
      return { previous };
    },
    onError: async (err, _input, context) => {
      rollback(context);
      console.error("Failed to create permission bundle:", err);
      if (err instanceof RateLimitError) {
        await handleRateLimitError(err.response, t);
        return;
      }
      toast.error(
        isNameConflict(err)
          ? t("permissionBundles.nameTaken")
          : t("common.createError", { item: t("permissionBundles.bundle") })
      );
    },
    onSuccess: () => {
      toast.success(t("common.created", { item: t("permissionBundles.bundle") }));
    },
    onSettled: invalidate,
  });

  const updateMutation = useMutation<
    PermissionBundle,
    Error,
    { bundleId: string; name?: string; capabilities?: Capability[] },
    MutationContext
  >({
    mutationFn: ({ bundleId, ...input }) =>
      updateBundleApi(calendarId!, bundleId, input),
    onMutate: async ({ bundleId, ...input }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PermissionBundleWithUsage[]>(queryKey);
      queryClient.setQueryData<PermissionBundleWithUsage[]>(queryKey, (old = []) =>
        old.map((b) =>
          b.id === bundleId
            ? {
                ...b,
                ...(input.name !== undefined ? { name: input.name, seedKey: null } : {}),
                ...(input.capabilities !== undefined
                  ? { capabilities: normalizeCapabilities(input.capabilities) }
                  : {}),
                updatedAt: new Date().toISOString(),
              }
            : b
        )
      );
      return { previous };
    },
    onError: async (err, _variables, context) => {
      rollback(context);
      console.error("Failed to update permission bundle:", err);
      if (err instanceof RateLimitError) {
        await handleRateLimitError(err.response, t);
        return;
      }
      toast.error(
        isNameConflict(err)
          ? t("permissionBundles.nameTaken")
          : t("common.updateError", { item: t("permissionBundles.bundle") })
      );
    },
    onSuccess: () => {
      toast.success(t("common.updated", { item: t("permissionBundles.bundle") }));
    },
    onSettled: invalidate,
  });

  const deleteMutation = useMutation<void, Error, string, MutationContext>({
    mutationFn: (bundleId) => deleteBundleApi(calendarId!, bundleId),
    onMutate: async (bundleId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PermissionBundleWithUsage[]>(queryKey);
      queryClient.setQueryData<PermissionBundleWithUsage[]>(queryKey, (old = []) =>
        old.filter((b) => b.id !== bundleId)
      );
      return { previous };
    },
    onError: async (err, _bundleId, context) => {
      rollback(context);
      console.error("Failed to delete permission bundle:", err);
      if (err instanceof RateLimitError) {
        await handleRateLimitError(err.response, t);
        return;
      }
      if (
        err instanceof PermissionBundleApiError &&
        err.status === 409 &&
        err.details &&
        typeof err.details === "object" &&
        "usage" in err.details
      ) {
        const usage = (err.details as { usage: PermissionBundleUsage }).usage;
        const parts = [
          usage.shareCount > 0 &&
            t("permissionBundles.usageShares", { count: usage.shareCount }),
          usage.tokenCount > 0 &&
            t("permissionBundles.usageTokens", { count: usage.tokenCount }),
          usage.isGuestBundle && t("permissionBundles.usageGuestAccess"),
        ].filter(Boolean);
        toast.error(t("permissionBundles.deleteInUse", { usage: parts.join(", ") }));
        return;
      }
      toast.error(t("common.deleteError", { item: t("permissionBundles.bundle") }));
    },
    onSuccess: () => {
      toast.success(t("common.deleted", { item: t("permissionBundles.bundle") }));
    },
    onSettled: invalidate,
  });

  // Cloning creates a new, independent bundle — same optimistic shape as
  // create, no rollback of the source bundle needed.
  const cloneMutation = useMutation<
    PermissionBundle,
    Error,
    { bundleId: string; name: string },
    MutationContext
  >({
    mutationFn: ({ bundleId, name }) => cloneBundleApi(calendarId!, bundleId, name),
    onMutate: async ({ bundleId, name }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PermissionBundleWithUsage[]>(queryKey);
      const source = previous?.find((b) => b.id === bundleId);
      const optimistic = buildOptimisticBundle(name, source?.capabilities ?? []);
      queryClient.setQueryData<PermissionBundleWithUsage[]>(queryKey, (old = []) => [
        ...old,
        optimistic,
      ]);
      return { previous };
    },
    onError: async (err, _variables, context) => {
      rollback(context);
      console.error("Failed to clone permission bundle:", err);
      if (err instanceof RateLimitError) {
        await handleRateLimitError(err.response, t);
        return;
      }
      toast.error(
        isNameConflict(err)
          ? t("permissionBundles.nameTaken")
          : t("common.createError", { item: t("permissionBundles.bundle") })
      );
    },
    onSuccess: () => {
      toast.success(t("common.created", { item: t("permissionBundles.bundle") }));
    },
    onSettled: invalidate,
  });

  return {
    bundles,
    loading: isLoading,
    createBundle: (input: { name: string; capabilities: Capability[] }) =>
      createMutation.mutateAsync(input),
    updateBundle: (
      bundleId: string,
      input: { name?: string; capabilities?: Capability[] }
    ) => updateMutation.mutateAsync({ bundleId, ...input }),
    deleteBundle: (bundleId: string) => deleteMutation.mutateAsync(bundleId),
    cloneBundle: (bundleId: string, name: string) =>
      cloneMutation.mutateAsync({ bundleId, name }),
    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      cloneMutation.isPending,
  };
}
