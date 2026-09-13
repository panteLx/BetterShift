"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, inputClass, Pill, RowIconButton, SectionLabel } from "@/components/form-kit";
import { PersonRow } from "@/components/calendar-share-list";
import { useAuth } from "@/hooks/useAuth";
import {
  useShiftSignupPermission,
  useShiftSignups,
  useCalendarMembers,
} from "@/hooks/useShiftSignups";
import { formatSignupCapacityLabel } from "@/lib/shift-display";
import type { CalendarMember, ShiftSignupUser } from "@/lib/types";

type SignupPerson = ShiftSignupUser | CalendarMember;

interface ShiftSignupListProps {
  calendarId: string;
  signupCapacity: number | null;
  onSignupCapacityChange: (value: number | null) => void;
  /** Whether the shift itself may be edited; gates the capacity field only. */
  readOnly: boolean;
  /** Existing shift: live signups via the API. Omit for a shift being created. */
  shiftId?: string;
  /** New shift being created: people picked so far, applied once it's saved. */
  pendingUserIds?: string[];
  onPendingUserIdsChange?: (userIds: string[]) => void;
}

export function ShiftSignupList({
  calendarId,
  signupCapacity,
  onSignupCapacityChange,
  readOnly,
  shiftId,
  pendingUserIds = [],
  onPendingUserIdsChange,
}: ShiftSignupListProps) {
  const t = useTranslations();
  const { user: currentUser } = useAuth();
  const { canManageOwn, canManageOthers, signupsEnabled } = useShiftSignupPermission(calendarId);
  const live = useShiftSignups(shiftId);
  const { members } = useCalendarMembers(calendarId, canManageOthers);
  const [pickedUserId, setPickedUserId] = useState("");

  const isPending = !shiftId;
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const signupUsers: SignupPerson[] = isPending
    ? pendingUserIds.map((id) => {
        if (currentUser && id === currentUser.id) return currentUser;
        const member = memberById.get(id);
        return member ? { id: member.id, name: member.name, image: member.image } : { id, name: null };
      })
    : live.signups;

  const availableMembers = useMemo(() => {
    const pickedIds = new Set(signupUsers.map((s) => s.id));
    return members.filter((m) => !pickedIds.has(m.id));
  }, [members, signupUsers]);

  if (!signupsEnabled) return null;

  const capacity = typeof signupCapacity === "number" ? signupCapacity : null;
  const isFull =
    capacity != null &&
    formatSignupCapacityLabel(t, signupUsers.length, capacity).isFull;
  const selfSignedUp = !!currentUser && signupUsers.some((s) => s.id === currentUser.id);
  // Guests can never hold a signup regardless of allowSelfSignup, so the hint
  // (which explains that specific toggle) would be misleading for them.
  const showSelfSignupDisabledHint = !!currentUser && !canManageOwn && !selfSignedUp;

  const addUser = (userId: string) => {
    if (isPending) {
      onPendingUserIdsChange?.([...pendingUserIds, userId]);
    } else {
      live.signUp(currentUser && userId === currentUser.id ? undefined : userId);
    }
  };

  const removeUser = (userId: string) => {
    if (isPending) {
      onPendingUserIdsChange?.(pendingUserIds.filter((id) => id !== userId));
    } else {
      live.withdraw(userId);
    }
  };

  const handleAddOther = () => {
    if (!pickedUserId) return;
    addUser(pickedUserId);
    setPickedUserId("");
  };

  return (
    <section className="flex flex-col gap-2.5 rounded-[11px] border border-line bg-surface-panel p-3.5">
      <div className="flex items-center justify-between">
        <SectionLabel className="mb-0">{t("shiftSignup.title")}</SectionLabel>
        {capacity != null && (
          <Pill tone={isFull ? "warning" : "neutral"}>
            {isFull
              ? t("shiftSignup.full")
              : t("shiftSignup.capacityProgress", { count: signupUsers.length, capacity })}
          </Pill>
        )}
      </div>

      {!readOnly && (
        <Field
          label={t("shiftSheet.signupCapacityLabel")}
          htmlFor="signupCapacity"
          hint={t("shiftSheet.signupCapacityHint")}
          optional
        >
          <Input
            id="signupCapacity"
            type="number"
            min={1}
            inputMode="numeric"
            value={signupCapacity ?? ""}
            onChange={(e) =>
              onSignupCapacityChange(e.target.value === "" ? null : Number(e.target.value))
            }
            className={inputClass}
          />
        </Field>
      )}

      {signupUsers.length === 0 && (
        <p className="rounded-[11px] border border-dashed border-control px-3.5 py-3 text-center text-[13px] text-fg-tertiary">
          {t("shiftSignup.empty")}
        </p>
      )}

      {signupUsers.map((signup) => {
        const canRemoveThis = canManageOthers || (canManageOwn && signup.id === currentUser?.id);
        return (
          <PersonRow
            key={signup.id}
            user={signup}
            fallback={signup.id}
            showEmail={false}
            action={
              canRemoveThis ? (
                <RowIconButton
                  icon={Trash2}
                  label={t("shiftSignup.remove")}
                  onClick={() => removeUser(signup.id)}
                  tone="danger"
                />
              ) : undefined
            }
          />
        );
      })}

      {canManageOwn && !selfSignedUp && !isFull && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => currentUser && addUser(currentUser.id)}
        >
          <UserPlus className="size-4" />
          {t("shiftSignup.addSelf")}
        </Button>
      )}

      {showSelfSignupDisabledHint && (
        <p className="text-[12px] text-fg-tertiary">{t("shiftSignup.selfSignupDisabled")}</p>
      )}

      {canManageOthers && !isFull && (
        <div className="flex flex-col gap-1.5">
          {availableMembers.length > 0 && (
            <div className="flex items-center gap-2">
              <Select value={pickedUserId} onValueChange={setPickedUserId}>
                <SelectTrigger className="h-9 flex-1 rounded-[9px]" aria-label={t("shiftSignup.addOther")}>
                  <SelectValue placeholder={t("shiftSignup.addOtherPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {availableMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name || member.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" size="sm" disabled={!pickedUserId} onClick={handleAddOther}>
                {t("shiftSignup.addOther")}
              </Button>
            </div>
          )}
          <p className="text-[12px] text-fg-tertiary">{t("shiftSignup.addOtherHint")}</p>
        </div>
      )}
    </section>
  );
}
