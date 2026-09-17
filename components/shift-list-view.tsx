"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { endOfWeek, getISOWeek, isSameDay, isSameWeek, isToday, startOfWeek } from "date-fns";
import { ArrowDownUp, Lock, RefreshCw, Search, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShiftWithCalendar } from "@/lib/types";
import { CalendarNote, ExternalSync, ShiftPreset } from "@/lib/db/schema";
import { formatDateToLocal, formatWeekRange } from "@/lib/date-utils";
import {
  ShiftSortOrder,
  ShiftSortType,
  formatHours,
  getShiftMinutes,
  shiftVars,
} from "@/lib/shift-display";
import { cn } from "@/lib/utils";
import { ShiftDetailRow } from "@/components/day-detail";
import {
  EventChip,
  NoteLine,
  TODAY_BADGE,
  buildDayContents,
  useDayPress,
} from "@/components/day-cell-entries";

export interface ListSort {
  type: ShiftSortType;
  order: ShiftSortOrder;
  /** The calendar pins its own view, so the personal sort would not apply */
  locked: boolean;
  onChange: (patch: { sortType?: ShiftSortType; sortOrder?: ShiftSortOrder }) => void;
}

interface ShiftListViewProps {
  variant: "desktop" | "phone";
  /** Every day of the visible month, so stamping by day click works on empty days too */
  days: Date[];
  selectedDay: Date;
  shifts: ShiftWithCalendar[];
  notes: CalendarNote[];
  presets: ShiftPreset[];
  externalSyncs: ExternalSync[];
  togglingDates: Set<string>;
  sort: ListSort;
  combinedSort: boolean;
  highlightedWeekdays?: number[];
  highlightColor?: string;
  /** A preset is armed: clicking a shift row stamps the day instead of opening the shift */
  stampArmed: boolean;
  canEditShift: (shift: ShiftWithCalendar) => boolean;
  canDeleteShift: (shift: ShiftWithCalendar) => boolean;
  onEditShift: (shift: ShiftWithCalendar) => void;
  onDeleteShift: (shift: ShiftWithCalendar) => void;
  onDayClick: (date: Date) => void;
  /** Selection only: a shift-row click opens the shift and marks its day, but must not stamp */
  onSelectDay: (date: Date) => void;
  onDayContextMenu?: (date: Date) => void;
  /** Bump `nonce` to scroll to `key` again */
  scrollTarget?: { key: string; nonce: number } | null;
}

const NO_PRESET = "none";
const WEEK = { weekStartsOn: 1 } as const;
const noop = () => undefined;

/** Filter chip a shift falls under: its sync, its preset, or "without preset". */
function chipKeyOf(shift: ShiftWithCalendar, presetIds: Set<string>): string {
  if (shift.syncedFromExternal && shift.externalSyncId) return `sync:${shift.externalSyncId}`;
  return shift.presetId && presetIds.has(shift.presetId) ? `preset:${shift.presetId}` : NO_PRESET;
}

