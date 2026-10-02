"use client";

import { useTranslations } from "next-intl";
import { AdminPageHeader } from "@/components/admin/admin-kit";
import { WorkspaceJoinLinksPanel } from "@/components/admin/workspace-join-links-panel";
import { WorkspaceMembersPanel } from "@/components/admin/workspace-members-panel";
import { useAdminScope } from "@/hooks/useAdminScope";

export default function AdminMembersPage() {
  const t = useTranslations();
  const { scope } = useAdminScope();
  if (scope !== "workspace") return null;

  return (
    <div className="flex flex-col gap-[14px] lg:gap-[18px]">
      <AdminPageHeader title={t("adminWorkspace.membersMenu")} />
      <WorkspaceMembersPanel />
      <WorkspaceJoinLinksPanel />
    </div>
  );
}
