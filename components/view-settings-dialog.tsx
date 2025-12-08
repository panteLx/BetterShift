"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Maximize2, FileText, Type } from "lucide-react";

interface ViewSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftsPerDay: number | null;
  externalShiftsPerDay: number | null;
  showShiftNotes: boolean;
  showFullTitles: boolean;
  onShiftsPerDayChange: (count: number | null) => void;
  onExternalShiftsPerDayChange: (count: number | null) => void;
  onShowShiftNotesChange: (show: boolean) => void;
  onShowFullTitlesChange: (show: boolean) => void;
}

export function ViewSettingsDialog({
  open,
  onOpenChange,
  shiftsPerDay,
  externalShiftsPerDay,
  showShiftNotes,
  showFullTitles,
  onShiftsPerDayChange,
  onExternalShiftsPerDayChange,
  onShowShiftNotesChange,
  onShowFullTitlesChange,
}: ViewSettingsDialogProps) {
  const t = useTranslations();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0 border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-5 space-y-1.5">
          <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {t("view.settingsTitle")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("view.settingsDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto flex-1 px-6 py-6">
          {/* Regular Shifts per Day */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Maximize2 className="h-4 w-4 text-primary" />
              <Label className="text-sm font-semibold">
                {t("view.shiftsPerDay")}
              </Label>
            </div>
            <Select
              value={shiftsPerDay === null ? "all" : shiftsPerDay.toString()}
              onValueChange={(value) =>
                onShiftsPerDayChange(value === "all" ? null : parseInt(value))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="8">8</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="all">{t("view.showAll")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("view.shiftsPerDayHint")}
            </p>
          </div>

          {/* External Shifts per Day */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Maximize2 className="h-4 w-4 text-primary" />
              <Label className="text-sm font-semibold">
                {t("view.externalShiftsPerDay")}
              </Label>
            </div>
            <Select
              value={
                externalShiftsPerDay === null
                  ? "all"
                  : externalShiftsPerDay.toString()
              }
              onValueChange={(value) =>
                onExternalShiftsPerDayChange(
                  value === "all" ? null : parseInt(value)
                )
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="8">8</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="all">{t("view.showAll")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("view.externalShiftsPerDayHint")}
            </p>
          </div>

          {/* Show Shift Notes */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <Label className="text-sm font-semibold">
                {t("view.displayOptions")}
              </Label>
            </div>
            <div className="space-y-3 pl-6 border-l-2 border-border/50">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="show-notes"
                  checked={showShiftNotes}
                  onCheckedChange={onShowShiftNotesChange}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1">
                  <Label
                    htmlFor="show-notes"
                    className="text-sm font-medium cursor-pointer"
                  >
                    {t("view.showNotes")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("view.showNotesHint")}
                  </p>
                </div>
              </div>

              {/* Show Full Titles */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="show-full-titles"
                  checked={showFullTitles}
                  onCheckedChange={onShowFullTitlesChange}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1">
                  <Label
                    htmlFor="show-full-titles"
                    className="text-sm font-medium cursor-pointer"
                  >
                    {t("view.showFullTitles")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("view.showFullTitlesHint")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
