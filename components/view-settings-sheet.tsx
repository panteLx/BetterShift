"use client";

import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Maximize2,
  FileText,
  Infinity,
  ArrowUpDown,
  Highlighter,
} from "lucide-react";
import { PRESET_COLORS } from "@/lib/constants";

interface ViewSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftsPerDay: number | null;
  externalShiftsPerDay: number | null;
  showShiftNotes: boolean;
  showFullTitles: boolean;
  shiftSortType: "startTime" | "createdAt" | "title";
  shiftSortOrder: "asc" | "desc";
  combinedSortMode: boolean;
  highlightWeekends: boolean;
  highlightedWeekdays: number[];
  highlightColor: string;
  onShiftsPerDayChange: (count: number | null) => void;
  onExternalShiftsPerDayChange: (count: number | null) => void;
  onShowShiftNotesChange: (show: boolean) => void;
  onShowFullTitlesChange: (show: boolean) => void;
  onShiftSortTypeChange: (type: "startTime" | "createdAt" | "title") => void;
  onShiftSortOrderChange: (order: "asc" | "desc") => void;
  onCombinedSortModeChange: (combined: boolean) => void;
  onHighlightWeekendsChange: (highlight: boolean) => void;
  onHighlightedWeekdaysChange: (days: number[]) => void;
  onHighlightColorChange: (color: string) => void;
}

