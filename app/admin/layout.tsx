"use client";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { useRequireAdmin } from "@/hooks/useAdminAccess";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import { useAuth } from "@/hooks/useAuth";

/**
 * Admin Panel Layout
 *
 * Features:
 * - Custom layout wrapper for all admin pages
 * - Includes AdminSidebar (collapsible) and AdminHeader (breadcrumbs)
 * - Access control: Redirects non-admins to home page
 * - Responsive design with sidebar + main content area
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading } = useAuth();

  // Require admin access (redirects non-admins)
  useRequireAdmin("/");

  // Show loader while checking auth
  if (isLoading) {
    return <FullscreenLoader />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar Navigation */}
      <AdminSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden ml-[80px] lg:ml-[280px] transition-all duration-300">
        {/* Header */}
        <AdminHeader />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-7xl mx-auto p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
