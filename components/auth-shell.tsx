"use client";

import { ComponentProps, ReactNode, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useClientValue } from "@/hooks/useMediaQuery";
import { useVersionInfo } from "@/hooks/useVersionInfo";
import { getDateLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";

// The brand column is dark in both themes, so it uses fixed colors instead of tokens.
const BRAND_SURFACE = "bg-[#101828] dark:bg-[#141b28] dark:border-[#1e2637]";

// Early, late, night and vacation shift colors from the handoff; decorative only.
const SAMPLE_SHIFTS = ["#2563eb", "#6d28d9", "#4338ca"];
const SAMPLE_VACATION = "#047857";

// 16px on phones keeps iOS from zooming into the field on focus.
export const authInputClass =
  "h-[42px] rounded-[9px] px-[13px] text-base sm:text-[14px]";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <header
        className={cn(
          "flex h-14 shrink-0 items-center px-4 lg:hidden",
          BRAND_SURFACE,
        )}
      >
        <BrandMark />
      </header>

      <aside
        className={cn(
          "sticky top-0 hidden h-dvh w-[420px] shrink-0 flex-col overflow-y-auto px-[34px] py-9 lg:flex dark:border-r",
          BRAND_SURFACE,
        )}
      >
        <BrandMark />
        <SampleMonth />
        <InstanceFacts />
      </aside>

      <main className="flex flex-1 justify-center px-4 py-8 sm:py-12 lg:items-center lg:p-9">
        <div className="flex w-full max-w-[380px] flex-col gap-[18px]">
          <div>
            <h1 className="text-[21px] font-semibold tracking-[-0.02em] text-fg-strong">
              {title}
            </h1>
            {description && (
              <p className="mt-1 text-[14px] text-fg-secondary">
                {description}
              </p>
            )}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

function BrandMark() {
  const t = useTranslations();
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-[30px] items-center justify-center rounded-lg bg-brand">
        <CalendarDays className="size-[17px] text-white" />
      </div>
      <span className="text-[16px] font-semibold tracking-[-0.01em] text-white">
        {t("app.title")}
      </span>
    </div>
  );
}

function sampleBars(day: Date, week: number): string[] {
  const weekday = (day.getDay() + 6) % 7;
  const n = day.getDate();
  if (weekday === 6) return [];
  if (week === 2 && weekday < 4) return [SAMPLE_VACATION];
  if (weekday === 5 && n % 2 === 0) return [];
  const first = SAMPLE_SHIFTS[(n + week) % 3];
  return n % 3 === 2 ? [first, SAMPLE_SHIFTS[(n + week + 1) % 3]] : [first];
}

/** Abstract month pattern; nothing is fetched before sign-in. */
function SampleMonth() {
  const t = useTranslations();
  const dateLocale = getDateLocale(useLocale());
  const [today] = useState(() => new Date());

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(today), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(today), { weekStartsOn: 1 }),
      }),
    [today],
  );

  return (
    <div className="mt-8 flex flex-col gap-2.5">
      <div className="flex items-baseline gap-2.5">
        <span className="text-[14px] font-semibold text-white">
          {format(today, "LLLL yyyy", { locale: dateLocale })}
        </span>
        <span className="font-mono text-[11.5px] text-[#98a2b3]">
          {t("authPage.sampleMonth")}
        </span>
      </div>
      <div aria-hidden="true" className="grid grid-cols-7 gap-1">
        {days.slice(0, 7).map((day) => (
          <div
            key={`wd-${day.toISOString()}`}
            className="text-center text-[9px] font-semibold uppercase tracking-[.04em] text-[#667085]"
          >
            {format(day, "EEEEEE", { locale: dateLocale })}
          </div>
        ))}
        {days.map((day, i) => {
          const inMonth = isSameMonth(day, today);
          const isToday = isSameDay(day, today);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "flex aspect-square flex-col items-center gap-0.5 rounded-[4px] px-0.5 py-[3px]",
                isToday ? "bg-brand" : "bg-white/5",
                !inMonth && "opacity-30",
              )}
            >
              <span
                className={cn(
                  "font-mono text-[8.5px] leading-[1.2]",
                  isToday ? "text-white" : "text-[#98a2b3]",
                )}
              >
                {day.getDate()}
              </span>
              {inMonth &&
                sampleBars(day, Math.floor(i / 7)).map((color, j) => (
                  <span
                    key={j}
                    className="h-[2.5px] w-[72%] rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InstanceFacts() {
  const t = useTranslations();
  const version = useVersionInfo()?.version;

  const host = useClientValue(() => window.location.host, "");
  const facts = [
    { label: t("authPage.instance"), value: host },
    { label: t("admin.systemInfo.version"), value: version ?? "–" },
  ];

  return (
    <dl className="mt-auto flex flex-col gap-[9px] pt-7 font-mono text-[11.5px]">
      {facts.map((fact) => (
        <div key={fact.label} className="flex items-center gap-2.5">
          <dt className="w-[78px] shrink-0 text-[#8a94a6]">{fact.label}</dt>
          <dd className="min-w-0 truncate text-[#d0d5dd]">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PasswordInput({
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, "type">) {
  const t = useTranslations();
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  const label = visible
    ? t("authPage.hidePassword")
    : t("authPage.showPassword");

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn(authInputClass, "pr-11", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={props.disabled}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-[9px] text-fg-tertiary outline-none transition-colors hover:text-fg-body focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <Icon className="size-[17px]" />
      </button>
    </div>
  );
}

/** Horizontal rule with a centered word, e.g. "oder". */
export function AuthDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[12px] text-fg-tertiary">
      <span className="h-px flex-1 bg-line" />
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
