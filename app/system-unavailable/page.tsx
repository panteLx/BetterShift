import { getTranslations } from "next-intl/server";
import { AlertTriangle } from "lucide-react";
import { AppFooter } from "@/components/app-footer";
import { AuthHeader } from "@/components/auth-header";
import { getVersionInfo } from "@/lib/version";

export default async function SystemUnavailablePage() {
  const t = await getTranslations();
  const versionInfo = await getVersionInfo();

  return (
    <div className="flex flex-col min-h-screen">
      <AuthHeader />

      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-background via-background to-destructive/5 px-4 py-8">
        <div className="w-full max-w-2xl">
          {/* Error Banner */}
          <div className="rounded-lg border-2 border-destructive bg-destructive/10 p-8 shadow-lg animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex gap-4 items-start">
              <AlertTriangle className="h-12 w-12 text-destructive flex-shrink-0 mt-1" />
              <div className="space-y-3 flex-1">
                <h1 className="text-3xl font-semibold text-destructive">
                  {t("system.unavailable")}
                </h1>
                <p className="text-sm text-muted-foreground mt-4">
                  {t("system.unavailableDescription")}
                </p>
                <div className="pt-4 border-t border-destructive/20 mt-6">
                  <p className="text-xs text-muted-foreground">
                    {t("system.unavailableRetry")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AppFooter versionInfo={versionInfo} />
    </div>
  );
}
