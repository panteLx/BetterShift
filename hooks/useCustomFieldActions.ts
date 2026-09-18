import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/lib/api-error";
import { generateTempId } from "@/lib/utils";
import type { CustomFieldDefinition, CustomFieldOption, CustomFieldType } from "@/lib/custom-fields";
import { isRateLimitError, handleRateLimitError } from "@/lib/rate-limit-client";

export interface CreateCustomFieldInput {
  key: string;
  label: string;
  type: CustomFieldType;
  options: CustomFieldOption[] | null;
  required: boolean;
  showInCalendar: boolean;
}

export interface UpdateCustomFieldInput {
  label?: string;
  options?: CustomFieldOption[] | null;
  required?: boolean;
  showInCalendar?: boolean;
}

/** Carries the HTTP status so a create's 409 (key already in use) can be told apart from a generic failure. */
export class CustomFieldApiError extends ApiError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = "CustomFieldApiError";
  }
}

/** Thrown instead of CustomFieldApiError on a 429 so onError can show the rate-limit toast. */
class RateLimitError extends Error {
  constructor(public response: Response) {
    super("Rate limit exceeded");
    this.name = "RateLimitError";
  }
}

async function parseErrorResponse(response: Response, fallback: string): Promise<never> {
  if (isRateLimitError(response)) {
    throw new RateLimitError(response);
  }
  const body = await response.json().catch(() => ({}));
  throw new CustomFieldApiError(body.error || fallback, response.status);
}

/** True for the create endpoint's 409 on a key collision, so the form can mark the key field. */
export function isKeyInUse(err: unknown): boolean {
  return err instanceof CustomFieldApiError && err.status === 409 && err.message === "KEY_IN_USE";
}

async function createFieldApi(
  calendarId: string,
  input: CreateCustomFieldInput
): Promise<CustomFieldDefinition> {
  const response = await fetch(`/api/calendars/${calendarId}/custom-fields`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    return parseErrorResponse(response, "Failed to create custom field");
  }
  return response.json();
}

async function updateFieldApi(
  calendarId: string,
  fieldId: string,
  input: UpdateCustomFieldInput
): Promise<CustomFieldDefinition> {
  const response = await fetch(`/api/calendars/${calendarId}/custom-fields/${fieldId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    return parseErrorResponse(response, "Failed to update custom field");
  }
  return response.json();
}

async function deleteFieldApi(calendarId: string, fieldId: string): Promise<void> {
  const response = await fetch(`/api/calendars/${calendarId}/custom-fields/${fieldId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    return parseErrorResponse(response, "Failed to delete custom field");
  }
}

async function reorderFieldsApi(calendarId: string, fieldIds: string[]): Promise<void> {
  const response = await fetch(`/api/calendars/${calendarId}/custom-fields/reorder`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fieldIds }),
  });
  if (!response.ok) {
    return parseErrorResponse(response, "Failed to reorder custom fields");
  }
}

interface MutationContext {
  previous?: CustomFieldDefinition[];
}

/**
 * CRUD for a calendar's custom field catalog, optimistic per the
 * onMutate/onError/onSettled pattern in hooks/useShifts.ts. Every mutation
 * invalidates shifts and presets alongside the catalog itself: deleting a
 * definition cascades its values away, so a stale cache would keep showing
 * values that no longer exist.
 */
