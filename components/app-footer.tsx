"use client";

import { useTranslations } from "next-intl";
import { Coffee, Github } from "lucide-react";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeSwitcher } from "./theme-switcher";

interface VersionInfo {
  version: string;
  githubUrl: string;
  commitHash?: string;
}

interface AppFooterProps {
  versionInfo: VersionInfo | null;
}

export function AppFooter({ versionInfo }: AppFooterProps) {
  const t = useTranslations();

  // Format version display based on version type
  const displayVersion =
    versionInfo?.version === "dev" && versionInfo?.commitHash
      ? `dev (${versionInfo.commitHash})`
      : versionInfo?.version;

  return (
    <footer className="border-t bg-background mt-auto">
      <div className="container max-w-4xl mx-auto p-3 sm:p-4">
        {/* Mobile: Two rows (language + links), Desktop: One row */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center sm:gap-4">
          {/* Language and theme switcher */}
          <div className="flex justify-center sm:justify-start items-center gap-2">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>

          {/* Links row - horizontal on all screen sizes */}
          <div className="flex flex-row items-center justify-center sm:justify-end gap-3 sm:gap-4 text-xs">
            {/* Version info */}
            {versionInfo && (
              <a
                href={versionInfo.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors font-mono whitespace-nowrap"
                title={
                  versionInfo.commitHash
                    ? `${t("footer.version")}: ${versionInfo.version} (${
                        versionInfo.commitHash
                      })`
                    : `${t("footer.version")}: ${versionInfo.version}`
                }
              >
                {t("footer.version")}: {displayVersion}
              </a>
            )}

            {/* GitHub repo link */}
            <a
              href="https://github.com/panteLx/BetterShift"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              title={t("footer.github")}
            >
              <Github className="w-4 h-4" />
              <span className="hidden sm:inline">{t("footer.github")}</span>
            </a>

            {/* Buy Me a Coffee link */}
            <a
              href="https://buymeacoffee.com/pantelx"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-amber-500 transition-colors"
              title={t("footer.support")}
            >
              <Coffee className="w-4 h-4" />
              <span className="hidden sm:inline">{t("footer.support")}</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
