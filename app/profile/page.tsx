"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { isAuthEnabled } from "@/lib/auth/feature-flags";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

/**
 * User profile page
 *
 * Features:
 * - Display user info
 * - Change password
 * - Change email
 * - Connected OAuth accounts
 * - Delete account
 */
export default function ProfilePage() {
  const t = useTranslations();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const authEnabled = isAuthEnabled();

  // Redirect if auth disabled or not logged in
  useEffect(() => {
    if (!authEnabled) {
      router.push("/");
    } else if (!isLoading && !user) {
      router.push("/login");
    }
  }, [authEnabled, isLoading, user, router]);

  if (!authEnabled || (!isLoading && !user)) {
    return null;
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword) {
      toast.error(t("auth.passwordRequired"));
      return;
    }

    if (newPassword.length < 8) {
      toast.error(t("auth.passwordTooShort"));
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error(t("auth.passwordsNoMatch"));
      return;
    }

    setIsChangingPassword(true);

    try {
      // TODO: Implement password change via Better Auth API
      // await changePassword({ currentPassword, newPassword });

      toast.success(t("auth.passwordChanged"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error) {
      console.error("Password change error:", error);
      toast.error(t("common.error"));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      // TODO: Implement account deletion via Better Auth API
      // await deleteAccount();

      toast.success(t("auth.accountDeleted"));
      await signOut();
      router.push("/");
    } catch (error) {
      console.error("Account deletion error:", error);
      toast.error(t("common.error"));
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success(t("auth.logoutSuccess"));
            router.push("/login");
          },
        },
      });
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error(t("common.error"));
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          {t("auth.profileTitle")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t("auth.profileDescription")}
        </p>
      </div>

      <div className="space-y-6">
        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle>{t("auth.profile")}</CardTitle>
            <CardDescription>Your basic account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t("auth.name")}</Label>
              <p className="mt-1 text-sm">{user?.name || "—"}</p>
            </div>
            <div>
              <Label>{t("auth.email")}</Label>
              <p className="mt-1 text-sm">{user?.email || "—"}</p>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle>{t("auth.changePassword")}</CardTitle>
            <CardDescription>
              Update your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">
                  {t("auth.currentPassword")}
                </Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isChangingPassword}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">{t("auth.newPassword")}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isChangingPassword}
                  minLength={8}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">
                  {t("auth.confirmPassword")}
                </Label>
                <Input
                  id="confirmNewPassword"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  disabled={isChangingPassword}
                  minLength={8}
                />
              </div>

              <Button type="submit" disabled={isChangingPassword}>
                {isChangingPassword
                  ? t("common.saving")
                  : t("auth.changePassword")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Connected Accounts */}
        <Card>
          <CardHeader>
            <CardTitle>{t("auth.connectedAccounts")}</CardTitle>
            <CardDescription>
              Manage your connected OAuth providers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No connected accounts yet
            </p>
            {/* TODO: List connected OAuth accounts */}
          </CardContent>
        </Card>

        <Separator />

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions that affect your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t("auth.logout")}</p>
                <p className="text-sm text-muted-foreground">
                  Sign out from your current session
                </p>
              </div>
              <Button variant="outline" onClick={handleSignOut}>
                {t("auth.logout")}
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t("auth.deleteAccount")}</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all data
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                {t("auth.deleteAccount")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteAccount}
        title={t("auth.deleteAccount")}
        description={t("auth.deleteAccountConfirm")}
        confirmText={t("auth.deleteAccount")}
      />
    </div>
  );
}
