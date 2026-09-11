"use client";

import { ReactNode, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format, formatDistanceToNow } from "date-fns";
import { Eye, EyeOff, Link as LinkIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { ListRow, Pill, RowIconButton, SectionLabel } from "@/components/form-kit";
import { PanelBody, PanelFooter } from "@/components/panel-dialog";
import {
  AccessLinkCreateForm,
  AccessLinkCreated,
} from "@/components/calendar-token-create-dialog";
import { useCalendarTokens, type CalendarAccessToken } from "@/hooks/useCalendarTokens";
import { useAccessLinkForm } from "@/hooks/useAccessLinkForm";
import { getDateLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";

function isExpired(token: CalendarAccessToken) {
  return !!token.expiresAt && new Date(token.expiresAt) < new Date();
}

function TokenRow({
  token,
  onToggleActive,
  onRevoke,
}: {
  token: CalendarAccessToken;
  onToggleActive: () => void;
  onRevoke: () => void;
}) {
  const t = useTranslations();
  const dateLocale = getDateLocale(useLocale());
  const expired = isExpired(token);
  const dimmed = expired || !token.isActive;

  const expiryDate = token.expiresAt
    ? format(new Date(token.expiresAt), "P", { locale: dateLocale })
    : null;
  const expiry = !expiryDate
    ? t("sharingSheet.noExpiry")
    : expired
      ? t("sharingSheet.expiredOn", { date: expiryDate })
      : t("sharingSheet.expiresOn", { date: expiryDate });

  const usage = [
    t("token.usedCount", { count: token.usageCount }),
    token.lastUsedAt &&
      t("sharingSheet.lastUsed", {
        time: formatDistanceToNow(new Date(token.lastUsedAt), {
          addSuffix: true,
          locale: dateLocale,
        }),
      }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <ListRow className={cn(dimmed && "bg-surface-panel")}>
      <LinkIcon className="size-4 shrink-0 text-fg-tertiary" />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate text-[14px] font-semibold",
            dimmed ? "text-fg-secondary" : "text-fg-strong"
          )}
        >
          {token.name || (
            <span className="font-normal italic text-fg-tertiary">{t("token.unnamed")}</span>
          )}
        </div>
        <div
          className={cn(
            "mt-0.5 truncate font-mono text-[12px]",
            expired ? "text-danger" : "text-fg-tertiary"
          )}
        >
          {expiry}
        </div>
        <div className="truncate text-[12px] text-fg-tertiary">{usage}</div>
      </div>
      {token.permission === "write" ? (
        <Pill tone="warning">{t("sharingSheet.permWrite")}</Pill>
      ) : (
        <Pill>{t("sharingSheet.permRead")}</Pill>
      )}
      <RowIconButton
        icon={token.isActive ? EyeOff : Eye}
        label={token.isActive ? t("token.disable") : t("token.enable")}
        onClick={onToggleActive}
      />
      <RowIconButton icon={Trash2} tone="danger" label={t("token.revoke")} onClick={onRevoke} />
    </ListRow>
  );
}

/** Existing links of a calendar, split into active and inactive/expired. */
export function CalendarTokenList({ calendarId }: { calendarId: string }) {
  const t = useTranslations();
  const { tokens, updateToken, deleteToken } = useCalendarTokens(calendarId);
  const [tokenToRevoke, setTokenToRevoke] = useState<CalendarAccessToken | null>(null);

  const active = tokens.filter((token) => token.isActive && !isExpired(token));
  const inactive = tokens.filter((token) => !token.isActive || isExpired(token));

  const renderRows = (list: CalendarAccessToken[]) =>
    list.map((token) => (
      <TokenRow
        key={token.id}
        token={token}
        onToggleActive={() => updateToken(token.id, { isActive: !token.isActive })}
        onRevoke={() => setTokenToRevoke(token)}
      />
    ));

  return (
    <>
      <section className="flex flex-col gap-2">
        <SectionLabel className="mb-0">{t("sharingSheet.activeLinks")}</SectionLabel>
        {active.length === 0 ? (
          <p className="rounded-[11px] border border-dashed border-control px-3.5 py-3 text-center text-[13px] text-fg-tertiary">
            {t("sharingSheet.noActiveLinks")}
          </p>
        ) : (
          renderRows(active)
        )}
      </section>

      {inactive.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel className="mb-0">{t("sharingSheet.inactiveLinks")}</SectionLabel>
          {renderRows(inactive)}
        </section>
      )}

      {tokenToRevoke && (
        <ConfirmationDialog
          open
          onOpenChange={(open) => !open && setTokenToRevoke(null)}
          onConfirm={async () => {
            if (await deleteToken(tokenToRevoke.id)) setTokenToRevoke(null);
          }}
          title={t("token.revokeConfirm")}
          description={t("token.revokeConfirmDescription", {
            name: tokenToRevoke.name || t("token.unnamed"),
          })}
          confirmText={t("token.revoke")}
          confirmVariant="destructive"
        />
      )}
    </>
  );
}

/**
 * Access links (screens 9a/9b) as a settings panel. `leading` renders above the
 * list, e.g. the tab switcher of the standalone sharing sheet.
 */
export function AccessLinksPanel({
  calendarId,
  onClose,
  leading,
}: {
  calendarId: string;
  onClose: () => void;
  leading?: ReactNode;
}) {
  const t = useTranslations();
  const form = useAccessLinkForm(calendarId);

  if (form.created) {
    return (
      <>
        <PanelBody>
          <AccessLinkCreated created={form.created} />
        </PanelBody>
        <PanelFooter>
          <Button variant="outline" className="h-10 flex-1 font-semibold" onClick={form.reset}>
            {t("common.close")}
          </Button>
        </PanelFooter>
      </>
    );
  }

  return (
    <>
      <PanelBody className="flex flex-col gap-3.5">
        {leading}
        <CalendarTokenList calendarId={calendarId} />
        <div className="h-px shrink-0 bg-line" />
        <AccessLinkCreateForm form={form} />
      </PanelBody>
      <PanelFooter>
        <Button variant="outline" className="h-10 flex-1 font-semibold" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button className="h-10 flex-1 font-semibold" onClick={form.create} disabled={form.creating}>
          {form.creating ? t("sharingSheet.creating") : t("sharingSheet.createLink")}
        </Button>
      </PanelFooter>
    </>
  );
}
