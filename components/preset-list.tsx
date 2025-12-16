import React from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Check,
  Plus,
  Settings,
  Settings2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { ShiftPreset } from "@/lib/db/schema";
import { CalendarWithCount } from "@/lib/types";
import { getCachedPassword } from "@/lib/password-cache";
import { PresetListSkeleton } from "@/components/preset-list-skeleton";

interface PresetListProps {
  calendars: CalendarWithCount[];
  calendarId: string;
  presets: ShiftPreset[];
  selectedPresetId?: string;
  onSelectPreset: (presetId: string | undefined) => void;
  onCreateNew?: () => void;
  onManageClick?: () => void;
  onViewSettingsClick?: () => void;
  onUnlock?: () => void;
  loading?: boolean;
  hidePresetHeader?: boolean;
  onHidePresetHeaderChange?: (hide: boolean) => void;
}

export function PresetList({
  calendars,
  calendarId,
  presets,
  selectedPresetId,
  onSelectPreset,
  onManageClick,
  onViewSettingsClick,
  onUnlock,
  loading = false,
  hidePresetHeader = false,
  onHidePresetHeaderChange,
}: PresetListProps) {
  const t = useTranslations();
  const [showSecondary, setShowSecondary] = React.useState(false);

  const primaryPresets = presets.filter((p) => !p.isSecondary);
  const secondaryPresets = presets.filter((p) => p.isSecondary);

  // Hide preset buttons if calendar requires password AND no valid password is cached
  const selectedCalendar = calendars.find((c) => c.id === calendarId);
  const requiresPassword = !!selectedCalendar?.passwordHash;
  const hasPassword = calendarId ? !!getCachedPassword(calendarId) : false;
  const isLocked = selectedCalendar?.isLocked === true;
  const shouldHidePresetButtons = requiresPassword && !hasPassword;
  const shouldShowUnlockHint = shouldHidePresetButtons && !isLocked;

  // Show loading state while fetching
  if (loading) {
    return <PresetListSkeleton hidePresetHeader={hidePresetHeader} />;
  }

  // Show unlock hint if calendar requires password and no password is cached (but not locked)
  if (shouldShowUnlockHint) {
    return (
      <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 sm:p-6 text-center space-y-3">
        <div className="flex items-center justify-center gap-2 text-primary">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p className="text-sm font-semibold">
            {t("password.unlockRequired")}
          </p>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          {t("password.unlockRequiredDescription")}
        </p>
        {onUnlock && (
          <Button onClick={onUnlock} size="sm" className="gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </svg>
            <span className="text-xs sm:text-sm">
              {t("password.unlockCalendar")}
            </span>
          </Button>
        )}
      </div>
    );
  }

  // Hide everything if calendar requires password but no password is cached (regardless of unlock hint)
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
        <Button
          onClick={onManageClick}
          size="sm"
          className="gap-2"
          disabled={!onManageClick}
        >
          <Plus className="h-4 w-4" />
          <span className="text-xs sm:text-sm">
            {t("preset.createYourFirst")}
          </span>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Preset Buttons Row */}
      {!hidePresetHeader && (
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
        </div>
      )}

      {/* Secondary Presets - Collapsible */}
      {!hidePresetHeader && secondaryPresets.length > 0 && (
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

      {/* Control Buttons Row */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {!hidePresetHeader && (
          <Button
            variant="outline"
            size="sm"
            onClick={onManageClick}
            disabled={!onManageClick}
            className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-4 h-8 sm:h-9 border-primary/30 hover:border-primary/50 hover:bg-primary/5"
            title={t("preset.manage")}
          >
            <Settings className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
          </Button>
        )}
        <div className="flex-1" />
        {onViewSettingsClick && (
          <Button
            variant="outline"
            size="sm"
            onClick={onViewSettingsClick}
            className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-4 h-8 sm:h-9 border-primary/30 hover:border-primary/50 hover:bg-primary/5"
            title={t("view.settingsTitle")}
          >
            <Settings2 className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
          </Button>
        )}
        {onHidePresetHeaderChange && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onHidePresetHeaderChange(!hidePresetHeader)}
            className="h-8 sm:h-9 w-8 sm:w-9 p-0 text-muted-foreground hover:text-foreground"
            title={
              hidePresetHeader
                ? t("preset.showPresets")
                : t("preset.hidePresets")
            }
          >
            {hidePresetHeader ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
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
