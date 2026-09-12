"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { User } from "@/lib/auth";
import {
  isRateLimitError,
  handleRateLimitError,
} from "@/lib/rate-limit-client";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/**
 * Name, e-mail and avatar edits of the signed-in user. Drafts stay `null`
 * until touched, so the fields follow the session user after a refetch.
 */
export function useProfileForm(
  user: User | undefined,
  refetch: () => Promise<unknown>
) {
  const t = useTranslations();
  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftEmail, setDraftEmail] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const name = draftName ?? user?.name ?? "";
  const email = draftEmail ?? user?.email ?? "";
  const image = avatarRemoved ? null : (avatarPreview ?? user?.image ?? null);
  const isDirty =
    name !== (user?.name ?? "") ||
    email !== (user?.email ?? "") ||
    !!avatarFile ||
    (avatarRemoved && !!user?.image);

  const discard = () => {
    setDraftName(null);
    setDraftEmail(null);
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarRemoved(false);
  };

  const selectAvatar = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("auth.invalidImageType"));
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(t("auth.imageTooLarge"));
      return;
    }

    setAvatarFile(file);
    setAvatarRemoved(false);

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarRemoved(true);
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error(t("auth.nameRequired"));
      return;
    }

    if (!email.trim()) {
      toast.error(t("auth.emailRequired"));
      return;
    }

    setIsSaving(true);

    try {
      let imageUrl: string | null | undefined = avatarRemoved ? null : user?.image;
      if (avatarFile) {
        setIsUploadingAvatar(true);
        const formData = new FormData();
        formData.append("file", avatarFile);

        const uploadResponse = await fetch("/api/auth/upload-avatar", {
          method: "POST",
          body: formData,
        });

        if (isRateLimitError(uploadResponse)) {
          await handleRateLimitError(uploadResponse, t);
          return;
        }

        if (!uploadResponse.ok) {
          toast.error(t("auth.avatarUploadFailed"));
          return;
        }

        const uploadData = await uploadResponse.json();
        imageUrl = uploadData.url;
        setIsUploadingAvatar(false);
      }

      const updateResponse = await fetch("/api/auth/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, image: imageUrl }),
      });

      if (isRateLimitError(updateResponse)) {
        await handleRateLimitError(updateResponse, t);
        return;
      }

      if (!updateResponse.ok) {
        const updateData = await updateResponse.json();
        toast.error(updateData.error || t("common.error"));
        return;
      }

      // E-mail changes apply without verification
      if (email !== user?.email) {
        const emailResponse = await fetch("/api/auth/change-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newEmail: email }),
        });

        if (isRateLimitError(emailResponse)) {
          await handleRateLimitError(emailResponse, t);
          return;
        }

        if (!emailResponse.ok) {
          const emailData = await emailResponse.json();
          toast.error(emailData.error || t("common.error"));
          return;
        }
      }

      toast.success(t("auth.profileUpdated"));
      await refetch();
      discard();
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error(t("common.error"));
    } finally {
      setIsSaving(false);
      setIsUploadingAvatar(false);
    }
  };

  return {
    name,
    email,
    image,
    isDirty,
    isSaving,
    isUploadingAvatar,
    setName: setDraftName,
    setEmail: setDraftEmail,
    selectAvatar,
    removeAvatar,
    discard,
    save,
  };
}

export type ProfileForm = ReturnType<typeof useProfileForm>;

export function usePasswordForm() {
  const t = useTranslations();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChanging, setIsChanging] = useState(false);

  const isDirty = !!(currentPassword || newPassword || confirmPassword);

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const submit = async () => {
    if (!currentPassword || !newPassword) {
      toast.error(t("validation.passwordRequired"));
      return;
    }

    if (newPassword.length < 8) {
      toast.error(t("validation.passwordTooShort"));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t("validation.passwordsNoMatch"));
      return;
    }

    setIsChanging(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword,
          currentPassword,
          revokeOtherSessions: false,
        }),
      });

      if (isRateLimitError(response)) {
        await handleRateLimitError(response, t);
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || t("common.error"));
        return;
      }

      toast.success(t("auth.passwordChanged"));
      reset();
    } catch (error) {
      console.error("Password change error:", error);
      toast.error(t("common.error"));
    } finally {
      setIsChanging(false);
    }
  };

  return {
    currentPassword,
    newPassword,
    confirmPassword,
    setCurrentPassword,
    setNewPassword,
    setConfirmPassword,
    isChanging,
    isDirty,
    reset,
    submit,
  };
}
