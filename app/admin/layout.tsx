"use client";

import { AdminSidebar, AdminMobileNav } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { useRequireAdminScope } from "@/hooks/useAdminAccess";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import { useAuth } from "@/hooks/useAuth";
import { useAdminScope } from "@/hooks/useAdminScope";
import { ScopeBadge } from "@/components/admin/scope-badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { TelemetryConsentGate } from "@/components/telemetry-consent-gate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isLoading: authLoading } = useAuth();
  const t = useTranslations();
  const { isLoading: scopeLoading, isError: scopeError, refetch, scope } = useAdminScope();
  const isLoading = authLoading || scopeLoading;
  useRequireAdminScope("/");

  if (isLoading) {
    return <FullscreenLoader />;
  }

  if (scopeError) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <p className="text-sm text-fg-secondary">{t("common.fetchError", { item: t("admin.title") })}</p>
        <Button variant="outline" onClick={() => void refetch()}>
          {t("calendarView.retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <AdminHeader />
      <div className="flex min-h-0 flex-1">
        <AdminSidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="flex px-4 pt-3 lg:hidden">
            <ScopeBadge />
          </div>
          {/* Phones: no top padding, each page's AdminPageHeader is the sticky top bar */}
          <div className="mx-auto w-full max-w-[1400px] px-4 pb-6 lg:px-[26px] lg:py-[22px]">{children}</div>
        </main>
      </div>
      <AdminMobileNav />
      {scope === "global" && <TelemetryConsentGate />}
    </div>
  );
}
