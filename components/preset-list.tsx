import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Check, Plus, Settings, ChevronDown, ChevronUp } from "lucide-react";
import { ShiftPreset } from "@/lib/db/schema";
import { CalendarWithCount } from "@/lib/types";
import { getCachedPassword } from "@/lib/password-cache";

interface PresetListProps {
  calendars: CalendarWithCount[];
  calendarId: string;
  presets: ShiftPreset[];
  selectedPresetId?: string;
  onSelectPreset: (presetId: string | undefined) => void;
  onCreateNew: () => void;
  onManageClick: () => void;
  loading?: boolean;
}

export function PresetList({
  calendars,
  calendarId,
  presets,
  selectedPresetId,
  onSelectPreset,
  onCreateNew,
  onManageClick,
  loading = false,
}: PresetListProps) {
  const t = useTranslations();
  const [showSecondary, setShowSecondary] = React.useState(false);

  // Hide preset buttons if calendar is locked AND no valid password is cached
  const selectedCalendar = calendars.find((c) => c.id === calendarId);
  const isCalendarLocked = selectedCalendar?.isLocked === true;
  const hasPassword = calendarId ? !!getCachedPassword(calendarId) : false;
  const shouldHidePresetButtons = isCalendarLocked && !hasPassword;

  const primaryPresets = presets.filter((p) => !p.isSecondary);
  const secondaryPresets = presets.filter((p) => p.isSecondary);

  // Show loading state while fetching
  if (loading) {
    return (
      <div className="border-2 border-dashed rounded-lg p-4 sm:p-6 text-center">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs sm:text-sm font-medium">
            {t("common.loading")}
          </p>
        </div>
      </div>
    );
  }

  // Hide everything if calendar is locked and no password is cached
  if (shouldHidePresetButtons) {
    return null;
  }

  if (presets.length === 0) {
    return (
      <div className="border-2 border-dashed rounded-lg p-4 sm:p-6 text-center space-y-2 sm:space-y-3">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Plus className="h-4 sm:h-5 w-4 sm:w-5" />
          <p className="text-xs sm:text-sm font-medium">
            {t("preset.noPresets")}
          </p>
        </div>
        <p className="text-[10px] sm:text-xs text-muted-foreground max-w-md mx-auto">
          {t("preset.createFirstDescription")}
        </p>
        <Button onClick={onCreateNew} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="text-xs sm:text-sm">
            {t("preset.createYourFirst")}
          </span>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Primary Presets */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        {primaryPresets.map((preset) => (
          <PresetButton
            key={preset.id}
            preset={preset}
            isSelected={selectedPresetId === preset.id}
            onSelect={() =>
              onSelectPreset(
                selectedPresetId === preset.id ? undefined : preset.id
              )
            }
          />
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={onCreateNew}
          className="gap-1 text-xs sm:text-sm px-2 sm:px-3 h-8 sm:h-9"
        >
          <Plus className="h-3 sm:h-4 w-3 sm:w-4" />
          <span className="hidden xs:inline sm:inline">
            {t("preset.create")}
          </span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onManageClick}
          className="h-8 sm:h-9 w-8 sm:w-9 p-0"
        >
          <Settings className="h-3 sm:h-4 w-3 sm:w-4" />
        </Button>
      </div>

      {/* Secondary Presets - Collapsible */}
      {secondaryPresets.length > 0 && (
        <div className="space-y-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSecondary(!showSecondary)}
            className="gap-1 text-xs text-muted-foreground h-6 px-2"
          >
            {showSecondary ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            <span>
              {t("preset.secondaryPresets")} ({secondaryPresets.length})
            </span>
          </Button>
          {showSecondary && (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {secondaryPresets.map((preset) => (
                <PresetButton
                  key={preset.id}
                  preset={preset}
                  isSelected={selectedPresetId === preset.id}
                  onSelect={() =>
                    onSelectPreset(
                      selectedPresetId === preset.id ? undefined : preset.id
                    )
                  }
                  compact
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface PresetButtonProps {
  preset: ShiftPreset;
  isSelected: boolean;
  onSelect: () => void;
  compact?: boolean;
}

function PresetButton({
  preset,
  isSelected,
  onSelect,
  compact,
}: PresetButtonProps) {
  const t = useTranslations();

  if (compact) {
    return (
      <Button
        variant={isSelected ? "default" : "outline"}
        size="sm"
        onClick={onSelect}
        className="relative text-xs sm:text-sm px-2 sm:px-3 h-8 sm:h-9"
        style={{
          backgroundColor: isSelected ? preset.color : undefined,
          borderColor: preset.color,
        }}
      >
        {isSelected && <Check className="mr-1 h-3 w-3" />}
        <span className="font-medium truncate max-w-[80px] sm:max-w-none">
          {preset.title}
        </span>
        <span className="ml-1 text-[10px] sm:text-xs opacity-70">
          {preset.isAllDay ? (
            <span>{t("shift.allDay")}</span>
          ) : (
            <>
              <span className="sm:hidden">{preset.startTime}</span>
              <span className="hidden sm:inline">
                {preset.startTime} - {preset.endTime}
              </span>
            </>
          )}
        </span>
      </Button>
    );
  }

  return (
    <motion.div
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <Button
        variant={isSelected ? "default" : "outline"}
        size="sm"
        onClick={onSelect}
        className="relative text-[11px] sm:text-sm px-2 sm:px-4 h-8 sm:h-10 rounded-full font-semibold transition-all"
        style={{
          backgroundColor: isSelected ? preset.color : undefined,
          borderColor: preset.color,
          borderWidth: "2px",
        }}
      >
        {isSelected && (
          <Check className="mr-1 sm:mr-1.5 h-3 sm:h-3.5 w-3 sm:w-3.5" />
        )}
        <span className="truncate max-w-[80px] sm:max-w-none">
          {preset.title}
        </span>
        <span className="ml-1 sm:ml-1.5 text-[9px] sm:text-xs opacity-80">
          {preset.isAllDay ? (
            <span>{t("shift.allDay")}</span>
          ) : (
            <>
              <span className="sm:hidden">
                {preset.startTime.substring(0, 5)}
              </span>
              <span className="hidden sm:inline">
                {preset.startTime} - {preset.endTime}
              </span>
            </>
          )}
        </span>
      </Button>
    </motion.div>
  );
}

import React from "react";
