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
import { Download, FileText, Calendar } from "lucide-react";
import { toast } from "sonner";
import { getCachedPassword } from "@/lib/password-cache";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string;
  calendarName: string;
}

export function ExportDialog({
  open,
  onOpenChange,
  calendarId,
  calendarName,
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
    } else {
      // Reset state when dialog closes
      setExportFormat("ics");
      setExportRange("all");
      setSelectedMonth("");
      setSelectedYear("");
      setLoading(false);
    }
  }, [open]);

  const handleExport = async () => {
    setLoading(true);

    try {
      // Get cached password if calendar is protected
      const password = getCachedPassword(calendarId);

      // Build URL
      let url = `/api/calendars/${calendarId}/export/${exportFormat}`;
      const params = new URLSearchParams();

      if (password) {
        params.append("password", password);
      }

      if (exportFormat === "pdf") {
        // Add locale for proper date formatting and translations
        params.append("locale", locale);

        if (exportRange === "month" && selectedMonth) {
          params.append("month", selectedMonth);
        } else if (exportRange === "year" && selectedYear) {
          params.append("year", selectedYear);
        }
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      // Fetch the file
      const response = await fetch(url);

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
      <DialogContent className="sm:max-w-[600px] max-w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0 border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-5 space-y-1.5">
          <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {t("export.title")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("export.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 px-6 pb-6 pt-6">
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
