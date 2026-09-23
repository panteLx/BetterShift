"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { Check, Copy, Download, Link } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PanelBody, PanelFooter } from "@/components/panel-dialog";
import { ChoiceChips, Field, OptionCards, ToggleRow } from "@/components/form-kit";
import { isRateLimitError, handleRateLimitError } from "@/lib/rate-limit-client";
import { CalendarWithCount } from "@/lib/types";
import { useCalendars } from "@/hooks/useCalendars";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";
import { useCalendarFeedToken } from "@/hooks/useCalendarFeedToken";
import { getDateLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";

type Format = "ics" | "pdf" | "feed";
type Range = "all" | "month" | "year";

/** The "Subscription link" card: create/copy/rotate/revoke a per-calendar ICS feed token. */
function FeedSection({
  feed,
}: {
  feed: ReturnType<typeof useCalendarFeedToken>;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);
  const { feed: data, feedUrl, isMutating, createFeed, revokeFeed } = feed;

  const copyLink = async () => {
    if (!feedUrl) return;
    await navigator.clipboard.writeText(feedUrl);
    toast.success(t("export.feed.copied"));
  };

  if (!data.token) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[13.5px] text-fg-secondary">{t("export.feed.empty")}</p>
        <Button
          className="h-10 gap-2 self-start font-semibold"
          onClick={() => createFeed()}
          disabled={isMutating}
        >
          <Link className="size-4" />
          {t("export.feed.create")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input readOnly value={feedUrl ?? ""} className="h-10 flex-1 font-mono text-[12.5px]" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          aria-label={t("export.feed.copy")}
          title={t("export.feed.copy")}
          onClick={copyLink}
        >
          <Copy className="size-4" />
        </Button>
      </div>
      <p className="text-[12px] text-fg-tertiary">
        {data.lastUsedAt
          ? t("export.feed.lastUsed", {
              date: format(new Date(data.lastUsedAt), "PPp", { locale: getDateLocale(locale) }),
            })
          : t("export.feed.neverUsed")}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="h-10 flex-1 font-semibold"
          onClick={() => setRotateConfirmOpen(true)}
          disabled={isMutating}
        >
          {t("export.feed.rotate")}
        </Button>
        <Button
          variant="destructive"
          className="h-10 flex-1 font-semibold"
          onClick={() => setRevokeConfirmOpen(true)}
          disabled={isMutating}
        >
          {t("export.feed.revoke")}
        </Button>
      </div>
      <p className="text-[12px] text-fg-tertiary">{t("export.feed.securityNote")}</p>

      <ConfirmationDialog
        open={rotateConfirmOpen}
        onOpenChange={setRotateConfirmOpen}
        onConfirm={async () => {
          if (await createFeed()) setRotateConfirmOpen(false);
        }}
        title={t("export.feed.rotateConfirm")}
        description={t("export.feed.rotateConfirmDescription")}
        confirmText={t("export.feed.rotate")}
      />
      <ConfirmationDialog
        open={revokeConfirmOpen}
        onOpenChange={setRevokeConfirmOpen}
        onConfirm={async () => {
          if (await revokeFeed()) setRevokeConfirmOpen(false);
        }}
        title={t("export.feed.revokeConfirm")}
        description={t("export.feed.revokeConfirmDescription")}
        confirmText={t("export.feed.revoke")}
        confirmVariant="destructive"
      />
    </div>
  );
}

function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function ExportPanel({
  calendarId,
  onClose,
}: {
  calendarId: string;
  onClose: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { calendars } = useCalendars();
  const calendar = calendars.find((c) => c.id === calendarId);
  const [selectedFormat, setSelectedFormat] = useState<Format>("ics");
  const [range, setRange] = useState<Range>("all");
  const [month, setMonth] = useState(() => monthValue(new Date()));
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [multi, setMulti] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([calendarId]);
  const [loading, setLoading] = useState(false);

  const { isAuthenticated } = useAuth();
  const { isAuthEnabled } = useAuthFeatures();
  const canUseFeed = isAuthenticated || !isAuthEnabled;
  const feed = useCalendarFeedToken(calendarId, canUseFeed && selectedFormat === "feed");

  const monthOptions = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 25 }, (_, i) => {
      const date = new Date(today.getFullYear(), today.getMonth() + i - 12, 1);
      return {
        value: monthValue(date),
        label: date.toLocaleDateString(locale, { month: "long", year: "numeric" }),
      };
    });
  }, [locale]);
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, i) => String(current - 5 + i));
  }, []);

  const handleExport = async () => {
    if (multi && selectedIds.length === 0) {
      toast.error(t("export.selectAtLeastOne"));
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("locale", locale);
      if (selectedFormat === "pdf") {
        if (range === "month") params.append("month", month);
        if (range === "year") params.append("year", year);
      }
      const url = `/api/export/${selectedFormat}${params.toString() ? `?${params}` : ""}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarIds: multi ? selectedIds : [calendarId] }),
      });

      if (isRateLimitError(response)) {
        await handleRateLimitError(response, t);
        return;
      }
      if (!response.ok) {
        if (response.status === 401) {
          toast.error(t("validation.passwordRequired"));
          return;
        }
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const match = response.headers.get("Content-Disposition")?.match(/filename="(.+)"/);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download =
        match?.[1] ??
        `${(calendar?.name ?? "calendar").replace(/[^a-z0-9]/gi, "_").toLowerCase()}_export.${selectedFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success(t("common.success"));
      onClose();
    } catch (error) {
      console.error("Export error:", error);
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PanelBody>
        <div className="flex flex-col gap-5">
          <Field label={t("export.formatLabel")}>
            <OptionCards<Format>
              value={selectedFormat}
              onChange={setSelectedFormat}
              columns={canUseFeed ? 3 : 2}
              options={[
                { value: "ics", title: t("export.icsFormat"), description: t("export.icsHint") },
                { value: "pdf", title: t("export.pdfFormat"), description: t("export.pdfHint") },
                ...(canUseFeed
                  ? [
                      {
                        value: "feed" as const,
                        title: t("export.feed.title"),
                        description: t("export.feed.hint"),
                      },
                    ]
                  : []),
              ]}
            />
          </Field>

          {selectedFormat === "feed" && <FeedSection feed={feed} />}

          {selectedFormat === "pdf" && (
            <Field label={t("export.rangeLabel")}>
              <ChoiceChips<Range>
                value={range}
                onChange={setRange}
                options={[
                  { value: "all", label: t("export.rangeAll") },
                  { value: "month", label: t("export.rangeMonth") },
                  { value: "year", label: t("export.rangeYear") },
                ]}
              />
              {range === "month" && (
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="h-10 w-full rounded-[9px]" aria-label={t("export.monthLabel")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {range === "year" && (
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="h-10 w-full rounded-[9px]" aria-label={t("export.yearLabel")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          )}

          {selectedFormat !== "feed" && calendars.length > 1 && (
            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <ToggleRow
                id="export-multi"
                title={t("export.multiCalendar")}
                description={t("export.multiCalendarHint")}
                checked={multi}
                onCheckedChange={(checked) => {
                  setMulti(checked);
                  if (checked) setSelectedIds([calendarId]);
                }}
              />
              {multi && (
                <div className="flex flex-col gap-1.5">
                  {calendars.map((c: CalendarWithCount) => {
                    const selected = selectedIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="checkbox"
                        aria-checked={selected}
                        onClick={() =>
                          setSelectedIds((prev) =>
                            prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                          )
                        }
                        className={cn(
                          "flex items-center gap-3 rounded-[10px] border px-3 py-2.5 text-left",
                          selected ? "border-brand bg-surface-today" : "border-line bg-surface-card"
                        )}
                      >
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="flex-1 truncate text-[13.5px] font-medium text-fg-strong">
                          {c.name}
                        </span>
                        <span
                          className={cn(
                            "flex size-5 items-center justify-center rounded-[6px] border",
                            selected ? "border-brand bg-brand text-white" : "border-control"
                          )}
                        >
                          {selected && <Check className="size-3.5" />}
                        </span>
                      </button>
                    );
                  })}
                  <p className="text-[12px] text-fg-tertiary">
                    {t("export.selectedCount", { count: selectedIds.length })}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </PanelBody>
      <PanelFooter>
        <Button variant="outline" className="h-10 flex-1 font-semibold" onClick={onClose} disabled={loading}>
          {selectedFormat === "feed" ? t("common.close") : t("common.cancel")}
        </Button>
        {selectedFormat !== "feed" && (
          <Button className="h-10 flex-1 gap-2 font-semibold" onClick={handleExport} disabled={loading}>
            <Download className="size-4" />
            {loading ? t("common.loading") : t("export.download")}
          </Button>
        )}
      </PanelFooter>
    </>
  );
}
