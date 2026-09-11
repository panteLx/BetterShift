"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Check, Moon, Sun, SunMoon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ThemeOption = "system" | "light" | "dark";

const PREVIEWS: Record<ThemeOption, { icon: LucideIcon; preview: [string, string] }> = {
  system: { icon: SunMoon, preview: ["#ffffff", "#0e141f"] },
  light: { icon: Sun, preview: ["#ffffff", "#ffffff"] },
  dark: { icon: Moon, preview: ["#0e141f", "#0e141f"] },
};

const subscribe = () => () => {};

export function useThemeOptions() {
  const t = useTranslations();
  return [
    {
      value: "system" as const,
      title: t("appearance.system.title"),
      description: t("appearance.system.description"),
    },
    {
      value: "light" as const,
      title: t("appearance.light.title"),
      description: t("appearance.light.description"),
    },
    {
      value: "dark" as const,
      title: t("appearance.dark.title"),
      description: t("appearance.dark.description"),
    },
  ];
}

export function AppearancePicker() {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  // next-themes only knows the stored value after hydration
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  const current = mounted ? (theme ?? "system") : undefined;
  const options = useThemeOptions();

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label={t("appearance.title")} className="flex flex-col gap-2">
        {options.map(({ value, title, description }) => {
          const { icon: Icon, preview } = PREVIEWS[value];
          const selected = current === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(value)}
              className={cn(
                "flex items-center gap-3 rounded-lg border-[1.5px] px-3 py-[11px] text-left transition-colors",
                selected
                  ? "border-brand bg-surface-today"
                  : "border-line bg-surface-card hover:bg-surface-panel"
              )}
            >
              <Icon
                className={cn(
                  "size-[17px] shrink-0",
                  selected ? "text-brand-ink" : "text-fg-secondary"
                )}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-[13.5px] font-semibold",
                    selected ? "text-brand-ink" : "text-fg-strong"
                  )}
                >
                  {title}
                </span>
                <span
                  className={cn(
                    "mt-px block text-[11.5px]",
                    selected ? "text-brand-ink" : "text-fg-tertiary"
                  )}
                >
                  {description}
                </span>
              </span>
              <span className="flex" aria-hidden>
                <span
                  className="h-[34px] w-[26px] rounded-l-[5px] border border-r-0 border-control"
                  style={{ background: preview[0] }}
                />
                <span
                  className="h-[34px] w-[26px] rounded-r-[5px] border border-control"
                  style={{ background: preview[1] }}
                />
              </span>
              <Check
                className={cn(
                  "size-[18px] shrink-0 text-brand",
                  !selected && "invisible"
                )}
              />
            </button>
          );
        })}
      </div>
      <p className="rounded-lg border border-line bg-surface-panel px-3 py-2.5 text-[12px] leading-relaxed text-fg-secondary">
        {t("appearance.hint")}
      </p>
    </div>
  );
}
