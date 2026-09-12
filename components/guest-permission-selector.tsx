"use client";

import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { InfoNote, OptionCards } from "@/components/form-kit";
import { cn } from "@/lib/utils";

type GuestPermission = "none" | "read" | "write";

/** Who a public-access level reaches; visitors without an account only with ALLOW_GUEST_ACCESS. */
export function usePublicAccessNote() {
  const t = useTranslations();
  return (value: GuestPermission, allowGuest: boolean) => {
    if (value === "none") return t("share.publicPermissionNoneDesc");
    if (value === "read")
      return allowGuest
        ? t("share.publicPermissionReadDescGuestsOn")
        : t("share.publicPermissionReadDescGuestsOff");
    return allowGuest
      ? t("share.publicPermissionWriteDescGuestsOn")
      : t("share.publicPermissionWriteDescGuestsOff");
  };
}

interface GuestPermissionSelectorProps {
  value: GuestPermission;
  onChange: (value: GuestPermission) => void;
  allowGuest: boolean;
  disabled?: boolean;
}

export function GuestPermissionSelector({
  value,
  onChange,
  allowGuest,
  disabled = false,
}: GuestPermissionSelectorProps) {
  const t = useTranslations();
  const publicAccessNote = usePublicAccessNote();

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
              description: allowGuest
                ? t("sharingSheet.guestReadShortGuestsOn")
                : t("sharingSheet.guestReadShortGuestsOff"),
            },
            {
              value: "write",
              title: t("sharingSheet.permWrite"),
              description: allowGuest
                ? t("sharingSheet.guestWriteShortGuestsOn")
                : t("sharingSheet.guestWriteShortGuestsOff"),
            },
          ]}
        />
      </fieldset>
      <InfoNote icon={Info}>{publicAccessNote(value, allowGuest)}</InfoNote>
    </div>
  );
}
