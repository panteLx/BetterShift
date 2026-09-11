"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { toast } from "sonner";
import { Check, Copy, Link as LinkIcon, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, InfoNote, OptionCards, inputClass } from "@/components/form-kit";
import { StatusBanner } from "@/components/status-banner";
import type {
  CreatedAccessLink,
  LinkPermission,
  LinkValidity,
  useAccessLinkForm,
} from "@/hooks/useAccessLinkForm";
import { getDateLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";

type AccessLinkForm = ReturnType<typeof useAccessLinkForm>;

function useValidityLabel() {
  const t = useTranslations();
  return (validity: LinkValidity) =>
    validity === "1"
      ? t("token.expiration1Day")
      : validity === "7"
        ? t("token.expiration7Days")
        : validity === "30"
          ? t("token.expiration30Days")
          : t("sharingSheet.validityUnlimited");
}

function usePermissionLabel() {
  const t = useTranslations();
  return (permission: LinkPermission) =>
    permission === "read" ? t("sharingSheet.permRead") : t("sharingSheet.permWrite");
}

/** Fields of the "Neuen Link erzeugen" block; submit lives in the owning panel's footer. */
export function AccessLinkCreateForm({ form }: { form: AccessLinkForm }) {
  const t = useTranslations();
  const locale = useLocale();
  const validityLabel = useValidityLabel();

  return (
    <section className="flex flex-col gap-3.5">
      <h3 className="text-[14px] font-semibold text-fg-strong">
        {t("sharingSheet.newLink")}
      </h3>

      <Field
        htmlFor="access-link-name"
        label={
          <>
            {t("sharingSheet.linkName")}{" "}
            <span className="font-normal text-fg-tertiary">
              {t("sharingSheet.linkNameHint")}
            </span>
          </>
        }
      >
        <Input
          id="access-link-name"
          value={form.name}
          onChange={(e) => form.setName(e.target.value)}
          placeholder={t("sharingSheet.linkNamePlaceholder")}
          maxLength={50}
          className={inputClass}
        />
      </Field>

      <Field label={t("common.labels.permission")}>
        <OptionCards<LinkPermission>
          label={t("common.labels.permission")}
          value={form.permission}
          onChange={form.setPermission}
          options={[
            {
              value: "read",
              title: t("sharingSheet.permRead"),
              description: t("sharingSheet.permReadDesc"),
            },
            {
              value: "write",
              title: t("sharingSheet.permWrite"),
              description: t("sharingSheet.permWriteDesc"),
            },
          ]}
        />
      </Field>

      <Field label={t("sharingSheet.validity")}>
        <OptionCards<LinkValidity>
          label={t("sharingSheet.validity")}
          columns={4}
          value={form.validity}
          onChange={form.setValidity}
          options={(["1", "7", "30", "never"] as const).map((value) => ({
            value,
            title: validityLabel(value),
          }))}
        />
        <p className="font-mono text-[12px] text-fg-tertiary">
          {form.expiresAt
            ? t("sharingSheet.expiresOn", {
                date: format(form.expiresAt, "PPP", { locale: getDateLocale(locale) }),
              })
            : t("sharingSheet.validUntilRevoked")}
        </p>
      </Field>
    </section>
  );
}

/** Header block of the result view (9b), shown inside the panel body. */
export function AccessLinkCreatedHeader({ created }: { created: CreatedAccessLink }) {
  const t = useTranslations();
  const validityLabel = useValidityLabel();
  const permissionLabel = usePermissionLabel();

  return (
    <div className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
        <Check className="size-[17px]" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[17px] font-semibold leading-tight tracking-[-0.01em] text-fg-strong">
          {t("sharingSheet.linkReady")}
        </h3>
        <p className="mt-1 truncate text-[13px] text-fg-secondary">
          {[
            created.name || t("token.unnamed"),
            permissionLabel(created.permission),
            validityLabel(created.validity),
          ].join(" · ")}
        </p>
      </div>
    </div>
  );
}

/** The one-time view of a freshly created token. */
export function AccessLinkCreated({ created }: { created: CreatedAccessLink }) {
  const t = useTranslations();
  const linkInput = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(created.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API needs a secure context; leave the link selected for manual copying.
      linkInput.current?.select();
      toast.error(t("common.copyError", { item: t("sharingSheet.shareLinkLabel") }));
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <AccessLinkCreatedHeader created={created} />

      <StatusBanner tone="warning" icon={TriangleAlert} title={t("sharingSheet.copyNowTitle")}>
        {t("sharingSheet.copyNowBody")}
      </StatusBanner>

      <Field label={t("sharingSheet.shareLinkLabel")} htmlFor="access-link-url">
        <div className="flex gap-2">
          <Input
            id="access-link-url"
            ref={linkInput}
            value={created.link}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
            className={cn(inputClass, "min-w-0 flex-1 font-mono text-[12.5px] text-fg-strong md:text-[12.5px]")}
          />
          <Button type="button" onClick={handleCopy} className="h-10 shrink-0 gap-1.5 px-3.5 font-semibold">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? t("sharingSheet.copied") : t("common.copy")}
          </Button>
        </div>
      </Field>

      <Field label={t("token.token")}>
        <div className="select-all break-all rounded-[9px] border border-line bg-surface-panel px-3 py-[11px] font-mono text-[12px] leading-relaxed text-fg-body">
          {created.token}
        </div>
      </Field>

      <InfoNote icon={LinkIcon}>{t("sharingSheet.linkInfo")}</InfoNote>
    </div>
  );
}
