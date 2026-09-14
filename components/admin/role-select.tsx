"use client";

import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** User/admin/superadmin role picker shared by the create and edit user forms. */
export function RoleSelect({
  id,
  value,
  onValueChange,
}: {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const t = useTranslations();
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} className="h-10 w-full rounded-[9px] px-3 text-[14px] data-[size=default]:h-10">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="user">{t("common.roles.user")}</SelectItem>
        <SelectItem value="admin">{t("common.roles.admin")}</SelectItem>
        <SelectItem value="superadmin">{t("common.roles.superadmin")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
