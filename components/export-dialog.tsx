"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

type Format = "ics" | "pdf";
type Range = "all" | "month" | "year";

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
  const [format, setFormat] = useState<Format>("ics");
  const [range, setRange] = useState<Range>("all");
  const [month, setMonth] = useState(() => monthValue(new Date()));
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [multi, setMulti] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([calendarId]);
  const [loading, setLoading] = useState(false);

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
      if (format === "pdf") {
        params.append("locale", locale);
        if (range === "month") params.append("month", month);
        if (range === "year") params.append("year", year);
      }
      const url = `/api/export/${format}${params.toString() ? `?${params}` : ""}`;
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
        `${(calendar?.name ?? "calendar").replace(/[^a-z0-9]/gi, "_").toLowerCase()}_export.${format}`;
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
              value={format}
              onChange={setFormat}
              options={[
                { value: "ics", title: t("export.icsFormat"), description: t("export.icsHint") },
                { value: "pdf", title: t("export.pdfFormat"), description: t("export.pdfHint") },
              ]}
            />
          </Field>

          {format === "pdf" && (
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

          {calendars.length > 1 && (
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
          {t("common.cancel")}
        </Button>
        <Button className="h-10 flex-1 gap-2 font-semibold" onClick={handleExport} disabled={loading}>
          <Download className="size-4" />
          {loading ? t("common.loading") : t("export.download")}
        </Button>
      </PanelFooter>
    </>
  );
}
