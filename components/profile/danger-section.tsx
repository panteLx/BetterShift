"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { DangerZone, Field, inputClass, ListRow } from "@/components/form-kit";
import { PanelBody } from "@/components/panel-dialog";
import { accountContentClass } from "@/components/profile/account-layout";
import { useSignOut } from "@/hooks/useSignOut";
import { signOut } from "@/lib/auth/client";
import {
  isRateLimitError,
  handleRateLimitError,
} from "@/lib/rate-limit-client";
import { cn } from "@/lib/utils";

export function DangerSection({ hasPasswordAuth }: { hasPasswordAuth: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const handleSignOut = useSignOut();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      // Custom endpoint so foreign keys are cleaned up before the user row goes
      const response = await fetch("/api/auth/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: hasPasswordAuth ? JSON.stringify({ password: deletePassword }) : undefined,
      });

      if (isRateLimitError(response)) {
        await handleRateLimitError(response, t);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || t("common.error"));
        return;
      }

      toast.success(t("auth.accountDeleted"));
      setShowDeleteDialog(false);
      setDeletePassword("");

      await signOut();
      router.replace("/");
    } catch (error) {
      console.error("Account deletion error:", error);
      toast.error(t("common.error"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <PanelBody>
      <div className={cn(accountContentClass, "flex flex-col gap-3")}>
        <ListRow>
          <LogOut className="size-[18px] shrink-0 text-fg-secondary" />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-fg-strong">{t("auth.logout")}</div>
            <div className="text-[13px] text-fg-secondary">{t("auth.logoutDescription")}</div>
          </div>
          <Button variant="outline" size="sm" className="h-9 shrink-0 font-semibold" onClick={handleSignOut}>
            {t("auth.logout")}
          </Button>
        </ListRow>

        <DangerZone
          icon={TriangleAlert}
          title={t("auth.deleteAccount")}
          description={
            hasPasswordAuth
              ? `${t("profile.deleteImpact")} ${t("profile.deleteNeedsPassword")}`
              : t("profile.deleteImpact")
          }
          action={
            <Button
              variant="outline"
              size="sm"
              className="h-9 border-danger-line bg-surface-card font-semibold text-danger hover:bg-danger-soft hover:text-danger"
              onClick={() => setShowDeleteDialog(true)}
            >
              {t("common.delete")}
            </Button>
          }
        />
      </div>

      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) setDeletePassword("");
        }}
        onConfirm={handleDeleteAccount}
        title={t("auth.deleteAccount")}
        description={t("auth.deleteAccountConfirm")}
        confirmText={isDeleting ? t("common.loading") : t("auth.deleteAccount")}
        confirmVariant="destructive"
        confirmDisabled={isDeleting || (hasPasswordAuth && !deletePassword)}
      >
        {hasPasswordAuth && (
          <Field label={t("auth.confirmPasswordLabel")} htmlFor="delete-password">
            <Input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              disabled={isDeleting}
              placeholder={t("auth.enterPassword")}
              className={inputClass}
            />
          </Field>
        )}
      </ConfirmationDialog>
    </PanelBody>
  );
}
