"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LanguageSwitcher } from "@/components/language-switcher";

interface BreadcrumbSegment {
  label: string;
  href?: string;
}

interface AdminHeaderProps {
  onMenuClick?: () => void;
}

/**
 * Admin Panel Header
 *
 * Features:
 * - Automatic breadcrumb navigation from URL
 * - Theme + Language switchers
 * - Mobile menu toggle
 */
export function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const t = useTranslations();
  const pathname = usePathname();

  // Generate breadcrumbs from pathname
  const generateBreadcrumbs = (): BreadcrumbSegment[] => {
    const segments: BreadcrumbSegment[] = [
      { label: t("admin.title"), href: "/admin" },
    ];

    // Parse pathname segments
    const pathParts = pathname.split("/").filter(Boolean);

    // Remove "admin" prefix (already in first segment)
    const adminIndex = pathParts.indexOf("admin");
    if (adminIndex !== -1) {
      pathParts.splice(adminIndex, 1);
    }

    // Map path segments to breadcrumb items
    let currentPath = "/admin";
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      currentPath += `/${part}`;

      // Check if it's the last segment (current page - no link)
      const isLast = i === pathParts.length - 1;

      // Map known segments to translations
      let label = part;
      if (part === "users") {
        label = t("admin.usersMenu");
      } else if (part === "calendars") {
        label = t("admin.calendarsMenu");
      } else if (part === "orphaned") {
        label = t("admin.orphanedCalendars");
      } else if (part === "logs") {
        label = t("admin.auditLogs");
      }

      segments.push({
        label,
        href: isLast ? undefined : currentPath,
      });
    }

    return segments;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
      <div className="p-4 space-y-3">
        {/* Top row: Breadcrumbs + Controls */}
        <div className="flex items-center justify-between gap-4">
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden flex-shrink-0"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Breadcrumbs */}
          <Breadcrumb className="flex-1 min-w-0">
            <BreadcrumbList>
              {breadcrumbs.map((segment, index) => {
                const isLast = index === breadcrumbs.length - 1;

                return (
                  <div key={segment.href || segment.label} className="contents">
                    <BreadcrumbItem>
                      {segment.href ? (
                        <BreadcrumbLink asChild>
                          <Link href={segment.href}>{segment.label}</Link>
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{segment.label}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator />}
                  </div>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>

          {/* Controls: Theme + Language */}
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}
