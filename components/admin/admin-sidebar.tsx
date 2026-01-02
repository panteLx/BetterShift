"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  ScrollText,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Crown,
} from "lucide-react";
import { useAdminLevel } from "@/hooks/useAdminAccess";
import { useAuth } from "@/hooks/useAuth";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean; // Only visible for superadmin
}

interface AdminSidebarProps {
  onWidthChange?: (width: number) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

/**
 * Admin Panel Sidebar Navigation
 *
 * Features:
 * - Collapsible (Icons only ↔ Icons + Text)
 * - Active route highlighting
 * - Role-based menu items (superadmin badge)
 * - Mobile responsive
 * - "Back to App" link at bottom
 */
export function AdminSidebar({
  onWidthChange,
  isMobileOpen,
  onMobileClose,
}: AdminSidebarProps) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const adminLevel = useAdminLevel();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isSuperAdmin = adminLevel === "superadmin";
  // Notify parent of width changes
  useEffect(() => {
    onWidthChange?.(isCollapsed ? 80 : 280);
  }, [isCollapsed, onWidthChange]);
  // Navigation items
  const navItems: NavItem[] = [
    {
      label: t("admin.dashboard"),
      href: "/admin",
      icon: LayoutDashboard,
    },
    {
      label: t("admin.usersMenu"),
      href: "/admin/users",
      icon: Users,
    },
    {
      label: t("admin.calendarsMenu"),
      href: "/admin/calendars",
      icon: FolderOpen,
    },
    {
      label: t("admin.auditLogs"),
      href: "/admin/logs",
      icon: ScrollText,
    },
  ];

  const handleNavigation = (href: string) => {
    router.push(href);
    // Close mobile menu after navigation
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      onMobileClose?.();
    }
  };

  const handleBackToApp = () => {
    router.push("/");
    // Close mobile menu after navigation
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      onMobileClose?.();
    }
  };

  // Get user initials for avatar
  const getInitials = (name: string | undefined | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isCollapsed ? "80px" : "280px",
        }}
        style={{
          x:
            typeof window !== "undefined" && window.innerWidth < 1024
              ? isMobileOpen
                ? 0
                : -280
              : 0,
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={cn(
          "fixed left-0 top-0 h-screen",
          "border-r border-border bg-background",
          "flex flex-col",
          "z-50 lg:z-30"
        )}
      >
        {/* Header: User Info + Collapse Toggle */}
        <div className="p-4 flex items-center justify-between gap-2 min-h-[72px]">
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3 min-w-0 flex-1"
              >
                {/* User Avatar */}
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage
                    src={user?.image || undefined}
                    alt={user?.name || ""}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                {/* User Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  {isSuperAdmin && (
                    <Badge
                      variant="default"
                      className="text-xs mt-1 bg-amber-500 hover:bg-amber-600"
                    >
                      <Crown className="w-3 h-3 mr-1" />
                      {t("admin.superadminBadge")}
                    </Badge>
                  )}
                  {!isSuperAdmin && (
                    <Badge
                      variant="secondary"
                      className="text-xs mt-1 bg-orange-500/10 text-orange-500 border-orange-500/20"
                    >
                      {t("common.roles.admin")}
                    </Badge>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapse Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex-shrink-0"
            aria-label={
              isCollapsed
                ? t("admin.expandSidebar")
                : t("admin.collapseSidebar")
            }
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        <Separator />

        {/* Navigation Items */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Button
                key={item.href}
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3",
                  isCollapsed && "justify-center px-0"
                )}
                onClick={() => handleNavigation(item.href)}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <AnimatePresence mode="wait">
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="truncate"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            );
          })}
        </nav>

        <Separator />

        {/* Back to App Link */}
        <div className="p-2">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3",
              isCollapsed && "justify-center px-0"
            )}
            onClick={handleBackToApp}
            title={isCollapsed ? t("admin.backToApp") : undefined}
          >
            <ArrowLeft className="h-5 w-5 flex-shrink-0" />
            <AnimatePresence mode="wait">
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="truncate"
                >
                  {t("admin.backToApp")}
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </div>
      </motion.aside>
    </>
  );
}
