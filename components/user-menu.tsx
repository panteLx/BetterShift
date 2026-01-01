"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth/client";
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
import { User, LogOut, Users, FileText, Shield } from "lucide-react";
import { toast } from "sonner";
import { CalendarDiscoverySheet } from "@/components/calendar-discovery-sheet";
import { useIsAdmin } from "@/hooks/useAdminAccess";

/**
 * User menu dropdown for authenticated users
 *
 * Shows:
 * - User avatar and name
 * - Profile link
 * - Activity Log link
 * - Admin Panel link (if user is admin)
 * - Browse Calendars
 * - Sign out button
 */
export function UserMenu() {
  const t = useTranslations();
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const isAdmin = useIsAdmin();
  const [discoveryOpen, setDiscoveryOpen] = useState(false);

  if (isLoading || !isAuthenticated || !user) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success(t("auth.logoutSuccess"));
          },
        },
      });
      // Always redirect to login after sign out, regardless of auth method
      router.replace("/login");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error(t("common.error"));
    }
  };

  // Generate initials from name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 sm:h-8 sm:w-8 rounded-full"
        >
          <Avatar className="h-10 w-10 sm:h-8 sm:w-8">
            <AvatarImage src={user.image || undefined} alt={user.name || ""} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {user.name ? (
                getInitials(user.name)
              ) : (
                <User className="h-4 w-4" />
              )}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.replace("/profile")}>
          <User className="mr-2 h-4 w-4" />
          {t("auth.profile")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.replace("/profile/activity")}>
          <FileText className="mr-2 h-4 w-4" />
          {t("activityLog.title")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setDiscoveryOpen(true)}>
          <Users className="mr-2 h-4 w-4" />
          {t("calendar.browseCalendars")}
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.replace("/admin")}>
              <Shield className="mr-2 h-4 w-4" />
              {t("admin.adminPanel")}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t("auth.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>

      <CalendarDiscoverySheet
        open={discoveryOpen}
        onOpenChange={setDiscoveryOpen}
      />
    </DropdownMenu>
  );
}
