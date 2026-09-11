"use client";

import { ReactNode, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ChevronRight,
  FileText,
  KeyRound,
  Link2,
  MonitorSmartphone,
  TriangleAlert,
  User,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";
import { useConnectedAccounts } from "@/hooks/useConnectedAccounts";
import { useSessions } from "@/hooks/useSessions";
import { useProfileForm } from "@/hooks/useProfileForm";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import { PanelBody } from "@/components/panel-dialog";
import { UserMenu } from "@/components/user-menu";
import { AccountPageHeader } from "@/components/profile/account-layout";
import { ProfileDetailsSection } from "@/components/profile/profile-details-section";
import { PasswordSection } from "@/components/profile/password-section";
import {
  ConnectedAccountsSection,
  useProviderInfo,
} from "@/components/profile/connected-accounts";
import { SessionsSection } from "@/components/profile/sessions-section";
import { DangerSection } from "@/components/profile/danger-section";
import { ActivitySection } from "@/components/profile/activity-section";
import { cn } from "@/lib/utils";

type SectionId = "profile" | "password" | "accounts" | "sessions" | "activity" | "danger";

interface NavItem {
  id: SectionId;
  icon: LucideIcon;
  title: string;
  description: string;
  danger?: boolean;
}

// The URL is the source of truth, so /profile?section=<id> deep-links into a section
const sectionHref = (id: SectionId | null) => (id ? `/profile?section=${id}` : "/profile");

/** "Mein Konto" (screens 11b/11c): section list on desktop, two-level list on phones. */
export default function ProfilePage() {
  return (
    <Suspense fallback={<FullscreenLoader />}>
      <ProfileContent />
    </Suspense>
  );
}

function ProfileContent() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const desktop = useMediaQuery(DESKTOP_QUERY, true);
  const { user, session, isLoading, refetch } = useAuth();
  const { isAuthEnabled } = useAuthFeatures();
  const { accounts, isLoading: accountsLoading } = useConnectedAccounts();
  const {
    sessions,
    isLoading: sessionsLoading,
    revokeAllSessions,
    revokeSession,
  } = useSessions();
  const profileForm = useProfileForm(user, refetch);
  const providerInfo = useProviderInfo();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthEnabled) {
      router.replace("/");
    } else if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isAuthEnabled, isLoading, user, router]);

  // Session refetches after a revoke keep the page mounted
  if (isLoading || accountsLoading || (sessionsLoading && sessions.length === 0)) {
    return <FullscreenLoader />;
  }

  if (!isAuthEnabled || !user) {
    return null;
  }

  const hasPasswordAuth = accounts.some((account) => account.provider === "credential");

  // Unsaved profile edits would be lost when leaving the page
  const leave = (href: string) => {
    if (profileForm.isDirty) setPendingHref(href);
    else router.push(href);
  };

  const accountItems: NavItem[] = [
    {
      id: "profile",
      icon: User,
      title: t("auth.profile"),
      description: t("profile.navProfileHint"),
    },
    ...(hasPasswordAuth
      ? [
          {
            id: "password" as const,
            icon: KeyRound,
            title: t("common.labels.password"),
            description: t("profile.navPasswordHint"),
          },
        ]
      : []),
    {
      id: "accounts",
      icon: Link2,
      title: t("common.auth.connectedAccounts"),
      description:
        accounts.map((account) => providerInfo(account.provider).label).join(", ") ||
        t("auth.noConnectedAccounts"),
    },
  ];
  const securityItems: NavItem[] = [
    {
      id: "sessions",
      icon: MonitorSmartphone,
      title: t("common.auth.activeSessions"),
      description: t("profile.navSessionsHint", { count: sessions.length }),
    },
    {
      id: "activity",
      icon: FileText,
      title: t("activityLog.title"),
      description: t("profile.navActivityHint"),
    },
  ];
  const dangerItem: NavItem = {
    id: "danger",
    icon: TriangleAlert,
    title: t("auth.dangerZone"),
    description: t("profile.navDangerHint"),
    danger: true,
  };
  const items = [...accountItems, ...securityItems, dangerItem];

  const requested = searchParams.get("section");
  const active: SectionId | null =
    items.find((item) => item.id === requested)?.id ?? (desktop ? "profile" : null);
  const activeItem = items.find((item) => item.id === active);

  const renderSection = (id: SectionId) => {
    switch (id) {
      case "profile":
        return (
          <ProfileDetailsSection form={profileForm} canEdit={hasPasswordAuth} accounts={accounts} />
        );
      case "password":
        return <PasswordSection />;
      case "accounts":
        return <ConnectedAccountsSection accounts={accounts} />;
      case "sessions":
        return (
          <SessionsSection
            sessions={sessions}
            currentSessionId={session?.session.id}
            revokeAllSessions={revokeAllSessions}
            revokeSession={revokeSession}
          />
        );
      case "activity":
        return <ActivitySection />;
      case "danger":
        return <DangerSection hasPasswordAuth={hasPasswordAuth} />;
    }
  };

  // Native replaceState syncs useSearchParams without history entries or a server round trip.
  // Profile drafts live in this page, so switching sections needs no unsaved-changes prompt.
  const selectSection = (id: SectionId | null) => {
    window.history.replaceState(null, "", sectionHref(id));
  };

  const renderSidebarItem = (item: NavItem) => {
    const selected = item.id === active;
    const content = (
      <>
        <item.icon
          className={cn(
            "mt-0.5 size-4 shrink-0",
            item.danger ? "text-danger" : selected ? "text-brand-ink" : "text-fg-secondary"
          )}
        />
        <span className="min-w-0">
          <span
            className={cn(
              "block text-[13.5px] font-semibold",
              item.danger ? "text-danger" : selected ? "text-brand-ink" : "text-fg-body"
            )}
          >
            {item.title}
          </span>
          <span
            className={cn(
              "block text-[12px]",
              item.danger ? "text-danger" : selected ? "text-brand-ink/80" : "text-fg-tertiary"
            )}
          >
            {item.description}
          </span>
        </span>
      </>
    );
    const className = cn(
      "flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
      selected
        ? item.danger
          ? "bg-danger-surface shadow-[inset_2px_0_0_var(--danger)]"
          : "bg-brand-soft shadow-[inset_2px_0_0_var(--brand)]"
        : "hover:bg-surface-sunken"
    );

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => selectSection(item.id)}
        aria-current={selected ? "page" : undefined}
        className={className}
      >
        {content}
      </button>
    );
  };

  const renderListRow = (item: NavItem) => {
    const content = (
      <>
        <item.icon
          className={cn("size-[18px] shrink-0", item.danger ? "text-danger" : "text-fg-secondary")}
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-[14.5px]",
              item.danger ? "font-semibold text-danger" : "text-fg-strong"
            )}
          >
            {item.title}
          </span>
          <span
            className={cn(
              "block truncate text-[12px]",
              item.danger ? "text-danger-body" : "text-fg-tertiary"
            )}
          >
            {item.description}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-fg-tertiary" />
      </>
    );
    const className = "flex w-full items-center gap-3 px-3.5 py-3 text-left";

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => selectSection(item.id)}
        className={className}
      >
        {content}
      </button>
    );
  };

  const renderGroup = (label: string | null, groupItems: NavItem[], danger = false): ReactNode => (
    <section key={label ?? "danger"}>
      {label && <div className="eyebrow mb-2 px-1">{label}</div>}
      <div
        className={cn(
          "divide-y overflow-hidden rounded-[12px] border",
          danger
            ? "divide-danger-line border-danger-line bg-danger-surface"
            : "divide-line-subtle border-line bg-surface-card"
        )}
      >
        {groupItems.map(renderListRow)}
      </div>
    </section>
  );

  const inSection = !desktop && !!active;

  return (
    <div className="flex h-dvh flex-col bg-background">
      <AccountPageHeader
        title={inSection && activeItem ? activeItem.title : t("profile.title")}
        subtitle={inSection && activeItem ? activeItem.description : user.email}
        onBack={inSection ? () => selectSection(null) : () => leave("/")}
        actions={<UserMenu />}
      />

      <div className="flex min-h-0 flex-1">
        {desktop && (
          <nav className="flex w-[278px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-surface-panel p-2.5">
            {items.map(renderSidebarItem)}
          </nav>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          {active ? (
            <div key={active} className="flex min-h-0 flex-1 flex-col">
              {renderSection(active)}
            </div>
          ) : (
            <PanelBody className="bg-surface-panel px-4">
              <div className="flex flex-col gap-5">
                {renderGroup(t("profile.groupAccount"), accountItems)}
                {renderGroup(t("profile.groupSecurity"), securityItems)}
                {renderGroup(null, [dangerItem], true)}
              </div>
            </PanelBody>
          )}
        </main>
      </div>

      <ConfirmationDialog
        open={!!pendingHref}
        onOpenChange={(open) => !open && setPendingHref(null)}
        onConfirm={() => {
          const href = pendingHref;
          setPendingHref(null);
          profileForm.discard();
          if (href) router.push(href);
        }}
      />
    </div>
  );
}
