"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Users, Shield, Link as LinkIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarShareList } from "@/components/calendar-share-list";
import { CalendarTokenList } from "@/components/calendar-token-list";
import { GuestPermissionSelector } from "@/components/guest-permission-selector";
import { useCalendars } from "@/hooks/useCalendars";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";

interface CalendarShareManagementSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string;
  calendarName: string;
  calendarGuestPermission?: "none" | "read" | "write";
  canManageShares: boolean; // owner/admin permission
}

export function CalendarShareManagementSheet({
  open,
  onOpenChange,
  calendarId,
  calendarName,
  calendarGuestPermission = "none",
  canManageShares,
}: CalendarShareManagementSheetProps) {
  const t = useTranslations();
  const { updateCalendar } = useCalendars();
  const { isAuthEnabled } = useAuthFeatures();

  const [activeTab, setActiveTab] = useState("users");
  const [optimisticGuestPermission, setOptimisticGuestPermission] = useState<
    "none" | "read" | "write" | null
  >(null);
  const [saving, setSaving] = useState(false);

  // Use optimistic value during save, otherwise use prop value
  // This avoids calling setState in an effect and potential cascading renders
  const guestPermission = optimisticGuestPermission ?? calendarGuestPermission;

  // Show public access tab when auth is enabled (allows sharing with authenticated users via guestPermission)
  // This is separate from allowGuest which controls unauthenticated access
  const showGuestTab = isAuthEnabled;

  const handleGuestPermissionChange = async (
    value: "none" | "read" | "write"
  ) => {
    if (!canManageShares) return;

    setOptimisticGuestPermission(value);
    setSaving(true);

    await updateCalendar(calendarId, {
      guestPermission: value,
    });

    setSaving(false);
    setOptimisticGuestPermission(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[700px] p-0 flex flex-col gap-0 border-l border-border/50 overflow-hidden"
      >
        <SheetHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-5 space-y-1.5">
          <SheetTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("share.manageSharing")}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {t("share.manageSharingDescription", { name: calendarName })}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="h-full"
          >
            <div className="border-b border-border/50 px-6 pt-4">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="users" className="gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {t("share.userShares")}
                  </span>
                  <span className="sm:hidden">{t("common.labels.users")}</span>
                </TabsTrigger>
                {showGuestTab && (
                  <TabsTrigger value="public" className="gap-2">
                    <Shield className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {t("share.publicAccess")}
                    </span>
                    <span className="sm:hidden">{t("share.public")}</span>
                  </TabsTrigger>
                )}
                <TabsTrigger value="links" className="gap-2">
                  <LinkIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {t("share.accessLinks")}
                  </span>
                  <span className="sm:hidden">{t("share.links")}</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="px-6 py-6">
              {/* User Shares Tab */}
              <TabsContent value="users" className="mt-0 space-y-0">
                <CalendarShareList
                  calendarId={calendarId}
                  canManageShares={canManageShares}
                />
              </TabsContent>

              {/* Public Access Tab */}
              {showGuestTab && (
                <TabsContent value="public" className="mt-0 space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-1">
                      {t("share.publicAccess")}
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      {t("share.publicAccessDescription")}
                    </p>
                  </div>

                  <GuestPermissionSelector
                    value={guestPermission}
                    onChange={handleGuestPermissionChange}
                    idPrefix="share-management"
                  />

                  {saving && (
                    <p className="text-xs text-muted-foreground italic">
                      {t("common.saving")}
                    </p>
                  )}
                </TabsContent>
              )}

              {/* Access Links Tab */}
              <TabsContent value="links" className="mt-0">
                <CalendarTokenList calendarId={calendarId} />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <SheetFooter className="border-t border-border/50 bg-muted/20 px-6 py-4 mt-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 border-border/50 hover:bg-muted/50"
          >
            {t("common.cancel")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
