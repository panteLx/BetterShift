import { getTranslations } from "next-intl/server";
import { DatabaseZap } from "lucide-react";
import { AuthHeader } from "@/components/auth-header";
import { EmptyStateBlock } from "@/components/empty-state-block";
import { RetryButton } from "./retry-button";

export default async function SystemUnavailablePage() {
  const t = await getTranslations();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AuthHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:p-10">
        <EmptyStateBlock
          icon={DatabaseZap}
          tone="danger"
          title={t("system.unavailable")}
          description={t("system.unavailableDescription")}
          actions={<RetryButton label={t("calendarView.retry")} />}
        />
      </main>
    </div>
  );
}
