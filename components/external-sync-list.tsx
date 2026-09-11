"use client";

import { useLocale, useTranslations } from "next-intl";
import { RefreshCw, Trash2 } from "lucide-react";
import { ExternalSync } from "@/lib/db/schema";
import { ListRow, Pill, RowIconButton } from "@/components/form-kit";
import { cn } from "@/lib/utils";

/** "5 min", "2 h", "24 h" — unit abbreviations are the same in every locale. */
export function formatSyncInterval(minutes: number) {
  return minutes < 60 ? `${minutes} min` : `${minutes / 60} h`;
}

function formatLastSync(value: Date | string, locale: string) {
  const date = new Date(value);
  const today = date.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat(
    locale,
    today
      ? { hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
  ).format(date);
}

interface ExternalSyncRowProps {
  sync: ExternalSync;
  error?: string;
  selected: boolean;
  syncing: boolean;
  deleting: boolean;
  /** Another row is syncing or being deleted */
  busy: boolean;
  onSelect: () => void;
  onSync: () => void;
  onDelete: () => void;
}

export function ExternalSyncRow({
  sync,
  error,
  selected,
  syncing,
  deleting,
  busy,
  onSelect,
  onSync,
  onDelete,
}: ExternalSyncRowProps) {
  const t = useTranslations();
  const locale = useLocale();
  const lastSynced = sync.lastSyncedAt ? new Date(sync.lastSyncedAt) : null;

  return (
    <ListRow highlighted={selected} className="gap-2 px-[13px]">
      <button
        type="button"
        onClick={onSelect}
        disabled={busy || syncing || deleting}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 items-center gap-[11px] text-left disabled:cursor-default"
      >
        <span
          className="shift-rail h-[34px] w-1 shrink-0 self-center rounded-full"
          style={{ "--shift": sync.color } as React.CSSProperties}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-fg-strong">
            {sync.name}
          </span>
          <span className="mt-[3px] flex flex-wrap items-center gap-x-[7px] gap-y-1">
            {error && <Pill tone="danger">{t("syncNotifications.statusError")}</Pill>}
            {sync.isOneTimeImport ? (
              <Pill>{t("externalSync.oneTimeImport")}</Pill>
            ) : sync.autoSyncInterval > 0 ? (
              <Pill tone="success">
                {t("syncSheet.intervalPill", {
                  interval: formatSyncInterval(sync.autoSyncInterval),
                })}
              </Pill>
            ) : (
              <Pill>{t("externalSync.autoSyncManual")}</Pill>
            )}
            {lastSynced && (
              <span
                className="font-mono text-[11.5px] text-fg-tertiary"
                title={lastSynced.toLocaleString(locale)}
              >
                {t("syncSheet.lastSynced", { time: formatLastSync(lastSynced, locale) })}
              </span>
            )}
          </span>
          {error && (
            <span className="mt-1.5 block break-words text-[12px] leading-snug text-danger-body">
              {error}
            </span>
          )}
        </span>
      </button>
      <div className="flex shrink-0 items-center">
        {!sync.isOneTimeImport && (
          <span className={cn("contents", syncing && "[&_svg]:animate-spin")}>
            <RowIconButton
              icon={RefreshCw}
              label={t("syncSheet.syncNow")}
              onClick={onSync}
              disabled={busy || syncing || deleting}
            />
          </span>
        )}
        <span className={cn("contents", deleting && "[&_svg]:animate-pulse")}>
          <RowIconButton
            icon={Trash2}
            label={t("externalSync.delete")}
            tone="danger"
            onClick={onDelete}
            disabled={busy || syncing || deleting}
          />
        </span>
      </div>
    </ListRow>
  );
}