export function ViewSettingsSheet({
  open,
  onOpenChange,
  shiftsPerDay,
  externalShiftsPerDay,
  showShiftNotes,
  showFullTitles,
  shiftSortType,
  shiftSortOrder,
  combinedSortMode,
  highlightWeekends,
  highlightedWeekdays,
  highlightColor,
  onShiftsPerDayChange,
  onExternalShiftsPerDayChange,
  onShowShiftNotesChange,
  onShowFullTitlesChange,
  onShiftSortTypeChange,
  onShiftSortOrderChange,
  onCombinedSortModeChange,
  onHighlightWeekendsChange,
  onHighlightedWeekdaysChange,
  onHighlightColorChange,
}: ViewSettingsSheetProps) {
  const t = useTranslations();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[600px] p-0 flex flex-col gap-0 border-l border-border/50 overflow-hidden"
      >
        <SheetHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-5 space-y-1.5">
          <SheetTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {t("view.settingsTitle")}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {t("view.settingsDescription")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Regular Shifts per Day */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Maximize2 className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">
                  {t("view.shiftsPerDay")}
                </Label>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/20">
                {shiftsPerDay === null ? (
                  <>
                    <Infinity className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">
                      {t("view.showAll")}
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-semibold text-primary">
                    {shiftsPerDay}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <Slider
                value={[shiftsPerDay === null ? 11 : shiftsPerDay]}
                onValueChange={(value: number[]) =>
                  onShiftsPerDayChange(value[0] === 11 ? null : value[0])
                }
                min={1}
                max={11}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>1</span>
                <span>{t("view.showAll")}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("view.shiftsPerDayHint")}
            </p>
          </div>

          {/* External Shifts per Day */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Maximize2 className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">
                  {t("view.externalShiftsPerDay")}
                </Label>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/20">
                {externalShiftsPerDay === null ? (
                  <>
                    <Infinity className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">
                      {t("view.showAll")}
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-semibold text-primary">
                    {externalShiftsPerDay}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <Slider
                value={[
                  externalShiftsPerDay === null ? 11 : externalShiftsPerDay,
                ]}
                onValueChange={(value: number[]) =>
                  onExternalShiftsPerDayChange(
                    value[0] === 11 ? null : value[0]
                  )
                }
                min={1}
                max={11}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>1</span>
                <span>{t("view.showAll")}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("view.externalShiftsPerDayHint")}
            </p>
          </div>

          {/* Shift Sorting */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-primary" />
              <Label className="text-sm font-semibold">
                {t("view.sortOptions")}
              </Label>
            </div>
            <div className="space-y-3 pl-6 border-l-2 border-border/50">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {t("view.sortBy")}
                </Label>
                <Select
                  value={shiftSortType}
                  onValueChange={onShiftSortTypeChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="startTime">
                      {t("view.sortByStartTime")}
                    </SelectItem>
                    <SelectItem value="createdAt">
                      {t("view.sortByCreatedAt")}
                    </SelectItem>
                    <SelectItem value="title">
                      {t("view.sortByTitle")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {t("view.sortOrder")}
                </Label>
                <Select
                  value={shiftSortOrder}
                  onValueChange={onShiftSortOrderChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">
                      {t("view.sortOrderAsc")}
                    </SelectItem>
                    <SelectItem value="desc">
                      {t("view.sortOrderDesc")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start gap-3 pt-2">
                <Checkbox
                  id="combined-sort"
                  checked={combinedSortMode}
                  onCheckedChange={(checked: boolean) =>
                    onCombinedSortModeChange(checked)
                  }
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1">
                  <Label
                    htmlFor="combined-sort"
                    className="text-sm font-medium cursor-pointer"
                  >
                    {t("view.combinedSort")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("view.combinedSortHint")}
                  </p>
                </div>
              </div>
            </div>
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
                  onCheckedChange={(checked: boolean) =>
                    onShowShiftNotesChange(checked)
                  }
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
                  onCheckedChange={(checked: boolean) =>
                    onShowFullTitlesChange(checked)
                  }
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

          {/* Day Highlighting */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Highlighter className="h-4 w-4 text-primary" />
              <Label className="text-sm font-semibold">
                {t("view.dayHighlighting")}
              </Label>
            </div>
            <div className="space-y-4 pl-6 border-l-2 border-border/50">
              {/* Quick Toggle: Weekends */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="highlight-weekends"
                  checked={highlightWeekends}
                  onCheckedChange={(checked: boolean) => {
                    onHighlightWeekendsChange(checked);
                    if (checked) {
                      // Add Saturday (6) and Sunday (0) to existing weekdays
                      const newDays = Array.from(
                        new Set([...highlightedWeekdays, 0, 6])
                      ).sort((a, b) => a - b);
                      onHighlightedWeekdaysChange(newDays);
                    } else {
                      // Remove Saturday and Sunday, keep other weekdays
                      const filtered = highlightedWeekdays.filter(
                        (d) => d !== 0 && d !== 6
                      );
                      onHighlightedWeekdaysChange(filtered);
                    }
                  }}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1">
                  <Label
                    htmlFor="highlight-weekends"
                    className="text-sm font-medium cursor-pointer"
                  >
                    {t("view.highlightWeekends")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("view.highlightWeekendsHint")}
                  </p>
                </div>
              </div>

              {/* Custom Weekdays */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {t("view.customWeekdays")}
                </Label>
                <div className="grid grid-cols-7 gap-1">
                  {[
                    { day: 1, label: t("view.monday") },
                    { day: 2, label: t("view.tuesday") },
                    { day: 3, label: t("view.wednesday") },
                    { day: 4, label: t("view.thursday") },
                    { day: 5, label: t("view.friday") },
                    { day: 6, label: t("view.saturday") },
                    { day: 0, label: t("view.sunday") },
                  ].map(({ day, label }) => {
                    const isSelected = highlightedWeekdays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const newDays = isSelected
                            ? highlightedWeekdays.filter((d) => d !== day)
                            : [...highlightedWeekdays, day];
                          onHighlightedWeekdaysChange(newDays);

                          // Update weekends toggle state
                          const hasWeekends =
                            newDays.includes(0) && newDays.includes(6);
                          if (hasWeekends !== highlightWeekends) {
                            onHighlightWeekendsChange(hasWeekends);
                          }
                        }}
                        className={`
                          px-1 py-2 text-xs font-medium rounded-md transition-all border-2
                          ${
                            isSelected
                              ? "bg-primary/20 border-primary text-primary"
                              : "bg-muted/30 border-border/30 text-muted-foreground hover:bg-muted/50"
                          }
                        `}
                        title={label}
                      >
                        {label.substring(0, 2)}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("view.customWeekdaysHint")}
                </p>
              </div>

              {/* Highlight Color */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {t("view.highlightColor")}
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => onHighlightColorChange(color.value)}
                      className={`
                        h-10 rounded-lg border-2 transition-all
                        ${
                          highlightColor === color.value
                            ? "border-foreground ring-2 ring-foreground/20 scale-105"
                            : "border-border/30 hover:border-border"
                        }
                      `}
                      style={{
                        backgroundColor: `${color.value}20`,
                      }}
                      title={color.name}
                    >
                      <div
                        className="h-4 w-4 rounded-full mx-auto"
                        style={{ backgroundColor: color.value }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
