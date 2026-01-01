"use client";

import { useState, useEffect } from "react";
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
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Require admin access (redirects non-admins)
  useRequireAdmin("/");

  // Listen for sidebar width changes
  useEffect(() => {
    const handleResize = () => {
      // Mobile: 0px (hidden), Desktop: Check if collapsed (80px) or expanded (280px)
      if (window.innerWidth < 1024) {
        setSidebarWidth(0);
      } else {
        setSidebarWidth(280); // Default to expanded on desktop
      }
    };

    handleResize(); // Initial check
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Show loader while checking auth
  if (isLoading) {
    return <FullscreenLoader />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar Navigation */}
      <AdminSidebar
        onWidthChange={setSidebarWidth}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className="flex-1 flex flex-col overflow-hidden transition-all duration-300"
        style={{
          marginLeft:
            typeof window !== "undefined" && window.innerWidth >= 1024
              ? `${sidebarWidth}px`
              : "0",
        }}
      >
        {/* Header */}
        <AdminHeader onMenuClick={() => setIsMobileSidebarOpen(true)} />

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
