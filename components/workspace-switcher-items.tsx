"use client";

import { useTranslations } from "next-intl";
import { Check, LayoutGrid } from "lucide-react";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useMyWorkspaces, useWorkspaceHref } from "@/hooks/useWorkspaces";

/** Dropdown entries: every workspace of the user as a full-page link, plus the portal overview. */
export function WorkspaceSwitcherItems() {
  const t = useTranslations();
  const config = usePublicConfig();
  const { data: current } = useWorkspace();
  const { data } = useMyWorkspaces("workspace", !!current?.multiTenant);
  const href = useWorkspaceHref();
  if (!current?.multiTenant) return null;

  return (
    <>
      <DropdownMenuLabel className="text-xs font-normal text-fg-tertiary">{t("workspaces.switchTo")}</DropdownMenuLabel>
      {data?.workspaces.map((ws) => (
        <DropdownMenuItem key={ws.id} asChild>
          <a href={href(ws.slug)} aria-current={ws.id === current.id ? "true" : undefined}>
            {ws.id === current.id ? <Check className="mr-2 h-4 w-4" /> : <span className="mr-2 inline-block h-4 w-4" />}
            <span className="truncate">{ws.name}</span>
          </a>
        </DropdownMenuItem>
      ))}
      <DropdownMenuItem asChild>
        <a href={config.auth.url}>
          <LayoutGrid className="mr-2 h-4 w-4" />
          {t("workspaces.allWorkspaces")}
        </a>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
    </>
  );
}
