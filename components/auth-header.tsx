"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays } from "lucide-react";
import { GuestMenu, UserMenu } from "@/components/user-menu";
import { InfoDialog } from "@/components/info-dialog";
import { Pill } from "@/components/form-kit";
import { UpdatePill } from "@/components/app-header";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";
import { useVersionUpdateCheck } from "@/hooks/useVersionUpdate";

interface AuthHeaderProps {
  /** Right-hand controls: account menu when signed in, preferences and login for guests. */
  showUserMenu?: boolean;
}

/** Minimal 56px app header for pages without a calendar. */
export function AuthHeader({ showUserMenu = false }: AuthHeaderProps) {
  const t = useTranslations();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-background px-4 lg:px-[18px]">
      <Link href="/" className="flex min-w-0 items-center gap-3">
        <span className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-brand">
          <CalendarDays className="size-[15px] text-white" />
        </span>
        <span className="truncate text-[15px] font-semibold text-fg-strong">
          {t("app.title")}
        </span>
      </Link>
      {/* Session lookups stay out of pages that only need the brand, e.g. while the DB is down */}
      {showUserMenu && <HeaderSessionControls />}
    </header>
  );
}

function HeaderSessionControls() {
  const t = useTranslations();
  const locale = useLocale();
  const { isGuest } = useAuth();
  const { isAuthEnabled } = useAuthFeatures();
  const { versionInfo, showUpdate, dismissUpdate } = useVersionUpdateCheck();
  const [showChangelog, setShowChangelog] = useState(false);

  const signedIn = isAuthEnabled && !isGuest;

  return (
    <>
      {isGuest && (
        <Pill className="text-[11px] uppercase tracking-[0.04em]">
          {t("emptyState.guestBadge")}
        </Pill>
      )}
      <div className="flex-1" />
      {showUpdate && (
        <UpdatePill
          version={versionInfo?.latestVersion || ""}
          onShowChangelog={() => setShowChangelog(true)}
          onDismiss={dismissUpdate}
          className="hidden sm:flex"
        />
      )}
      {signedIn ? <UserMenu /> : <GuestMenu showLogin={isAuthEnabled} />}
      <InfoDialog
        open={showChangelog}
        onOpenChange={setShowChangelog}
        locale={locale}
        defaultTab="changelog"
      />
    </>
  );
}
