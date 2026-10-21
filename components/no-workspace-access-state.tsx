"use client";

import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { AuthHeader } from "@/components/auth-header";
import { EmptyStateBlock } from "@/components/empty-state-block";

/** Shown to a signed-in user on a workspace subdomain they're not a member of. */
export function NoWorkspaceAccessState({ workspaceName }: { workspaceName: string }) {
  const t = useTranslations();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AuthHeader showUserMenu />
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:p-10">
        <EmptyStateBlock
          icon={Lock}
          title={t("emptyState.noWorkspaceAccessTitle")}
          description={t("emptyState.noWorkspaceAccessDescription", { workspace: workspaceName })}
        />
      </main>
    </div>
  );
}
