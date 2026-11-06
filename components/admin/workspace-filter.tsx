"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useAdminWorkspaces } from "@/hooks/useAdminWorkspaces";

export const ALL_WORKSPACES = "all";

/** Workspace filter for the global users and calendars lists; renders nothing in other scopes. */
export function WorkspaceFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useTranslations();
  const isGlobal = useAdminScope().scope === "global";
  const { data } = useAdminWorkspaces(isGlobal);
  if (!isGlobal) return null;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-[38px] w-full rounded-[9px] lg:w-[190px]" aria-label={t("admin.workspaces.filterLabel")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_WORKSPACES}>{t("admin.workspaces.filterAll")}</SelectItem>
        {data?.workspaces.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            {w.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
