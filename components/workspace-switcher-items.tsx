"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, LayoutGrid, LogOut, Settings2, Users } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useMyWorkspaces, useWorkspaceHref } from "@/hooks/useWorkspaces";
import { isManagerRole } from "@/lib/auth/workspace-permissions";

interface WorkspaceSwitcherItemsProps {
  onOpenMembers: () => void;
  onLeave: () => void;
}

/** Workspace block of the account menu: switcher, membership submenu on the current one, overview, manage. */
export function WorkspaceSwitcherItems({ onOpenMembers, onLeave }: WorkspaceSwitcherItemsProps) {
  const t = useTranslations();
  const config = usePublicConfig();
  const { data: current } = useWorkspace();
  const { data } = useMyWorkspaces("workspace", !!current?.multiTenant);
  const href = useWorkspaceHref();
  if (!current?.multiTenant) return null;

  const isMember = !!current.role;

  return (
    <>
      <DropdownMenuLabel className="text-xs font-normal text-fg-tertiary">{t("workspaces.switchTo")}</DropdownMenuLabel>
      {data?.workspaces.map((ws) => {
        if (ws.id === current.id && current.role === "owner") {
          // Owners cannot leave, so the only action is the member list: no submenu
          return (
            <DropdownMenuItem key={ws.id} onClick={onOpenMembers}>
              <Check className="mr-2 h-4 w-4" />
              <span className="truncate">{ws.name}</span>
              <Users className="ml-auto h-4 w-4 text-fg-tertiary" aria-label={t("workspaces.membersTab")} />
            </DropdownMenuItem>
          );
        }
        if (ws.id === current.id && isMember) {
          return (
            <DropdownMenuSub key={ws.id}>
              <DropdownMenuSubTrigger>
                <Check className="mr-2 h-4 w-4" />
                <span className="truncate">{ws.name}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={onOpenMembers}>
                  <Users className="mr-2 h-4 w-4" />
                  {t("workspaces.membersTab")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLeave} className="text-danger focus:text-danger">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("workspaces.leave")}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          );
        }
        return (
          <DropdownMenuItem key={ws.id} asChild>
            <a href={href(ws.slug)} aria-current={ws.id === current.id ? "true" : undefined}>
              {ws.id === current.id ? <Check className="mr-2 h-4 w-4" /> : <span className="mr-2 inline-block h-4 w-4" />}
              <span className="truncate">{ws.name}</span>
            </a>
          </DropdownMenuItem>
        );
      })}
      <DropdownMenuItem asChild>
        <a href={config.auth.url}>
          <LayoutGrid className="mr-2 h-4 w-4" />
          {t("workspaces.allWorkspaces")}
        </a>
      </DropdownMenuItem>
      {isManagerRole(current.role) && (
        <DropdownMenuItem asChild>
          <Link href="/admin">
            <Settings2 className="mr-2 h-4 w-4" />
            {t("workspaces.manageWorkspace")}
          </Link>
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
    </>
  );
}
