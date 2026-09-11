"use client";

import { useState } from "react";
import { useCalendarTokens } from "@/hooks/useCalendarTokens";

export type LinkValidity = "1" | "7" | "30" | "never";
export type LinkPermission = "read" | "write";

export interface CreatedAccessLink {
  token: string;
  link: string;
  name: string;
  permission: LinkPermission;
  validity: LinkValidity;
}

const VALIDITY_DAYS: Record<LinkValidity, number | null> = {
  "1": 1,
  "7": 7,
  "30": 30,
  never: null,
};

function expiryFor(validity: LinkValidity): Date | null {
  const days = VALIDITY_DAYS[validity];
  if (days === null) return null;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

const DEFAULT_VALIDITY: LinkValidity = "7";

/** Form state for creating an access link; the full token is only available right after creation. */
export function useAccessLinkForm(calendarId: string) {
  const { createToken, getShareLink } = useCalendarTokens(calendarId);

  const [name, setName] = useState("");
  const [permission, setPermission] = useState<LinkPermission>("read");
  const [validity, setValidityState] = useState<LinkValidity>(DEFAULT_VALIDITY);
  const [expiresAt, setExpiresAt] = useState<Date | null>(() =>
    expiryFor(DEFAULT_VALIDITY)
  );
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedAccessLink | null>(null);

  // A created link counts as saved; the one-time token view is not unsaved input.
  const dirty =
    !created &&
    (name.trim() !== "" || permission !== "read" || validity !== DEFAULT_VALIDITY);

  const setValidity = (value: LinkValidity) => {
    setValidityState(value);
    setExpiresAt(expiryFor(value));
  };

  const create = async () => {
    setCreating(true);
    // Recomputed so a form left open for a while still gets the full period.
    const expiry = expiryFor(validity);
    const result = await createToken({
      name: name.trim() || undefined,
      permission,
      expiresAt: expiry?.toISOString() ?? null,
    });
    setCreating(false);

    if (result?.token) {
      setCreated({
        token: result.token,
        link: getShareLink(result.token),
        name: name.trim(),
        permission,
        validity,
      });
    }
  };

  const reset = () => {
    setName("");
    setPermission("read");
    setValidity(DEFAULT_VALIDITY);
    setCreated(null);
  };

  return {
    name,
    setName,
    permission,
    setPermission,
    validity,
    setValidity,
    expiresAt,
    dirty,
    creating,
    created,
    create,
    reset,
  };
}
