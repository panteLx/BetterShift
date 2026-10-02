import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";
import { EmptyStateBlock } from "@/components/empty-state-block";

// Rewrite target for unknown workspace hosts; no header links, since every path on that host is a 404.
export default async function WorkspaceNotFoundPage() {
  const t = await getTranslations();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:p-10">
        <EmptyStateBlock
          icon={SearchX}
          title={t("system.workspaceNotFound")}
          description={t("system.workspaceNotFoundDescription")}
        />
      </main>
    </div>
  );
}
