"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarPlus, Compass, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthHeader } from "@/components/auth-header";
import { CalendarDiscoverySheet } from "@/components/calendar-discovery-sheet";
import { EmptyStateBlock, stateActionClass } from "@/components/empty-state-block";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";

interface EmptyCalendarStateProps {
  onCreateCalendar: () => void;
  showUserMenu?: boolean;
}

export function EmptyCalendarState({
  onCreateCalendar,
  showUserMenu = false,
}: EmptyCalendarStateProps) {
  const t = useTranslations();
  const { isAuthenticated } = useAuth();
  const { isAuthEnabled } = useAuthFeatures();
  const [discoveryOpen, setDiscoveryOpen] = useState(false);

  // Shares and public calendars only exist for signed-in users
  const canDiscover = isAuthEnabled && isAuthenticated;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AuthHeader showUserMenu={showUserMenu} />
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:p-10">
        <EmptyStateBlock
          icon={CalendarPlus}
          tone="brand"
          title={t("emptyState.noCalendarTitle")}
          description={t("emptyState.noCalendarDescription")}
          actions={
            <>
              <Button onClick={onCreateCalendar} className={stateActionClass}>
                <Plus className="size-[17px]" />
                {t("emptyState.createCalendar")}
              </Button>
              {canDiscover && (
                <Button
                  variant="outline"
                  onClick={() => setDiscoveryOpen(true)}
                  className={stateActionClass}
                >
                  <Compass className="size-[17px]" />
                  {t("emptyState.browseShared")}
                </Button>
              )}
            </>
          }
        />
      </main>
      {canDiscover && (
        <CalendarDiscoverySheet open={discoveryOpen} onOpenChange={setDiscoveryOpen} />
      )}
    </div>
  );
}
