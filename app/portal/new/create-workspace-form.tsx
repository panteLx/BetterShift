"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Check, Loader2, X } from "lucide-react";
import { AuthShell, authInputClass } from "@/components/auth-shell";
import { Field } from "@/components/form-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import {
  WorkspaceApiError,
  useCreateWorkspace,
  useMyWorkspaces,
  useSlugAvailability,
  useWorkspaceHref,
} from "@/hooks/useWorkspaces";
import { handleRateLimitError } from "@/lib/rate-limit-client";
import { SLUG_MAX_LENGTH, isValidSlugFormat, suggestSlug } from "@/lib/workspace-slugs";
import { cn } from "@/lib/utils";

const SLUG_DEBOUNCE_MS = 300;

export function CreateWorkspaceForm() {
  const t = useTranslations();
  const { tenantBaseDomain } = usePublicConfig();
  const href = useWorkspaceHref();
  const createWorkspace = useCreateWorkspace();
  const maxOwned = useMyWorkspaces("portal").data?.maxOwned;
  const [name, setName] = useState("");
  const [manualSlug, setManualSlug] = useState<string | null>(null);
  const slug = manualSlug ?? suggestSlug(name);
  const [debouncedSlug, setDebouncedSlug] = useState(slug);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSlug(slug), SLUG_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [slug]);

  const debouncedValid = isValidSlugFormat(debouncedSlug);
  const availability = useSlugAvailability(debouncedSlug, debouncedValid);
  const settled = debouncedSlug === slug;
  const status = settled && debouncedValid ? availability.data?.status : undefined;

  const slugStatus = (() => {
    if (!slug || !settled) return null;
    if (!debouncedValid) return { ok: false, text: t("workspaces.slugInvalid") };
    if (status === "available") return { ok: true, text: t("workspaces.slugAvailable") };
    if (status === "taken") return { ok: false, text: t("workspaces.slugTaken") };
    if (status === "reserved") return { ok: false, text: t("workspaces.slugReserved") };
    if (status === "invalid") return { ok: false, text: t("workspaces.slugInvalid") };
    return null;
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    createWorkspace.mutate(
      { name: name.trim(), slug },
      {
        onSuccess: (result) => window.location.assign(href(result.workspace.slug)),
        onError: async (error) => {
          if (error instanceof WorkspaceApiError && error.rateLimitResponse) {
            await handleRateLimitError(error.rateLimitResponse, t);
            return;
          }
          const code = error instanceof WorkspaceApiError ? error.code : null;
          let message: string;
          if (code === "limit" && maxOwned !== undefined) message = t("workspaces.limitReached", { max: maxOwned });
          else if (code === "taken") message = t("workspaces.slugTaken");
          else if (code === "reserved") message = t("workspaces.slugReserved");
          else if (code === "invalid") message = t("workspaces.slugInvalid");
          else if (code === "invalid_name") message = t("workspaces.nameInvalid");
          else message = t("workspaces.createError");
          setSubmitError(message);
        },
      }
    );
  };

  const isSubmitting = createWorkspace.isPending || createWorkspace.isSuccess;
  const canSubmit = !!name.trim() && isValidSlugFormat(slug) && status !== "taken" && status !== "reserved";

  return (
    <AuthShell title={t("workspaces.createTitle")} description={t("workspaces.createDescription")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label={t("workspaces.name")} htmlFor="workspace-name">
          <Input
            id="workspace-name"
            autoComplete="organization"
            placeholder={t("workspaces.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            maxLength={64}
            required
            className={authInputClass}
          />
        </Field>

        <Field label={t("workspaces.address")} htmlFor="workspace-slug" hint={t("workspaces.slugHint")}>
          <div className="flex items-stretch">
            <Input
              id="workspace-slug"
              autoComplete="off"
              spellCheck={false}
              value={slug}
              onChange={(e) => setManualSlug(e.target.value.toLowerCase())}
              disabled={isSubmitting}
              maxLength={SLUG_MAX_LENGTH}
              required
              aria-invalid={slugStatus ? !slugStatus.ok : undefined}
              aria-describedby="workspace-slug-status"
              className={cn(authInputClass, "rounded-r-none font-mono")}
            />
            <span className="flex max-w-[55%] items-center truncate rounded-r-[9px] border border-l-0 border-input bg-surface-panel px-3 font-mono text-[13px] text-fg-tertiary">
              .{tenantBaseDomain}
            </span>
          </div>
          <p
            id="workspace-slug-status"
            aria-live="polite"
            className={cn(
              "flex min-h-[18px] items-center gap-1 text-[12px]",
              slugStatus?.ok ? "text-success" : "text-danger"
            )}
          >
            {slugStatus ? (
              <>
                {slugStatus.ok ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
                {slugStatus.text}
              </>
            ) : (
              settled && debouncedValid && availability.isFetching && (
                <Loader2 className="size-3.5 animate-spin text-fg-tertiary" aria-hidden />
              )
            )}
          </p>
        </Field>

        {submitError && (
          <p role="alert" className="text-[13px] text-danger">
            {submitError}
          </p>
        )}

        <Button
          type="submit"
          className="h-11 w-full rounded-[9px] text-[15px] font-semibold"
          disabled={!canSubmit || isSubmitting}
        >
          {isSubmitting ? t("common.loading") : t("workspaces.create")}
        </Button>
      </form>

      <Link
        href="/"
        className="flex items-center justify-center gap-1.5 border-t border-line pt-4 text-[13.5px] font-semibold text-brand-ink hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("workspaces.backToOverview")}
      </Link>
    </AuthShell>
  );
}
