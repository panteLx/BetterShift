"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { isRateLimitError, handleRateLimitError } from "@/lib/rate-limit-client";

class SendError extends Error {
  constructor(
    readonly kind: "rate-limited" | "unavailable" | "failed",
  ) {
    super(`Telemetry send failed: ${kind}`);
  }
}

/** Admin "send now": the same guarded send the daily timer does, on demand. */
export function useTelemetrySend() {
  const t = useTranslations();

  const mutation = useMutation<void, SendError>({
    mutationFn: async () => {
      const response = await fetch("/api/admin/telemetry/send", { method: "POST" });
      if (response.ok) return;
      if (isRateLimitError(response)) {
        await handleRateLimitError(response, t);
        throw new SendError("rate-limited");
      }
      // 409: off, outdated consent or dev build -- nothing was attempted.
      throw new SendError(response.status === 409 ? "unavailable" : "failed");
    },
    onSuccess: () => toast.success(t("admin.telemetry.sendSuccess")),
    onError: (error) => {
      // The rate-limit helper already showed its own toast.
      if (error.kind === "rate-limited") return;
      if (error.kind === "unavailable") toast.error(t("admin.telemetry.sendUnavailable"));
      else toast.error(t("admin.telemetry.sendFailed"));
    },
  });

  return { sendNow: mutation.mutate, isSending: mutation.isPending };
}
