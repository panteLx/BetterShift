"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, inputClass } from "@/components/form-kit";
import { PanelBody, PanelFooter } from "@/components/panel-dialog";
import { accountContentClass } from "@/components/profile/account-layout";
import { usePasswordForm } from "@/hooks/useProfileForm";
import { cn } from "@/lib/utils";

export function PasswordSection() {
  const t = useTranslations();
  const form = usePasswordForm();

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        form.submit();
      }}
    >
      <PanelBody>
        <div className={cn(accountContentClass, "flex flex-col gap-[18px]")}>
          <Field label={t("auth.currentPassword")} htmlFor="current-password">
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={(e) => form.setCurrentPassword(e.target.value)}
              disabled={form.isChanging}
              className={inputClass}
            />
          </Field>
          <div className="h-px shrink-0 bg-line" />
          <Field label={t("common.labels.newPassword")} htmlFor="new-password">
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={form.newPassword}
              onChange={(e) => form.setNewPassword(e.target.value)}
              disabled={form.isChanging}
              className={inputClass}
            />
          </Field>
          <Field label={t("common.labels.confirmPassword")} htmlFor="confirm-new-password">
            <Input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={form.confirmPassword}
              onChange={(e) => form.setConfirmPassword(e.target.value)}
              disabled={form.isChanging}
              className={inputClass}
            />
          </Field>
        </div>
      </PanelBody>
      <PanelFooter>
        <div className={cn(accountContentClass, "flex items-center gap-2.5")}>
          <p className="hidden min-w-0 flex-1 text-[13px] text-fg-secondary lg:block">
            {t("profile.passwordNote")}
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-10 flex-1 font-semibold lg:flex-none lg:px-4"
            disabled={!form.isDirty || form.isChanging}
            onClick={form.reset}
          >
            {t("profile.discard")}
          </Button>
          <Button
            type="submit"
            className="h-10 flex-1 font-semibold lg:flex-none lg:px-4"
            disabled={form.isChanging}
          >
            {form.isChanging ? t("common.saving") : t("auth.changePassword")}
          </Button>
        </div>
      </PanelFooter>
    </form>
  );
}
