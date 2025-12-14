import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { CalendarWithCount } from "@/lib/types";
import { CalendarSelector } from "@/components/calendar-selector";
import { PresetSelector } from "@/components/preset-selector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Calendar as CalendarIcon,
  Plus,
  Bell,
  ExternalLink,
} from "lucide-react";
import { ShiftPreset } from "@/lib/db/schema";
import { useVersionUpdateCheck } from "@/hooks/useVersionUpdate";
import { ChangelogDialog } from "@/components/changelog-dialog";
import { useLocale } from "next-intl";

interface AppHeaderProps {
  calendars: CalendarWithCount[];
  selectedCalendar: string | undefined;
  presets: ShiftPreset[];
  selectedPresetId: string | undefined;
  isConnected: boolean;
  showMobileCalendarDialog: boolean;
  hasSyncErrors?: boolean;
  onSelectCalendar: (id: string) => void;
  onSelectPreset: (id: string | undefined) => void;
  onCreateCalendar: () => void;
  onManagePassword: () => void;
  onExternalSync: () => void;
  onSyncNotifications: () => void;
  onPresetsChange: () => void;
  onShiftsChange: () => void;
  onStatsRefresh: () => void;
  onPasswordRequired: (action: () => Promise<void>) => void;
  onManualShiftCreation: () => void;
  onMobileCalendarDialogChange: (open: boolean) => void;
  onViewSettingsClick: () => void;
  presetsLoading?: boolean;
}

