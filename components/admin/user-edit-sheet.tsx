"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BaseSheet } from "@/components/ui/base-sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminUsers, type AdminUser } from "@/hooks/useAdminUsers";
import { useCanEditUser, useCanChangeUserRole } from "@/hooks/useAdminAccess";

interface UserEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser;
  onSuccess: () => void;
}

export function UserEditSheet({
  open,
  onOpenChange,
  user,
  onSuccess,
}: UserEditSheetProps) {
  const t = useTranslations();
  const { updateUser, isLoading } = useAdminUsers();
  const canEdit = useCanEditUser(user);
  const canChangeRole = useCanChangeUserRole(user);

  // State will reset when component remounts (via key prop)
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role || "user");

  // Track if form has changes
  const hasChanges =
    name !== user.name || email !== user.email || role !== user.role;

  if (!canEdit) {
    return null;
  }

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const handleSave = async () => {
    const updates: { name?: string; email?: string; role?: string } = {};

    if (name !== user.name) updates.name = name;
    if (email !== user.email) updates.email = email;
    if (canChangeRole && role !== user.role) updates.role = role;

    const success = await updateUser(user.id, updates);
    if (success) {
      onSuccess();
      handleOpenChange(false);
    }
  };

  return (
    <BaseSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={t("admin.editUser")}
      description={t("admin.editUserDescription")}
      showSaveButton
      onSave={handleSave}
      isSaving={isLoading}
      saveDisabled={!hasChanges}
      hasUnsavedChanges={hasChanges}
      maxWidth="md"
    >
      <div className="space-y-6">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">
            {t("common.labels.name")}{" "}
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("admin.namePlaceholder")}
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">
            {t("common.labels.email")}{" "}
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("admin.emailPlaceholder")}
          />
        </div>

        {/* Role */}
        {canChangeRole && (
          <div className="space-y-2">
            <Label htmlFor="role">{t("admin.role")}</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">{t("common.roles.user")}</SelectItem>
                <SelectItem value="admin">{t("common.roles.admin")}</SelectItem>
                <SelectItem value="superadmin">
                  {t("common.roles.superadmin")}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("admin.roleChangeWarning")}
            </p>
          </div>
        )}
      </div>
    </BaseSheet>
  );
}