export function ShiftListView({
  variant,
  days,
  selectedDay,
  shifts,
  notes,
  presets,
  externalSyncs,
  togglingDates,
  sort,
  combinedSort,
  highlightedWeekdays = [],
  highlightColor,
  stampArmed,
  canEditShift,
  canDeleteShift,
  onEditShift,
  onDeleteShift,
  onDayClick,
  onSelectDay,
  onDayContextMenu,
  scrollTarget,
}: ShiftListViewProps) {
  const t = useTranslations();
  const locale = useLocale();
  const desktop = variant === "desktop";
  const dayPress = useDayPress(onDayClick, onDayContextMenu);
  const [query, setQuery] = useState("");
  const [activeChips, setActiveChips] = useState<string[]>([]);
  const scroller = useRef<HTMLDivElement>(null);

  // A jump would land nowhere if search or chips hid its day, so a new target drops
  // them first. Adjusted during render per React's "state from props" pattern.
  const jumpNonce = scrollTarget?.nonce ?? 0;
  const [prevJumpNonce, setPrevJumpNonce] = useState(jumpNonce);
  if (jumpNonce !== prevJumpNonce) {
    setPrevJumpNonce(jumpNonce);
    setQuery("");
    setActiveChips([]);
  }

  const weekdayFormat = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short" }), [locale]);
  const presetIds = useMemo(() => new Set(presets.map((p) => p.id)), [presets]);

  // "minimal" syncs are listed in full here: the list is where details live
  const listSyncs = useMemo(
    () => externalSyncs.map((sync) => ({ ...sync, displayMode: "normal" as const })),
    [externalSyncs]
  );
  const contents = useMemo(
    () =>
      buildDayContents(
        days,
        shifts,
        notes,
        listSyncs,
        { sortType: sort.type, sortOrder: sort.order, combinedSort },
        () => true
      ),
    [days, shifts, notes, listSyncs, sort.type, sort.order, combinedSort]
  );

  const chips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const content of contents.values()) {
      for (const shift of content.layout.visible) {
        const key = chipKeyOf(shift, presetIds);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    const result: { key: string; label: string; color?: string; count: number; synced?: boolean }[] = [];
    for (const preset of presets) {
      const count = counts.get(`preset:${preset.id}`);
      if (count) result.push({ key: `preset:${preset.id}`, label: preset.title, color: preset.color, count });
    }
    const none = counts.get(NO_PRESET);
    if (none) result.push({ key: NO_PRESET, label: t("calendarView.listWithoutPreset"), count: none });
    for (const sync of externalSyncs) {
      const count = counts.get(`sync:${sync.id}`);
      if (count) result.push({ key: `sync:${sync.id}`, label: sync.name, color: sync.color, count, synced: true });
    }
    return result;
  }, [contents, presets, presetIds, externalSyncs, t]);

  // A chip can vanish with its last shift or a month change; ignore stale selections
  const effectiveChips = useMemo(() => {
    const known = new Set(chips.map((c) => c.key));
    return activeChips.filter((key) => known.has(key));
  }, [chips, activeChips]);
  const chipFilterKey = effectiveChips.join("|");
  const needle = query.trim().toLocaleLowerCase(locale);
  const filtering = needle.length > 0 || chipFilterKey.length > 0;

  const weeks = useMemo(() => {
    const active = new Set(chipFilterKey ? chipFilterKey.split("|") : []);
    const filtered = needle.length > 0 || active.size > 0;
    const matches = (text: string | null | undefined) =>
      !!text && text.toLocaleLowerCase(locale).includes(needle);
    const groups: {
      key: string;
      start: Date;
      days: { day: Date; key: string; shifts: ShiftWithCalendar[]; events: CalendarNote[]; notes: CalendarNote[] }[];
    }[] = [];

    for (const day of days) {
      const key = formatDateToLocal(day);
      const content = contents.get(key)!;
      const dayShifts = content.layout.visible.filter(
        (shift) =>
          (active.size === 0 || active.has(chipKeyOf(shift, presetIds))) &&
          (!needle || matches(shift.title) || matches(shift.notes))
      );
      // Notes never match a preset filter; with a search they must match it
      const showNotes = active.size === 0;
      const keepNote = (note: CalendarNote) => showNotes && (!needle || matches(note.note));
      const events = content.events.filter(keepNote);
      const dayNotes = content.notes.filter(keepNote);
      if (filtered && dayShifts.length + events.length + dayNotes.length === 0) continue;

      const start = startOfWeek(day, WEEK);
      const weekKey = formatDateToLocal(start);
      let group = groups[groups.length - 1];
      if (!group || group.key !== weekKey) {
        group = { key: weekKey, start, days: [] };
        groups.push(group);
      }
      group.days.push({ day, key, shifts: dayShifts, events, notes: dayNotes });
    }
    return groups;
  }, [days, contents, presetIds, needle, chipFilterKey, locale]);

  const scrollToKey = (key: string) => {
    const container = scroller.current;
    if (!container) return;
    const row = key ? container.querySelector<HTMLElement>(`[data-day="${key}"]`) : null;
    // 32px keeps the row clear of the sticky week header
    container.scrollTop = row ? Math.max(0, row.offsetTop - 32) : 0;
  };

  const monthKey = days.length > 0 ? formatDateToLocal(days[0]) : "";
  const scrollToFocus = useEffectEvent(() => {
    const todayKey = formatDateToLocal(new Date());
    const selectedKey = formatDateToLocal(selectedDay);
    const inMonth = (key: string) => days.some((d) => formatDateToLocal(d) === key);
    scrollToKey(inMonth(todayKey) ? todayKey : inMonth(selectedKey) ? selectedKey : "");
  });
  useEffect(() => {
    scrollToFocus();
  }, [monthKey]);

  const jumpTo = useEffectEvent((key: string) => scrollToKey(key));
  useEffect(() => {
    if (scrollTarget) jumpTo(scrollTarget.key);
  }, [scrollTarget]);

  const toggleChip = (key: string) =>
    setActiveChips((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const sortLabels: Record<ShiftSortType, string> = {
    startTime: t("view.sortByStartTime"),
    createdAt: t("view.sortByCreatedAt"),
    title: t("view.sortByTitle"),
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "flex shrink-0 flex-col gap-2 border-b border-line",
          desktop ? "px-[18px] pb-2.5 pt-3.5" : "px-3.5 pb-2.5"
        )}
      >
        <div className="flex items-center gap-2">
          {/* Not a <label>: the clear button would become the label's control */}
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("calendarView.listSearchPlaceholder")}
              aria-label={t("calendarView.listSearchPlaceholder")}
              className="h-9 w-full rounded-lg border border-line bg-surface-card pl-8 pr-8 text-[13.5px] text-fg-strong outline-none placeholder:text-fg-faint focus-visible:border-brand-dot [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("calendarView.listClearSearch")}
                className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-fg-tertiary hover:bg-surface-sunken"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={sort.locked}
              title={sort.locked ? t("calendarView.listSortPinnedHint") : t("view.sortOptions")}
              aria-label={t("view.sortOptions")}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] font-medium text-fg-secondary transition-colors hover:bg-surface-panel disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sort.locked ? <Lock className="size-3.5" /> : <ArrowDownUp className="size-4" />}
              {desktop && sortLabels[sort.type]}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("view.sortBy")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={sort.type}
                onValueChange={(value) => sort.onChange({ sortType: value as ShiftSortType })}
              >
                {(Object.keys(sortLabels) as ShiftSortType[]).map((type) => (
                  <DropdownMenuRadioItem key={type} value={type}>
                    {sortLabels[type]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t("view.sortOrder")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={sort.order}
                onValueChange={(value) => sort.onChange({ sortOrder: value as ShiftSortOrder })}
              >
                <DropdownMenuRadioItem value="asc">{t("view.sortOrderAsc")}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="desc">{t("view.sortOrderDesc")}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {chips.length > 0 && (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
            {chips.map((chip) => {
              const active = effectiveChips.includes(chip.key);
              return (
                <button
                  key={chip.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleChip(chip.key)}
                  className={cn(
                    "flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium transition-colors",
                    active
                      ? "border-transparent bg-brand-soft text-brand-ink"
                      : "border-line text-fg-secondary hover:bg-surface-panel"
                  )}
                >
                  {chip.synced ? (
                    <RefreshCw className="size-3 shrink-0" />
                  ) : chip.color ? (
                    <span className="shift-rail size-2 shrink-0 rounded-full" style={shiftVars(chip.color)} />
                  ) : null}
                  <span className="max-w-[180px] truncate">{chip.label}</span>
                  <span className="font-mono text-[11px] opacity-70">{chip.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* pb-16: the floating StampDock overlays the bottom of the scroller */}
      <div
        ref={scroller}
        className={cn("relative min-h-0 flex-1 overflow-y-auto", desktop ? "px-[18px] pb-16" : "px-2")}
      >
        {weeks.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-fg-tertiary">
            {filtering ? t("calendarView.listNoMatches") : t("shift.noShiftsInMonth")}
          </p>
        ) : (
          weeks.map((week) => (
            <section key={week.key}>
              <h2 className="sticky top-0 z-10 flex items-baseline gap-2 bg-background py-1.5 pl-1 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-fg-tertiary">
                {isSameWeek(week.start, new Date(), WEEK) ? (
                  <span className="text-brand-ink">{t("calendarView.thisWeek")}</span>
                ) : (
                  t("calendarView.calendarWeek", { week: getISOWeek(week.start) })
                )}
                <span className="font-mono font-normal normal-case tracking-normal text-fg-faint">
                  {formatWeekRange(week.start, endOfWeek(week.start, WEEK), locale, false)}
                </span>
              </h2>
              {week.days.map(({ day, key, shifts: dayShifts, events, notes: dayNotes }) => {
                const today = isToday(day);
                const selected = isSameDay(day, selectedDay);
                const weekend = day.getDay() === 0 || day.getDay() === 6;
                const highlighted = !!highlightColor && highlightedWeekdays.includes(day.getDay());
                const toggling = togglingDates.has(key);
                const minutes = dayShifts.reduce((sum, s) => sum + getShiftMinutes(s), 0);
                const empty = dayShifts.length + events.length + dayNotes.length === 0;
                const press = dayPress(day);

                return (
                  // Buttons must not nest: the gutter is the real control, the row forwards mouse clicks
                  <div
                    key={key}
                    // Scroll targets are looked up by this attribute instead of a ref map
                    data-day={key}
                    onClick={toggling ? undefined : press.onClick}
                    onContextMenu={press.onContextMenu}
                    onTouchStart={press.onTouchStart}
                    onTouchEnd={press.onTouchEnd}
                    onTouchMove={press.onTouchMove}
                    style={highlighted ? ({ "--highlight": highlightColor } as React.CSSProperties) : undefined}
                    className={cn(
                      "flex cursor-pointer items-stretch gap-3 rounded-[10px] border-b border-line px-1.5 transition-colors [-webkit-touch-callout:none]",
                      empty ? "py-1.5" : "py-2.5",
                      selected ? "bg-cell-selected" : "hover:bg-surface-panel",
                      highlighted && "day-highlight",
                      toggling && "cursor-wait opacity-60"
                    )}
                  >
                    <button
                      type="button"
                      disabled={toggling}
                      aria-pressed={selected}
                      aria-label={day.toLocaleDateString()}
                      // The row's handler runs through bubbling; this only needs to be focusable
                      className="flex w-11 shrink-0 flex-col items-center gap-0.5 rounded-md pt-0.5 outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]"
                    >
                      <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-cell-muted">
                        {weekdayFormat.format(day)}
                      </span>
                      <span
                        className={cn(
                          "inline-flex size-[26px] items-center justify-center rounded-full font-mono text-[14px] leading-none",
                          today ? TODAY_BADGE : weekend ? "text-cell-weekend-num" : "text-fg-body"
                        )}
                      >
                        {day.getDate()}
                      </span>
                    </button>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      {empty ? (
                        <span className="flex h-full items-center text-[12.5px] text-fg-faint">
                          {t("calendarView.dayFree")}
                        </span>
                      ) : (
                        <>
                          {dayShifts.length > 0 && (
                            <span className="font-mono text-[11.5px] text-fg-tertiary">
                              {t("calendarView.shiftCount", { count: dayShifts.length })}
                              {minutes > 0 && ` · ${formatHours(minutes, locale)}`}
                            </span>
                          )}
                          {dayShifts.length > 0 && (
                            // Unarmed, a click opens the shift; armed, it bubbles up to stamp instead.
                            // The long press stays on the day's own chrome, or it would open two sheets.
                            <div
                              className="flex flex-col gap-1.5"
                              onClick={(e) => {
                                if (stampArmed) return;
                                e.stopPropagation();
                                onSelectDay(day);
                              }}
                              onTouchStart={(e) => {
                                if (!stampArmed) e.stopPropagation();
                              }}
                            >
                              {dayShifts.map((shift) => (
                                <ShiftDetailRow
                                  key={shift.id}
                                  shift={shift}
                                  fullTitle
                                  canEdit={canEditShift(shift)}
                                  canDelete={canDeleteShift(shift)}
                                  actions="menu"
                                  onEdit={onEditShift}
                                  // Armed, the click must reach the row above and stamp instead
                                  onOpen={stampArmed ? noop : onEditShift}
                                  onDelete={onDeleteShift}
                                />
                              ))}
                            </div>
                          )}
                          {events.map((note) => (
                            <EventChip key={note.id} note={note} wrap />
                          ))}
                          {dayNotes.map((note) => (
                            <NoteLine key={note.id} note={note} wrap />
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
