"use client";

import { useMemo, useState } from "react";
import { useCalendarTokens } from "@/hooks/useCalendarTokens";
import { useCalendarBundles } from "@/hooks/useCalendarBundles";
import { isGuestEligible } from "@/lib/permission-bundles";

export type LinkValidity = "1" | "7" | "30" | "never";

export interface CreatedAccessLink {
  token: string;
  link: string;
  name: string;
  bundleId: string;
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
export function usePermissionLinkForm(calendarId: string) {
  const { createToken, getShareLink } = useCalendarTokens(calendarId);
  const { bundles, isError: bundlesError } = useCalendarBundles(calendarId);
  const guestEligibleBundles = useMemo(
    () => bundles.filter((b) => isGuestEligible(b.capabilities)),
    [bundles]
  );

  const [name, setName] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [validity, setValidityState] = useState<LinkValidity>(DEFAULT_VALIDITY);
  const [expiresAt, setExpiresAt] = useState<Date | null>(() =>
    expiryFor(DEFAULT_VALIDITY)
  );
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedAccessLink | null>(null);

  // A calendar's default seeded "Read" bundle is a sensible default once bundles
  // have loaded; falls back to the first guest-eligible bundle otherwise. Kept
  // as a derived value (not an effect) so an explicit pick always wins.
  const effectiveBundleId =
    bundleId ||
    guestEligibleBundles.find((b) => b.seedKey === "read")?.id ||
    guestEligibleBundles[0]?.id ||
    "";

  // A created link counts as saved; the one-time token view is not unsaved input.
  const dirty =
    !created &&
    (name.trim() !== "" || bundleId !== "" || validity !== DEFAULT_VALIDITY);

  const setValidity = (value: LinkValidity) => {
    setValidityState(value);
    setExpiresAt(expiryFor(value));
  };

  const create = async () => {
    if (!effectiveBundleId) return;
    setCreating(true);
    // Recomputed so a form left open for a while still gets the full period.
    const expiry = expiryFor(validity);
    const result = await createToken({
      name: name.trim() || undefined,
      bundleId: effectiveBundleId,
      expiresAt: expiry?.toISOString() ?? null,
    });
    setCreating(false);

    if (result?.token) {
      setCreated({
        token: result.token,
        link: getShareLink(result.token),
        name: name.trim(),
        bundleId: effectiveBundleId,
        validity,
      });
    }
  };

  const reset = () => {
    setName("");
    setBundleId("");
    setValidity(DEFAULT_VALIDITY);
    setCreated(null);
  };

  return {
    name,
    setName,
    bundleId: effectiveBundleId,
    setBundleId,
    guestEligibleBundles,
    bundlesError,
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
