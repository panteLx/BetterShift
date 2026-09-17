"use client";

import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import {
  CalendarClock,
  Ellipsis,
  Pencil,
  RefreshCw,
  StickyNote,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShiftWithCalendar } from "@/lib/types";
import { CalendarNote } from "@/lib/db/schema";
import { getDateLocale } from "@/lib/locales";
import {
  formatHours,
  formatSignupCapacityLabel,
  formatTimeRange,
  getShiftMinutes,
  shiftVars,
} from "@/lib/shift-display";
import { PeriodSummary } from "@/hooks/useDaySummary";
import { cn, getUserInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useQuickSelfSignup, useShiftSignupPermission } from "@/hooks/useShiftSignups";

/** Compact avatar stack for who signed up; renders nothing when unused. */
function ShiftSignupBadge({
  shift,
  signupsEnabled,
}: {
  shift: ShiftWithCalendar;
  signupsEnabled: boolean;
}) {
  const t = useTranslations();
  const signups = shift.signups ?? [];
  const capacity = shift.signupCapacity ?? null;
  if (!signupsEnabled || (signups.length === 0 && capacity == null)) return null;

  const visible = signups.slice(0, 3);
  const overflow = signups.length - visible.length;
  const tooltip =
    capacity != null
      ? formatSignupCapacityLabel(t, signups.length, capacity).text
      : undefined;

  return (
    <div className="flex shrink-0 items-center -space-x-1.5" title={tooltip}>
      {visible.map((person) => (
        <Avatar key={person.id} className="size-5 border border-surface-card">
          {person.image && <AvatarImage src={person.image} alt="" />}
          <AvatarFallback className="bg-surface-sunken text-[9px] font-semibold text-fg-secondary">
            {getUserInitials({ name: person.name })}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <span
          className="flex size-5 items-center justify-center rounded-full border border-surface-card bg-surface-sunken text-[9px] font-semibold text-fg-secondary"
          aria-label={t("shiftSignup.andMore", { count: overflow })}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

export function Kpi({
  label,
  value,
  size = "md",
  muted = false,
}: {
  label: string;
  value: React.ReactNode;
  size?: "md" | "lg";
  muted?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className={cn("text-fg-tertiary", size === "lg" ? "text-[11.5px]" : "text-[11px]")}>
        {label}
      </div>
      <div
        className={cn(
          "font-mono font-medium",
          size === "lg" ? "text-[17px]" : "text-base",
          muted ? "text-fg-faint" : "text-fg-strong"
        )}
      >
        {value}
      </div>
    </div>
  );
}

interface ShiftDetailRowProps {
  shift: ShiftWithCalendar;
  canEdit: boolean;
  canDelete: boolean;
  actions: "menu" | "inline";
  /** List view: title and note wrap instead of truncating */
  fullTitle?: boolean;
  onEdit: (shift: ShiftWithCalendar) => void;
  /** What a click on the row itself does; defaults to `onEdit`, which the menu always keeps */
  onOpen?: (shift: ShiftWithCalendar) => void;
  onDelete: (shift: ShiftWithCalendar) => void;
}

export function ShiftDetailRow({
  shift,
  canEdit,
  canDelete,
  actions,
  fullTitle = false,
  onEdit,
  onOpen,
  onDelete,
}: ShiftDetailRowProps) {
  const t = useTranslations();
  const locale = useLocale();
  const synced = shift.syncedFromExternal || !!shift.externalSyncId;
  // editOwnShift/editAnyShift and deleteOwnShift/deleteAnyShift are independent
  // capabilities — a bundle can grant one without the other.
  const editable = canEdit && !synced;
  const deletable = canDelete && !synced;
  const minutes = getShiftMinutes(shift);

  const { user: currentUser } = useAuth();
  const { canManageOwn, signupsEnabled } = useShiftSignupPermission(shift.calendarId);
  const { signUpForShift, isPending: signingUp } = useQuickSelfSignup();
  const signups = shift.signups ?? [];
  const capacity = shift.signupCapacity ?? null;
  const alreadySignedUp = !!currentUser && signups.some((s) => s.id === currentUser.id);
  const isFull = capacity != null && signups.length >= capacity;
  const showQuickSignup = canManageOwn && !alreadySignedUp && !isFull;

  return (
    <div
      onClick={() => (onOpen ?? onEdit)(shift)}
      className="flex cursor-pointer items-center gap-[11px] rounded-lg border border-line bg-surface-card px-3 py-[11px] transition-colors hover:bg-surface-panel"
    >
      <span
        className="shift-rail h-[34px] w-1 shrink-0 rounded-full"
        style={shiftVars(shift.color)}
      />
      <div className="min-w-0 flex-1">
        <div className={cn("text-[13.5px] font-semibold text-fg-strong", fullTitle ? "break-words" : "truncate")}>
          {shift.title}
        </div>
        <div className="mt-0.5 font-mono text-xs text-fg-tertiary">
          {shift.isAllDay ? t("shift.allDayShift") : formatTimeRange(shift)}
        </div>
        {shift.notes && (
          <div className={cn("mt-1 text-xs text-fg-secondary", fullTitle ? "whitespace-pre-line break-words" : "line-clamp-2")}>
            {shift.notes}
          </div>
        )}
      </div>
      <ShiftSignupBadge shift={shift} signupsEnabled={signupsEnabled} />
      {showQuickSignup && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            signUpForShift(shift.id);
          }}
          disabled={signingUp}
          aria-label={t("shiftSignup.addSelf")}
          title={t("shiftSignup.addSelf")}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-fg-tertiary transition-colors hover:bg-surface-sunken disabled:opacity-40"
        >
          <UserPlus className="size-4" />
        </button>
      )}
      {synced && (
        <span
          className="flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-semibold text-fg-secondary"
          title={t("calendarView.syncedReadOnly")}
        >
          <RefreshCw className="size-3" />
          {t("calendarView.external")}
        </span>
      )}
      {!shift.isAllDay && minutes > 0 && (
        <span className="rounded-sm bg-surface-sunken px-[7px] py-0.5 font-mono text-xs text-fg-secondary">
          {formatHours(minutes, locale)}
        </span>
      )}
      {(editable || deletable) &&
        (actions === "menu" ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              onClick={(e) => e.stopPropagation()}
              className="flex size-7 items-center justify-center rounded-md text-fg-tertiary transition-colors hover:bg-surface-sunken"
              aria-label={t("calendarView.shiftActions")}
            >
              <Ellipsis className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              // Portal content bubbles into the row below; keep menu clicks/holds from stamping it
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {editable && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(shift);
                  }}
                >
                  <Pencil className="mr-2 size-4" />
                  {t("shift.edit")}
                </DropdownMenuItem>
              )}
              {deletable && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(shift);
                  }}
                  className="text-danger focus:text-danger"
                >
                  <Trash2 className="mr-2 size-4" />
                  {t("common.delete")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center">
            {editable && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(shift);
                }}
                aria-label={t("shift.edit")}
                className="flex size-9 items-center justify-center rounded-md text-fg-secondary"
              >
                <Pencil className="size-[17px]" />
              </button>
            )}
            {deletable && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(shift);
                }}
                aria-label={t("common.delete")}
                className="flex size-9 items-center justify-center rounded-md text-fg-secondary"
              >
                <Trash2 className="size-[17px]" />
              </button>
            )}
          </div>
        ))}
    </div>
  );
}

