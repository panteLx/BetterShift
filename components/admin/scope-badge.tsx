"use client";

import { useTranslations } from "next-intl";
import { Pill } from "@/components/form-kit";
import { useAdminScope } from "@/hooks/useAdminScope";

export function ScopeBadge() {
  const t = useTranslations();
  const { scope, workspace } = useAdminScope();
  if (!scope) return null;
  const label =
    scope === "workspace"
      ? t("admin.scope.workspace", { name: workspace?.name ?? "" })
      : scope === "global"
        ? t("admin.scope.global")
        : t("admin.scope.instance");
  return (
    <Pill tone={scope === "workspace" ? "brand" : "violet"} className="text-[11px]">
      {label}
    </Pill>
  );
}
