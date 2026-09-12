"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useSignOut } from "@/hooks/useSignOut";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  User,
  LogOut,
  Compass,
  FileText,
  Settings,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import { CalendarDiscoverySheet } from "@/components/calendar-discovery-sheet";
import { ChangelogDialog } from "@/components/changelog-dialog";
import { AppPreferencesMenuItems } from "@/components/app-preferences-menu-items";
import { PhoneMenu } from "@/components/phone-menu";
import { useIsAdmin } from "@/hooks/useAdminAccess";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { getUserInitials } from "@/lib/utils";

interface MenuProps {
  onOpenViewSettings?: () => void;
  /** Phones: opens the page's own settings sheet instead of the built-in one */
  onOpenPhoneMenu?: () => void;
}

/** Avatar menu for signed-in users: a dropdown on desktop, the settings sheet on phones. */
export function UserMenu({ onOpenViewSettings, onOpenPhoneMenu }: MenuProps) {
  const t = useTranslations();
  const handleSignOut = useSignOut();
  const locale = useLocale();
  const router = useRouter();
  const desktop = useMediaQuery(DESKTOP_QUERY, true);
  const { user, isAuthenticated, isLoading } = useAuth();
  const isAdmin = useIsAdmin();
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [phoneMenuOpen, setPhoneMenuOpen] = useState(false);

  if (isLoading || !isAuthenticated || !user) {
    return null;
  }

  if (!desktop) {
    // Gear for settings; the corner avatar says the account lives there too
    return (
      <>
        <button
          type="button"
          onClick={onOpenPhoneMenu ?? (() => setPhoneMenuOpen(true))}
          className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-line text-fg-secondary"
          aria-label={t("appMenu.settingsAndAccount")}
        >
          <Settings className="size-4" />
          <Avatar className="absolute -bottom-1.5 -right-1.5 size-[18px] ring-2 ring-background">
            <AvatarImage src={user.image || undefined} alt="" />
            <AvatarFallback className="bg-fg-secondary text-[9px] font-semibold text-background">
              {user.name ? getUserInitials(user).slice(0, 1) : <User className="size-2.5" />}
            </AvatarFallback>
          </Avatar>
        </button>
        {!onOpenPhoneMenu && <PhoneMenu open={phoneMenuOpen} onOpenChange={setPhoneMenuOpen} />}
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="shrink-0 rounded-full"
            aria-label={t("appMenu.account")}
          >
            <Avatar className="size-8">
              <AvatarImage src={user.image || undefined} alt={user.name || ""} />
              <AvatarFallback className="bg-line text-[12px] font-semibold text-fg-body">
                {user.name ? getUserInitials(user) : <User className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-semibold text-fg-strong">
              {user.name}
            </p>
            <p className="truncate text-xs text-fg-tertiary">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/profile")}>
            <User className="mr-2 h-4 w-4" />
            {t("auth.profile")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/profile?section=activity")}>
            <FileText className="mr-2 h-4 w-4" />
            {t("activityLog.title")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDiscoveryOpen(true)}>
            <Compass className="mr-2 h-4 w-4" />
            {t("calendar.browseCalendars")}
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem onClick={() => router.push("/admin")}>
              <Shield className="mr-2 h-4 w-4" />
              {t("admin.adminPanel")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <AppPreferencesMenuItems
            onOpenChangelog={() => setChangelogOpen(true)}
            onOpenViewSettings={onOpenViewSettings}
          />
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSignOut}
            className="text-danger focus:text-danger"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t("auth.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CalendarDiscoverySheet open={discoveryOpen} onOpenChange={setDiscoveryOpen} />
      <ChangelogDialog
        open={changelogOpen}
        onOpenChange={setChangelogOpen}
        locale={locale}
      />
    </>
  );
}

/** Guests and auth-less instances still need appearance, language and changelog. */
export function GuestMenu({
  showLogin,
  loginOnPhone = true,
  onOpenViewSettings,
  onOpenPhoneMenu,
}: MenuProps & { showLogin: boolean; loginOnPhone?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const desktop = useMediaQuery(DESKTOP_QUERY, true);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [phoneMenuOpen, setPhoneMenuOpen] = useState(false);

  const loginButton = showLogin && (
    <Button asChild size="sm" className="h-9 font-semibold lg:h-8">
      <Link href="/login">{t("auth.login")}</Link>
    </Button>
  );

  if (!desktop) {
    return (
      <>
        <Button
          variant="outline"
          size="icon"
          className="size-9 rounded-lg"
          aria-label={t("settings.title")}
          onClick={onOpenPhoneMenu ?? (() => setPhoneMenuOpen(true))}
        >
          <Settings className="h-4 w-4 text-fg-secondary" />
        </Button>
        {loginOnPhone && loginButton}
        {!onOpenPhoneMenu && <PhoneMenu open={phoneMenuOpen} onOpenChange={setPhoneMenuOpen} />}
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-lg lg:size-8"
            aria-label={t("appMenu.preferences")}
          >
            <SlidersHorizontal className="h-4 w-4 text-fg-secondary" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <AppPreferencesMenuItems
            onOpenChangelog={() => setChangelogOpen(true)}
            onOpenViewSettings={onOpenViewSettings}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      {loginButton}
      <ChangelogDialog
        open={changelogOpen}
        onOpenChange={setChangelogOpen}
        locale={locale}
      />
    </>
  );
}