export function NoteDetailCard({
  note,
  onOpen,
}: {
  note: CalendarNote;
  onOpen?: (note: CalendarNote) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const isEvent = note.type === "event";
  const Icon = isEvent ? CalendarClock : StickyNote;
  const updatedAt = note.updatedAt ? new Date(note.updatedAt) : null;
  // Rows created through the SQL default carry no usable timestamp
  const changed =
    updatedAt && updatedAt.getFullYear() >= 2020
      ? format(updatedAt, "P", { locale: getDateLocale(locale) })
      : null;

  const content = (
    <>
      <Icon
        className={cn("mt-px size-4 shrink-0", !isEvent && "text-[#d97706] dark:text-warning")}
        style={isEvent ? { color: note.color || "var(--brand)" } : undefined}
      />
      <div className="min-w-0 flex-1 text-left">
        <div className="whitespace-pre-line break-words text-[13px] leading-normal text-fg-body">
          {note.note}
        </div>
        <div className="mt-[3px] text-[11.5px] text-fg-tertiary">
          {isEvent ? t("calendarView.event") : t("calendarView.note")}
          {changed && ` · ${t("calendarView.changedOn", { date: changed })}`}
        </div>
      </div>
    </>
  );

  const className =
    "flex w-full items-start gap-2.5 rounded-lg border border-line bg-surface-card px-3 py-[11px]";

  return onOpen ? (
    <button
      type="button"
      onClick={() => onOpen(note)}
      className={cn(className, "transition-colors hover:bg-surface-panel")}
    >
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

export function PeriodSummaryView({
  summary,
  columns = "list",
}: {
  summary: PeriodSummary;
  columns?: "list" | "cards";
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { stats, freeDays, byType } = summary;
  const max = byType[0]?.count ?? 0;
  const kpis = [
    { label: t("calendarView.kpiShifts"), value: stats?.totalShifts ?? "–" },
    {
      label: t("calendarView.kpiHours"),
      value: stats ? formatHours(stats.totalMinutes, locale) : "–",
    },
    {
      label: t("calendarView.kpiAvgPerShift"),
      value: stats ? formatHours(stats.avgMinutesPerShift, locale) : "–",
    },
    { label: t("calendarView.kpiFreeDays"), value: freeDays ?? "–" },
  ];

  return (
    <div className="flex flex-col gap-3">
      {columns === "cards" ? (
        <div className="grid grid-cols-2 gap-2">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-line bg-surface-card px-3 py-2.5">
              <div className="text-[11.5px] text-fg-tertiary">{kpi.label}</div>
              <div className="mt-1 font-mono text-[21px] font-medium text-fg-strong">
                {kpi.value}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
          {kpis.map((kpi) => (
            <Kpi key={kpi.label} label={kpi.label} value={kpi.value} size="lg" />
          ))}
        </div>
      )}
      {byType.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {columns === "cards" && (
            <div className="eyebrow mt-1">{t("stats.byType")}</div>
          )}
          {byType.map((row) => (
            <div key={row.title} className="flex items-center gap-[9px]">
              <span
                className="shift-rail size-[7px] shrink-0 rounded-full"
                style={shiftVars(row.color)}
              />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg-body">
                {row.title}
              </span>
              <span
                className={cn(
                  "h-1 overflow-hidden rounded-full bg-line-grid",
                  columns === "cards" ? "w-[104px]" : "w-[76px]"
                )}
              >
                <span
                  className="shift-rail block h-full rounded-full"
                  style={{
                    ...shiftVars(row.color),
                    width: `${max ? Math.round((row.count / max) * 100) : 0}%`,
                  }}
                />
              </span>
              <span className="w-[22px] text-right font-mono text-xs text-fg-tertiary">
                {row.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
