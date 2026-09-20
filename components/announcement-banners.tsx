"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Megaphone, OctagonAlert, TriangleAlert, X } from "lucide-react";
import { StatusBanner } from "@/components/status-banner";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import type { AnnouncementPlacement, AnnouncementTone } from "@/lib/announcements";
import { cn, readStorage, writeStorage } from "@/lib/utils";

const DISMISS_KEY = "dismissed-announcements";
// One list across both placements, so dismissing on the dashboard doesn't
// resurrect on /login and vice versa. Capped rather than pruned against
// whichever placement happens to be mounted, which would erase the other
// placement's dismissals.
const MAX_DISMISSED = 100;

const TONE_ICONS: Record<AnnouncementTone, typeof Megaphone> = {
  info: Megaphone,
  warning: TriangleAlert,
  danger: OctagonAlert,
};

function readDismissed(): string[] {
  const raw = readStorage(DISMISS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function AnnouncementBanners({
  placement,
  className,
}: {
  placement: AnnouncementPlacement;
  className?: string;
}) {
  const t = useTranslations();
  const announcements = useAnnouncements(placement);
  const [dismissed, setDismissed] = useState<string[]>([]);
  // Storage is only read after mount: reading during render would make the
  // server and the first client render disagree.
  const [hydrated, setHydrated] = useState(false);

  // Legitimate hydration pattern: reading storage only after mount, not during render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(readDismissed());
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  const visible = announcements.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = [...prev, id].slice(-MAX_DISMISSED);
      writeStorage(DISMISS_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {visible.map((announcement) => (
        <StatusBanner
          key={announcement.id}
          tone={announcement.tone}
          icon={TONE_ICONS[announcement.tone]}
          title={announcement.title}
          action={
            <button
              type="button"
              onClick={() => dismiss(announcement.id)}
              aria-label={t("announcements.dismiss")}
              className="rounded-md p-1 text-fg-tertiary transition-colors hover:bg-surface-sunken hover:text-fg-strong"
            >
              <X className="size-4" />
            </button>
          }
        >
          {announcement.body && <span className="whitespace-pre-line">{announcement.body}</span>}
        </StatusBanner>
      ))}
    </div>
  );
}
