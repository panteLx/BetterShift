"use client";

import { AdminSidebar, AdminMobileNav } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { useRequireAdmin } from "@/hooks/useAdminAccess";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import { useAuth } from "@/hooks/useAuth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();
  useRequireAdmin("/");

  if (isLoading) {
    return <FullscreenLoader />;
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <AdminHeader />
      <div className="flex min-h-0 flex-1">
        <AdminSidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">
          {/* Phones: no top padding, each page's AdminPageHeader is the sticky top bar */}
          <div className="mx-auto w-full max-w-[1400px] px-4 pb-6 lg:px-[26px] lg:py-[22px]">{children}</div>
        </main>
      </div>
      <AdminMobileNav />
    </div>
  );
}
