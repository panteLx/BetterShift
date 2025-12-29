"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle, Eye, Edit } from "lucide-react";

interface GuestPermissionSelectorProps {
  value: "none" | "read" | "write";
  onChange: (value: "none" | "read" | "write") => void;
  idPrefix?: string;
}

export function GuestPermissionSelector({
  value,
  onChange,
  idPrefix = "guest",
}: GuestPermissionSelectorProps) {
  const t = useTranslations();

  return (
    <div className="pt-4 mt-4 border-t border-border/50">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-gradient-to-b from-blue-500 to-blue-400 rounded-full"></div>
          <Label className="text-sm font-medium">
            {t("guest.guestPermission")}
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("guest.guestPermissionDescription")}
        </p>

        <RadioGroup
          value={value}
          onValueChange={(val) => onChange(val as "none" | "read" | "write")}
          className="space-y-2"
        >
          {/* No Access */}
          <div className="flex items-center space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
            <RadioGroupItem value="none" id={`${idPrefix}-none`} />
            <Label
              htmlFor={`${idPrefix}-none`}
              className="flex-1 cursor-pointer space-y-1"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="font-medium">
                  {t("guest.guestPermissionNone")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("guest.guestPermissionNoneDesc")}
              </p>
            </Label>
          </div>

          {/* Read Only */}
          <div className="flex items-center space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
            <RadioGroupItem value="read" id={`${idPrefix}-read`} />
            <Label
              htmlFor={`${idPrefix}-read`}
              className="flex-1 cursor-pointer space-y-1"
            >
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-500" />
                <span className="font-medium">
                  {t("guest.guestPermissionRead")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("guest.guestPermissionReadDesc")}
              </p>
            </Label>
          </div>

          {/* Read & Write */}
          <div className="flex items-center space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
            <RadioGroupItem value="write" id={`${idPrefix}-write`} />
            <Label
              htmlFor={`${idPrefix}-write`}
              className="flex-1 cursor-pointer space-y-1"
            >
              <div className="flex items-center gap-2">
                <Edit className="h-4 w-4 text-green-500" />
                <span className="font-medium">
                  {t("guest.guestPermissionWrite")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("guest.guestPermissionWriteDesc")}
              </p>
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