export function AppHeader({
  calendars,
  selectedCalendar,
  presets,
  selectedPresetId,
  isConnected,
  showMobileCalendarDialog,
  hasSyncErrors = false,
  onSelectCalendar,
  onSelectPreset,
  onCreateCalendar,
  onManagePassword,
  onExternalSync,
  onSyncNotifications,
  onPresetsChange,
  onShiftsChange,
  onStatsRefresh,
  onPasswordRequired,
  onManualShiftCreation,
  onMobileCalendarDialogChange,
  onViewSettingsClick,
  presetsLoading = false,
}: AppHeaderProps) {
  const t = useTranslations();
  const locale = useLocale();
  const { versionInfo } = useVersionUpdateCheck();
  const [showChangelog, setShowChangelog] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
        <div className="container max-w-4xl mx-auto p-3 sm:p-4">
          <div className="space-y-3 sm:space-y-4">
            {/* Desktop: Logo + Calendar Selector in one line */}
            <div className="hidden sm:flex items-center justify-between gap-4">
              {/* Logo Section */}
              <motion.div
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 flex items-center justify-center shadow-xl shadow-primary/30 ring-2 ring-primary/20">
                    <CalendarIcon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  {/* Connection Status Indicator */}
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-background transition-colors ${
                      isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
                    }`}
                    title={
                      isConnected
                        ? t("sync.reconnected")
                        : t("sync.disconnected")
                    }
                  ></div>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text">
                    {t("app.title")}
                  </h1>
                  <p className="text-xs text-muted-foreground font-medium">
                    {t("app.subtitle", { default: "Organize your shifts" })}
                  </p>
                </div>
              </motion.div>

              {/* Calendar Selector - Desktop */}
              <motion.div
                className="flex items-center gap-3 min-w-0 flex-1 max-w-md bg-muted/30 rounded-xl p-2 border border-border/50"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <div
                  className="w-1 h-8 bg-gradient-to-b rounded-full transition-colors duration-300"
                  style={{
                    backgroundImage: selectedCalendar
                      ? `linear-gradient(to bottom, ${
                          calendars.find((c) => c.id === selectedCalendar)
                            ?.color || "hsl(var(--primary))"
                        }, ${
                          calendars.find((c) => c.id === selectedCalendar)
                            ?.color || "hsl(var(--primary))"
                        }80)`
                      : "linear-gradient(to bottom, hsl(var(--primary)), hsl(var(--primary) / 0.5))",
                  }}
                ></div>
                <div className="flex-1 min-w-0">
                  <CalendarSelector
                    calendars={calendars}
                    selectedId={selectedCalendar}
                    onSelect={onSelectCalendar}
                    onCreateNew={onCreateCalendar}
                    onManagePassword={onManagePassword}
                    onExternalSync={onExternalSync}
                    onSyncNotifications={onSyncNotifications}
                    hasSyncErrors={hasSyncErrors}
                  />
                </div>
              </motion.div>
            </div>

            {/* Update Notification Banner - Desktop & Mobile */}
            {versionInfo?.hasUpdate && !versionInfo.isDev && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                className="relative"
              >
                <button
                  onClick={() => setShowChangelog(true)}
                  className="w-full bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 backdrop-blur-sm border border-primary/30 rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:from-primary/15 hover:via-primary/10 hover:to-primary/15 hover:border-primary/40 transition-all shadow-sm hover:shadow-md active:scale-[0.99] group"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                    <div className="relative shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                      <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-primary group-hover:scale-110 transition-transform" />
                      <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full animate-pulse shadow-sm"></div>
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-sm sm:text-base font-semibold text-primary mb-0.5">
                        {t("update.available")}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                        {t("update.newVersion", {
                          version: versionInfo.latestVersion || "unknown",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2 text-primary">
                    <span className="text-xs sm:text-sm font-medium hidden sm:inline">
                      {t("update.viewChangelog")}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                      <ExternalLink className="h-4 w-4 group-hover:rotate-12 transition-transform" />
                    </div>
                  </div>
                </button>
              </motion.div>
            )}

            {/* Mobile: Logo Icon + Calendar Card + Add Button */}
            <div className="sm:hidden flex items-center gap-2">
              {/* Logo Icon Only */}
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30 ring-2 ring-primary/20">
                  <CalendarIcon className="h-5 w-5 text-primary-foreground" />
                </div>
                {/* Connection Status Indicator */}
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background transition-colors ${
                    isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
                  }`}
                  title={
                    isConnected ? t("sync.reconnected") : t("sync.disconnected")
                  }
                ></div>
              </div>

              {/* Calendar Selection Card */}
              <button
                onClick={() => onMobileCalendarDialogChange(true)}
                className="flex-1 bg-muted/30 backdrop-blur-sm border border-border/50 rounded-xl p-3 flex items-center justify-between gap-2 hover:bg-accent/50 transition-all active:scale-[0.98] shadow-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className="w-1 h-9 bg-gradient-to-b rounded-full transition-colors duration-300"
                    style={{
                      backgroundImage: selectedCalendar
                        ? `linear-gradient(to bottom, ${
                            calendars.find((c) => c.id === selectedCalendar)
                              ?.color || "hsl(var(--primary))"
                          }, ${
                            calendars.find((c) => c.id === selectedCalendar)
                              ?.color || "hsl(var(--primary))"
                          }80)`
                        : "linear-gradient(to bottom, hsl(var(--primary)), hsl(var(--primary) / 0.5))",
                    }}
                  ></div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-[10px] text-muted-foreground font-medium">
                      {t("calendar.select", {
                        default: "Your BetterShift Calendar",
                      })}
                    </p>
                    <p className="text-sm font-semibold truncate">
                      {calendars.find((c) => c.id === selectedCalendar)?.name ||
                        t("calendar.title")}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                </div>
              </button>

              {/* Mobile Add Shift Button */}
              {selectedCalendar && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                  <Button
                    size="icon"
                    onClick={onManualShiftCreation}
                    className="h-10 w-10 rounded-xl shadow-lg shadow-primary/30 shrink-0"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </motion.div>
              )}
            </div>

            {/* Preset Selector */}
            {selectedCalendar && (
              <div className="px-0.5 sm:px-0">
                <PresetSelector
                  calendars={calendars}
                  presets={presets}
                  selectedPresetId={selectedPresetId}
                  onSelectPreset={onSelectPreset}
                  onPresetsChange={onPresetsChange}
                  onShiftsChange={onShiftsChange}
                  onStatsRefresh={onStatsRefresh}
                  calendarId={selectedCalendar}
                  onPasswordRequired={onPasswordRequired}
                  onViewSettingsClick={onViewSettingsClick}
                  loading={presetsLoading}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Calendar Dialog */}
      <Dialog
        open={showMobileCalendarDialog}
        onOpenChange={onMobileCalendarDialogChange}
      >
        <DialogContent className="sm:max-w-md p-0 gap-0 border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl">
          <DialogHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-5 space-y-1.5">
            <DialogTitle className="flex items-center gap-2.5 text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              <div className="w-1 h-5 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
              {t("calendar.select", { default: "Your BetterShift Calendar" })}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {t("calendar.selectDescription", {
                default: "Choose a calendar to manage your shifts",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            <CalendarSelector
              calendars={calendars}
              selectedId={selectedCalendar}
              onSelect={(id) => {
                onSelectCalendar(id);
                onMobileCalendarDialogChange(false);
              }}
              onCreateNew={() => {
                onMobileCalendarDialogChange(false);
                onCreateCalendar();
              }}
              onManagePassword={() => {
                onMobileCalendarDialogChange(false);
                onManagePassword();
              }}
              onExternalSync={() => {
                onMobileCalendarDialogChange(false);
                onExternalSync();
              }}
              onSyncNotifications={() => {
                onMobileCalendarDialogChange(false);
                onSyncNotifications();
              }}
              hasSyncErrors={hasSyncErrors}
              variant="mobile"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Changelog Dialog */}
      <ChangelogDialog
        open={showChangelog}
        onOpenChange={setShowChangelog}
        locale={locale}
      />
    </>
  );
}
