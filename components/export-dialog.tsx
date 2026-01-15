"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  isRateLimitError,
  handleRateLimitError,
} from "@/lib/rate-limit-client";
import { Download, FileText, Calendar } from "lucide-react";
import { toast } from "sonner";
import { CalendarWithCount } from "@/lib/types";
import { motion } from "motion/react";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string;
  calendarName: string;
  availableCalendars?: CalendarWithCount[];
}

export function ExportDialog({
  open,
  onOpenChange,
  calendarId,
  calendarName,
  availableCalendars = [],
}: ExportDialogProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [exportFormat, setExportFormat] = useState<"ics" | "pdf">("ics");
  const [exportRange, setExportRange] = useState<"all" | "month" | "year">(
    "all"
  );
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [multiCalendar, setMultiCalendar] = useState(false);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);

  // Generate month options (current month ± 12 months)
  const monthOptions = useMemo(() => {
    const options = [];
    const today = new Date();
    for (let i = -12; i <= 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const value = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;
      const label = date.toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
      });
      options.push({ value, label });
    }
    return options;
  }, [locale]);

  // Generate year options (current year ± 5 years)
  const yearOptions = useMemo(() => {
    const options = [];
    const today = new Date();
    const currentYear = today.getFullYear();
    for (let i = -5; i <= 5; i++) {
      const year = currentYear + i;
      options.push({ value: year.toString(), label: year.toString() });
    }
    return options;
  }, []);

  // Initialize or reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      // Set default selections when dialog opens
      const today = new Date();
      const defaultMonth = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}`;
      const currentYear = today.getFullYear();
      setSelectedMonth(defaultMonth);
      setSelectedYear(currentYear.toString());
      setSelectedCalendarIds([calendarId]); // Pre-select current calendar
    } else {
      // Reset state when dialog closes
      setExportFormat("ics");
      setExportRange("all");
      setSelectedMonth("");
      setSelectedYear("");
      setLoading(false);
      setMultiCalendar(false);
      setSelectedCalendarIds([]);
    }
  }, [open, calendarId]);

  // Handle export action
  const handleExport = async () => {
    // Validate calendar selection for multi-calendar export
    if (multiCalendar && selectedCalendarIds.length === 0) {
      toast.error(t("export.selectAtLeastOne"));
      return;
    }

    setLoading(true);

    try {
      // Unified API endpoint
      const url = `/api/export/${exportFormat}`;
      const params = new URLSearchParams();

      // Add PDF-specific params
      if (exportFormat === "pdf") {
        params.append("locale", locale);
        if (exportRange === "month" && selectedMonth) {
          params.append("month", selectedMonth);
        } else if (exportRange === "year" && selectedYear) {
          params.append("year", selectedYear);
        }
      }

      const urlWithParams = params.toString() ? `${url}?${params}` : url;

      // Determine calendar IDs to export
      const idsToExport = multiCalendar ? selectedCalendarIds : [calendarId];

      const fetchOptions: RequestInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ calendarIds: idsToExport }),
      };

      // Fetch the file
      const response = await fetch(urlWithParams, fetchOptions);

      if (isRateLimitError(response)) {
        await handleRateLimitError(response, t);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        if (response.status === 401) {
          toast.error(t("validation.passwordRequired"));
          setLoading(false);
          return;
        }
        throw new Error("Export failed");
      }

      // Download the file
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;

      // Get filename from Content-Disposition header or create one
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `${calendarName
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase()}_export.${exportFormat}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success(t("common.success"));
      onOpenChange(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="size-5" />
            {t("export.title")}
          </DialogTitle>
          <DialogDescription>{t("export.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Multi-Calendar Export Toggle */}
          {availableCalendars.length > 1 && (
            <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="multi-calendar"
                  checked={multiCalendar}
                  onCheckedChange={(checked) => {
                    setMultiCalendar(checked === true);
                    if (checked) {
                      setSelectedCalendarIds([calendarId]);
                    }
                  }}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1">
                  <Label
                    htmlFor="multi-calendar"
                    className="cursor-pointer font-medium"
                  >
                    {t("export.multiCalendar")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("export.multiCalendarHint")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Calendar Selection (shown when multi-calendar is enabled) */}
          {multiCalendar && availableCalendars.length > 0 && (
            <div className="space-y-2">
              <Label>{t("export.selectCalendars")}</Label>
              <p className="text-xs text-muted-foreground mb-3">
                {t("export.selectCalendarsDescription")}
              </p>
              <div className="max-h-[200px] overflow-y-auto space-y-2 border border-border/50 rounded-md p-3 bg-background/50">
                {availableCalendars.map((calendar) => {
                  const isSelected = selectedCalendarIds.includes(calendar.id);
                  return (
                    <motion.div
                      key={calendar.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedCalendarIds((prev) =>
                          prev.includes(calendar.id)
                            ? prev.filter((id) => id !== calendar.id)
                            : [...prev, calendar.id]
                        );
                      }}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <Checkbox
                        checked={isSelected}
                        className="pointer-events-none"
                      />
                      <div
                        className="w-4 h-4 rounded-full shrink-0"
                        style={{ backgroundColor: calendar.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">
                          {calendar.name}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {t("export.selectedCount", {
                  count: selectedCalendarIds.length,
                })}
              </p>
            </div>
          )}

          {/* Export Format */}
          <div className="space-y-2">
            <Label>{t("export.formatLabel")}</Label>
            <Select
              value={exportFormat}
              onValueChange={(value) => setExportFormat(value as "ics" | "pdf")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ics">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{t("export.icsFormat")}</span>
                  </div>
                </SelectItem>
                <SelectItem value="pdf">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>{t("export.pdfFormat")}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {exportFormat === "ics"
                ? t("export.icsHint")
                : t("export.pdfHint")}
            </p>
          </div>

          {/* Export Range (only for PDF) */}
          {exportFormat === "pdf" && (
            <>
              <div className="space-y-2">
                <Label>{t("export.rangeLabel")}</Label>
                <Select
                  value={exportRange}
                  onValueChange={(value) =>
                    setExportRange(value as "all" | "month" | "year")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("export.rangeAll")}</SelectItem>
                    <SelectItem value="month">
                      {t("export.rangeMonth")}
                    </SelectItem>
                    <SelectItem value="year">
                      {t("export.rangeYear")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Month Selector */}
              {exportRange === "month" && (
                <div className="space-y-2">
                  <Label>{t("export.monthLabel")}</Label>
                  <Select
                    value={selectedMonth}
                    onValueChange={setSelectedMonth}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Year Selector */}
              {exportRange === "year" && (
                <div className="space-y-2">
                  <Label>{t("export.yearLabel")}</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {/* Export Button */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleExport} disabled={loading}>
              <Download className="h-4 w-4 mr-2" />
              {loading ? t("common.loading") : t("export.download")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
