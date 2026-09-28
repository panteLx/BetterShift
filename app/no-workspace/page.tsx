import { getTranslations } from "next-intl/server";
import { Building2 } from "lucide-react";
import { EmptyStateBlock } from "@/components/empty-state-block";
import { SignOutButton } from "./sign-out-button";

// Apex landing for a signed-in user without any membership; the proxy rewrites "/" here.
export default async function NoWorkspacePage() {
  const t = await getTranslations();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:p-10">
        <EmptyStateBlock
          icon={Building2}
          title={t("system.noWorkspace")}
          description={t("system.noWorkspaceDescription")}
          actions={<SignOutButton label={t("auth.logout")} />}
        />
      </main>
    </div>
  );
}
