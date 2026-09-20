"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTelemetryPayload } from "@/hooks/useTelemetryPayload";
import { useSystemSettings } from "@/hooks/useSystemSettings";

// Default upstream repo; a self-hosted fork's GITHUB_REPO_OWNER/NAME override isn't
// available client-side, so this doc link always points at the canonical project.
const TELEMETRY_DOCS_URL =
  "https://github.com/panteLx/BetterShift/blob/main/docs/TELEMETRY.md";

interface TelemetryConsentDialogProps {
  open: boolean;
  onDecide: (accepted: boolean) => void;
}

/**
 * One-time, non-dismissible consent gate shown to an admin whose instance has not
 * yet decided on telemetry. Only the two buttons resolve it — no other way out.
 */
export function TelemetryConsentDialog({ open, onDecide }: TelemetryConsentDialogProps) {
  const t = useTranslations();
  const { updateSettings, isUpdating } = useSystemSettings();
  // Real payload of this instance, not a mock — fetched only while the dialog is open.
  const { data: payload } = useTelemetryPayload("telemetry", open);

  const decide = (accepted: boolean) => {
    updateSettings({ telemetryEnabled: accepted });
    onDecide(accepted);
  };

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-2xl border-control p-0 shadow-window sm:max-w-[480px]"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="gap-1.5 border-b border-line px-[22px] pb-4 pt-5 text-left">
          <DialogTitle className="text-[19px] font-semibold leading-tight tracking-[-0.01em] text-fg-strong">
            {t("telemetry.consent.title")}
          </DialogTitle>
          <DialogDescription className="mt-1 text-[13.5px] text-fg-secondary">
            {t("telemetry.consent.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[min(60vh,480px)] flex-col gap-3.5 overflow-y-auto px-[22px] py-[18px]">
          <ul className="flex flex-col gap-1.5 text-[13px] text-fg-secondary">
            <li className="flex gap-2">
              <span aria-hidden>•</span>
              {t("telemetry.consent.pointAnonymous")}
            </li>
            <li className="flex gap-2">
              <span aria-hidden>•</span>
              {t("telemetry.consent.pointBuckets")}
            </li>
            <li className="flex gap-2">
              <span aria-hidden>•</span>
              {t("telemetry.consent.pointRevocable")}
            </li>
            <li className="flex gap-2">
              <span aria-hidden>•</span>
              {t("telemetry.consent.pointPublic")}
            </li>
          </ul>

          <details className="rounded-lg border border-line">
            <summary className="cursor-pointer select-none px-3 py-2 text-[13px] font-medium text-fg-secondary">
              {t("telemetry.consent.previewToggle")}
            </summary>
            <pre className="max-h-[240px] overflow-auto rounded-b-lg border-t border-line bg-surface-panel px-3 py-2.5 text-[11.5px] leading-relaxed text-fg-tertiary">
              {payload ? JSON.stringify(payload, null, 2) : t("common.loading")}
            </pre>
          </details>

          <a
            href={TELEMETRY_DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] font-medium text-brand-ink underline underline-offset-2"
          >
            {t("telemetry.consent.docsLink")}
          </a>
        </div>

        <DialogFooter className="flex-row gap-2.5 border-t border-line px-[22px] pb-[max(16px,env(safe-area-inset-bottom))] pt-4">
          {/* Equal variant on both sides on purpose — a highlighted accept would be a dark pattern. */}
          <Button
            type="button"
            variant="outline"
            className="h-10 flex-1 font-semibold"
            disabled={isUpdating}
            onClick={() => decide(true)}
          >
            {t("telemetry.consent.accept")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 flex-1 font-semibold"
            disabled={isUpdating}
            onClick={() => decide(false)}
          >
            {t("telemetry.consent.decline")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
