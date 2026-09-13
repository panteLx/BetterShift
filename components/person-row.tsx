"use client";

import { ReactNode } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ListRow } from "@/components/form-kit";
import { cn, getUserInitials } from "@/lib/utils";

/** Avatar + name/email row shared by the permissions panel and the shift-signup list. */
export function PersonRow({
  user,
  highlight,
  suffix,
  action,
  fallback = "…",
  showEmail = true,
}: {
  user: { name: string | null; email?: string; image?: string | null };
  highlight?: boolean;
  suffix?: ReactNode;
  action?: ReactNode;
  /** Shown when the user has neither a name nor an email. */
  fallback?: ReactNode;
  /** Second line with the user's email below their name. */
  showEmail?: boolean;
}) {
  return (
    <ListRow>
      <Avatar className="size-8">
        {user.image && <AvatarImage src={user.image} alt="" />}
        <AvatarFallback
          className={cn(
            "text-[11.5px] font-semibold",
            highlight ? "bg-brand-soft text-brand-ink" : "bg-surface-sunken text-fg-secondary"
          )}
        >
          {getUserInitials(user)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-fg-strong">
          {user.name || user.email || fallback}
          {suffix}
        </div>
        {showEmail && user.name && user.email && (
          <div className="truncate text-[12px] text-fg-tertiary">{user.email}</div>
        )}
      </div>
      {action}
    </ListRow>
  );
}
