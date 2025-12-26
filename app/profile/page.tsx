"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/useAuth";
import { useConnectedAccounts } from "@/hooks/useConnectedAccounts";
import { signOut, authClient } from "@/lib/auth/client";
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
import { AuthHeader } from "@/components/auth-header";
import { AppFooter } from "@/components/app-footer";
import { ProfileContentSkeleton } from "@/components/skeletons/profile-skeleton";
import { useVersionInfo } from "@/hooks/useVersionInfo";

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
  const { accounts, isLoading: accountsLoading } = useConnectedAccounts();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const versionInfo = useVersionInfo();

  const authEnabled = isAuthEnabled();

  // Check if user has password-based authentication
  const hasPasswordAuth = accounts.some(
    (account) => account.provider === "credential"
  );

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if auth disabled or not logged in
  useEffect(() => {
    if (!authEnabled) {
      router.replace("/");
    } else if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [authEnabled, isLoading, user, router]);

  if (!authEnabled || (!isLoading && !user)) {
    return null;
  }

  // Show skeleton during initial load or while loading accounts
  if (!mounted || isLoading || accountsLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <AuthHeader showUserMenu />
        <ProfileContentSkeleton />
        <AppFooter versionInfo={versionInfo} />
      </div>
    );
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
      const { data, error } = await authClient.changePassword({
        newPassword,
        currentPassword,
        revokeOtherSessions: false,
      });

      if (error) {
        toast.error(error.message || t("common.error"));
        return;
      }

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
    setIsDeleting(true);
    try {
      const { data, error } = await authClient.deleteUser(
        hasPasswordAuth ? { password: deletePassword } : {}
      );

      if (error) {
        toast.error(error.message || t("common.error"));
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

  const handleSignOut = async () => {
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success(t("auth.logoutSuccess"));
            router.replace("/login");
          },
        },
      });
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error(t("common.error"));
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <AuthHeader showUserMenu />

      <div className="flex-1 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          {/* Header */}
          <div className="mb-8 space-y-2">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              {t("auth.profileTitle")}
            </h1>
            <p className="text-muted-foreground">
              {t("auth.profileDescription")}
            </p>
          </div>

          <div className="space-y-6">
            {/* User Info */}
            <Card className="border-border/50 bg-gradient-to-br from-card/95 via-card to-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {t("auth.profile")}
                </CardTitle>
                <CardDescription>
                  Your basic account information
                </CardDescription>
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

            {/* Change Password - Only for email/password users */}
            {hasPasswordAuth && (
              <Card className="border-border/50 bg-gradient-to-br from-card/95 via-card to-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {t("auth.changePassword")}
                  </CardTitle>
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
                      <Label htmlFor="newPassword">
                        {t("auth.newPassword")}
                      </Label>
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
            )}

            {/* Connected Accounts */}
            <Card className="border-border/50 bg-gradient-to-br from-card/95 via-card to-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {t("auth.connectedAccounts")}
                </CardTitle>
                <CardDescription>
                  Manage your connected OAuth providers
                </CardDescription>
              </CardHeader>
              <CardContent>
                {accountsLoading ? (
                  <p className="text-sm text-muted-foreground">
                    {t("common.loading")}
                  </p>
                ) : accounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No connected accounts yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {accounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between rounded-lg border border-border/50 p-3"
                      >
                        <div>
                          <p className="font-medium capitalize">
                            {account.provider === "credential"
                              ? "Email/Password"
                              : account.provider}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {account.accountId || "—"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Separator />

            {/* Danger Zone */}
            <Card className="border-destructive/30 bg-gradient-to-br from-card/95 via-card to-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="bg-gradient-to-r from-destructive to-destructive/70 bg-clip-text text-transparent">
                  Danger Zone
                </CardTitle>
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
            onOpenChange={(open) => {
              setShowDeleteDialog(open);
              if (!open) setDeletePassword("");
            }}
            onConfirm={handleDeleteAccount}
            title={t("auth.deleteAccount")}
            description={t("auth.deleteAccountConfirm")}
            confirmText={
              isDeleting ? t("common.deleting") : t("auth.deleteAccount")
            }
            confirmDisabled={isDeleting || (hasPasswordAuth && !deletePassword)}
          >
            {hasPasswordAuth && (
              <div className="space-y-2 pt-4">
                <Label htmlFor="deletePassword">
                  {t("auth.confirmPasswordLabel")}
                </Label>
                <Input
                  id="deletePassword"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  disabled={isDeleting}
                  placeholder={t("auth.enterPassword")}
                />
              </div>
            )}
          </ConfirmationDialog>
        </div>
      </div>

      <AppFooter versionInfo={versionInfo} />
    </div>
  );
}
