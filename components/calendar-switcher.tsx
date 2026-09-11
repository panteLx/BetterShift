"use client";

import { useTranslations } from "next-intl";
import {
  ChevronDown,
  Columns2,
  Globe,
  Link2,
  Lock,
  Plus,
  ShieldCheck,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarWithCount } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";
import { cn } from "@/lib/utils";

interface CalendarSwitcherProps {
  calendars: CalendarWithCount[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  onCompare?: () => void;
  size?: "desktop" | "mobile";
}

type Group = { key: string; label: string; icon: LucideIcon; items: CalendarWithCount[] };

export function isCalendarReadOnly(
  calendar: CalendarWithCount,
  userId: string | undefined
): boolean {
  if (userId && calendar.ownerId === userId) return false;
  if (calendar.sharePermission) return calendar.sharePermission === "read";
  if (calendar.tokenPermission) return calendar.tokenPermission === "read";
  return calendar.guestPermission === "read";
}

export function CalendarSwitcher({
  calendars,
  selectedId,
  onSelect,
  onCreateNew,
  onCompare,
  size = "desktop",
}: CalendarSwitcherProps) {
  const t = useTranslations();
  const { isGuest, user } = useAuth();
  const { isAuthEnabled } = useAuthFeatures();

  const visible = isGuest
    ? calendars.filter(
        (c) =>
          c.guestPermission === "read" ||
          c.guestPermission === "write" ||
          c.tokenPermission === "read" ||
          c.tokenPermission === "write"
      )
    : calendars;
  const selected = visible.find((c) => c.id === selectedId);
  const signedIn = isAuthEnabled && !!user && !isGuest;

  const groups: Group[] = signedIn
    ? [
        {
          key: "own",
          label: t("calendar.myCalendars"),
          icon: User,
          items: visible.filter((c) => c.ownerId === user!.id),
        },
        {
          key: "shared",
          label: t("calendar.sharedCalendars"),
          icon: Users,
          items: visible.filter((c) => c.ownerId !== user!.id && c.sharePermission),
        },
        {
          key: "token",
          label: t("calendar.tokenCalendars"),
          icon: Link2,
          items: visible.filter(
            (c) => c.tokenPermission && !c.sharePermission && c.ownerId !== user!.id
          ),
        },
        {
          key: "public",
          label: t("calendar.publicCalendars"),
          icon: Globe,
          items: visible.filter(
            (c) =>
              c.guestPermission &&
              !c.sharePermission &&
              !c.tokenPermission &&
              c.ownerId !== user!.id
          ),
        },
      ].filter((g) => g.items.length > 0)
    : [{ key: "all", label: "", icon: Globe, items: visible }];

  const statusIcon = (calendar: CalendarWithCount) => {
    if (!isAuthEnabled) return null;
    if (calendar.sharePermission === "admin" || calendar.sharePermission === "owner") {
      return <ShieldCheck className="h-3.5 w-3.5 text-brand-ink" />;
    }
    if (isCalendarReadOnly(calendar, user?.id)) {
      return <Lock className="h-3.5 w-3.5 text-warning" />;
    }
    return null;
  };

  const mobile = size === "mobile";
  const readOnly = selected && isAuthEnabled && isCalendarReadOnly(selected, user?.id);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex min-w-0 items-center outline-none transition-colors",
          mobile
            ? "gap-2 rounded-lg py-1 pr-1"
            : "h-[34px] gap-[9px] rounded-lg border border-line px-[11px] hover:bg-surface-panel"
        )}
      >
        {readOnly ? (
          <Lock className={cn("shrink-0 text-warning", mobile ? "size-4" : "size-3.5")} />
        ) : (
          <span
            className={cn("shrink-0 rounded-full", mobile ? "size-[9px]" : "size-2")}
            style={{ backgroundColor: selected?.color ?? "var(--brand)" }}
          />
        )}
        <span
          className={cn(
            "truncate font-semibold text-fg-strong",
            mobile ? "text-base" : "max-w-[220px] text-sm"
          )}
        >
          {selected?.name ?? t("calendar.title")}
        </span>
        <ChevronDown
          className={cn("shrink-0 text-fg-tertiary", mobile ? "size-4" : "size-[15px]")}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuRadioGroup value={selectedId} onValueChange={onSelect}>
          {groups.map((group, index) => (
            <div key={group.key}>
              {index > 0 && <DropdownMenuSeparator />}
              {group.label && (
                <DropdownMenuLabel className="flex items-center gap-1.5 eyebrow">
                  <group.icon className="size-3" />
                  {group.label}
                </DropdownMenuLabel>
              )}
              {group.items.map((calendar) => (
                <DropdownMenuRadioItem key={calendar.id} value={calendar.id} className="gap-2.5">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: calendar.color }}
                  />
                  <span className="flex-1 truncate">{calendar.name}</span>
                  {statusIcon(calendar)}
                </DropdownMenuRadioItem>
              ))}
            </div>
          ))}
        </DropdownMenuRadioGroup>
        {(!isGuest || (onCompare && visible.length >= 2)) && <DropdownMenuSeparator />}
        {onCompare && visible.length >= 2 && (
          <DropdownMenuItem onClick={onCompare}>
            <Columns2 className="mr-2 h-4 w-4" />
            {t("calendar.compare")}
          </DropdownMenuItem>
        )}
        {!isGuest && (
          <DropdownMenuItem onClick={onCreateNew}>
            <Plus className="mr-2 h-4 w-4" />
            {t("calendar.create")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
