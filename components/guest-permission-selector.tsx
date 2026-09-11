"use client";

import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { InfoNote, OptionCards } from "@/components/form-kit";
import { cn } from "@/lib/utils";

type GuestPermission = "none" | "read" | "write";

interface GuestPermissionSelectorProps {
  value: GuestPermission;
  onChange: (value: GuestPermission) => void;
  disabled?: boolean;
}

export function GuestPermissionSelector({
  value,
  onChange,
  disabled = false,
}: GuestPermissionSelectorProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-2.5">
      {/* A disabled fieldset disables the option buttons natively. */}
      <fieldset disabled={disabled} className={cn("m-0 min-w-0 border-0 p-0", disabled && "opacity-60")}>
        <OptionCards<GuestPermission>
          label={t("share.publicAccess")}
          columns={3}
          value={value}
          onChange={onChange}
          options={[
            {
              value: "none",
              title: t("sharingSheet.accessNone"),
              description: t("sharingSheet.guestNoneShort"),
            },
            {
              value: "read",
              title: t("sharingSheet.permRead"),
              description: t("sharingSheet.guestReadShort"),
            },
            {
              value: "write",
              title: t("sharingSheet.permWrite"),
              description: t("sharingSheet.guestWriteShort"),
            },
          ]}
        />
      </fieldset>
      <InfoNote icon={Info}>
        {value === "none"
          ? t("share.publicPermissionNoneDesc")
          : value === "read"
            ? t("share.publicPermissionReadDesc")
            : t("share.publicPermissionWriteDesc")}
      </InfoNote>
    </div>
  );
}