export function useCustomFieldActions(calendarId: string) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.customFields.byCalendar(calendarId);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: queryKeys.shifts.byCalendar(calendarId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.presets.byCalendar(calendarId) });
  };

  const rollback = (context?: MutationContext) => {
    if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
  };

  const createMutation = useMutation<
    CustomFieldDefinition,
    Error,
    CreateCustomFieldInput,
    MutationContext
  >({
    mutationFn: (input) => createFieldApi(calendarId, input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CustomFieldDefinition[]>(queryKey);
      const optimistic: CustomFieldDefinition = {
        id: `temp-${generateTempId()}`,
        calendarId,
        order: previous?.length ?? 0,
        ...input,
      };
      queryClient.setQueryData<CustomFieldDefinition[]>(queryKey, (old = []) => [
        ...old,
        optimistic,
      ]);
      return { previous };
    },
    onError: async (err, _input, context) => {
      rollback(context);
      console.error("Failed to create custom field:", err);
      if (err instanceof RateLimitError) {
        await handleRateLimitError(err.response, t);
        return;
      }
      // 409 (key already in use) is left for the form to detect via isKeyInUse and
      // mark the key field inline, so it does not also get the generic toast here.
      if (!isKeyInUse(err)) {
        toast.error(t("customFields.saveFailed"));
      }
    },
    onSettled: invalidate,
  });

  const updateMutation = useMutation<
    CustomFieldDefinition,
    Error,
    { fieldId: string; input: UpdateCustomFieldInput },
    MutationContext
  >({
    mutationFn: ({ fieldId, input }) => updateFieldApi(calendarId, fieldId, input),
    onMutate: async ({ fieldId, input }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CustomFieldDefinition[]>(queryKey);
      queryClient.setQueryData<CustomFieldDefinition[]>(queryKey, (old = []) =>
        old.map((f) => (f.id === fieldId ? { ...f, ...input } : f))
      );
      return { previous };
    },
    onError: async (err, _variables, context) => {
      rollback(context);
      console.error("Failed to update custom field:", err);
      if (err instanceof RateLimitError) {
        await handleRateLimitError(err.response, t);
        return;
      }
      toast.error(t("customFields.saveFailed"));
    },
    onSettled: invalidate,
  });

  const deleteMutation = useMutation<void, Error, string, MutationContext>({
    mutationFn: (fieldId) => deleteFieldApi(calendarId, fieldId),
    onMutate: async (fieldId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CustomFieldDefinition[]>(queryKey);
      queryClient.setQueryData<CustomFieldDefinition[]>(queryKey, (old = []) =>
        old.filter((f) => f.id !== fieldId)
      );
      return { previous };
    },
    onError: async (err, _fieldId, context) => {
      rollback(context);
      console.error("Failed to delete custom field:", err);
      if (err instanceof RateLimitError) {
        await handleRateLimitError(err.response, t);
        return;
      }
      toast.error(t("customFields.deleteFailed"));
    },
    onSettled: invalidate,
  });

  const reorderMutation = useMutation<void, Error, string[], MutationContext>({
    mutationFn: (fieldIds) => reorderFieldsApi(calendarId, fieldIds),
    onMutate: async (fieldIds) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CustomFieldDefinition[]>(queryKey);
      queryClient.setQueryData<CustomFieldDefinition[]>(queryKey, (old = []) => {
        const byId = new Map(old.map((f) => [f.id, f]));
        return fieldIds
          .map((id, index) => {
            const field = byId.get(id);
            return field ? { ...field, order: index } : null;
          })
          .filter((f): f is CustomFieldDefinition => f !== null);
      });
      return { previous };
    },
    onError: async (err, _fieldIds, context) => {
      rollback(context);
      console.error("Failed to reorder custom fields:", err);
      if (err instanceof RateLimitError) {
        await handleRateLimitError(err.response, t);
        return;
      }
      toast.error(t("customFields.saveFailed"));
    },
    onSettled: invalidate,
  });

  return {
    /** The create mutation's last error, so a caller can run isKeyInUse() on it — createField itself only returns a boolean. */
    createFieldError: createMutation.error,
    createField: async (input: CreateCustomFieldInput) => {
      try {
        await createMutation.mutateAsync(input);
        return true;
      } catch {
        return false;
      }
    },
    updateField: async (fieldId: string, input: UpdateCustomFieldInput) => {
      try {
        await updateMutation.mutateAsync({ fieldId, input });
        return true;
      } catch {
        return false;
      }
    },
    deleteField: async (fieldId: string) => {
      try {
        await deleteMutation.mutateAsync(fieldId);
        return true;
      } catch {
        return false;
      }
    },
    reorderFields: async (fieldIds: string[]) => {
      try {
        await reorderMutation.mutateAsync(fieldIds);
        return true;
      } catch {
        return false;
      }
    },
  };
}
