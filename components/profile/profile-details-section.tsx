"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Info, Upload, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, InfoNote, inputClass, SectionLabel } from "@/components/form-kit";
import { PanelBody, PanelFooter } from "@/components/panel-dialog";
import { getInitials } from "@/components/user-menu";
import { accountContentClass } from "@/components/profile/account-layout";
import {
  ConnectedAccountList,
  type ConnectedAccount,
} from "@/components/profile/connected-accounts";
import type { ProfileForm } from "@/hooks/useProfileForm";
import { cn } from "@/lib/utils";

const readOnlyInput = "read-only:bg-surface-panel read-only:text-fg-secondary";

/**
 * Screen 11b. Only accounts with password auth may edit name, e-mail and
 * avatar; OAuth users see their provider's data read-only.
 */
export function ProfileDetailsSection({
  form,
  canEdit,
  accounts,
}: {
  form: ProfileForm;
  canEdit: boolean;
  accounts: ConnectedAccount[];
}) {
  const t = useTranslations();
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = form.isSaving || form.isUploadingAvatar;

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        form.save();
      }}
    >
      <PanelBody>
        <div className={cn(accountContentClass, "flex flex-col gap-[18px]")}>
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarImage src={form.image ?? undefined} alt="" className="object-cover" />
              <AvatarFallback className="bg-brand-soft text-[20px] font-semibold text-brand-ink">
                {form.name ? getInitials(form.name) : <User className="size-6" />}
              </AvatarFallback>
            </Avatar>
            {canEdit && (
              <div className="flex min-w-0 flex-col gap-[7px]">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-[34px] font-semibold"
                    disabled={busy}
                    onClick={() => fileInput.current?.click()}
                  >
                    <Upload className="size-[15px]" />
                    {t("profile.chooseImage")}
                  </Button>
                  {form.image && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-[34px] font-medium text-danger hover:bg-danger-soft hover:text-danger"
                      disabled={busy}
                      onClick={form.removeAvatar}
                    >
                      {t("profile.removeImage")}
                    </Button>
                  )}
                </div>
                <span className="text-[12px] text-fg-tertiary">{t("auth.avatarHint")}</span>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label={t("auth.profilePicture")}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) form.selectAvatar(file);
                    // Allows picking the same file again after removing it
                    e.target.value = "";
                  }}
                />
              </div>
            )}
          </div>

          <Field label={t("common.labels.name")} htmlFor="profile-name">
            <Input
              id="profile-name"
              value={form.name}
              onChange={(e) => form.setName(e.target.value)}
              readOnly={!canEdit}
              disabled={busy}
              autoComplete="name"
              required
              className={cn(inputClass, readOnlyInput)}
            />
          </Field>
          <Field label={t("common.labels.email")} htmlFor="profile-email">
            <Input
              id="profile-email"
              type="email"
              value={form.email}
              onChange={(e) => form.setEmail(e.target.value)}
              readOnly={!canEdit}
              disabled={busy}
              autoComplete="email"
              required
              className={cn(inputClass, readOnlyInput)}
            />
          </Field>
          {!canEdit && <InfoNote icon={Info}>{t("profile.managedByProvider")}</InfoNote>}

          <div className="h-px shrink-0 bg-line" />

          <section>
            <SectionLabel>{t("common.auth.connectedAccounts")}</SectionLabel>
            <ConnectedAccountList accounts={accounts} />
          </section>
        </div>
      </PanelBody>

      {canEdit && (
        <PanelFooter>
          <div className={cn(accountContentClass, "flex items-center gap-2.5")}>
            <p className="hidden min-w-0 flex-1 text-[13px] text-fg-secondary lg:block">
              {t("profile.appliesEverywhere")}
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 font-semibold lg:flex-none lg:px-4"
              disabled={!form.isDirty || busy}
              onClick={form.discard}
            >
              {t("profile.discard")}
            </Button>
            <Button
              type="submit"
              className="h-10 flex-1 font-semibold lg:flex-none lg:px-4"
              disabled={!form.isDirty || busy}
            >
              {form.isUploadingAvatar
                ? t("auth.uploadingImage")
                : form.isSaving
                  ? t("common.saving")
                  : t("common.save")}
            </Button>
          </div>
        </PanelFooter>
      )}
    </form>
  );
}
