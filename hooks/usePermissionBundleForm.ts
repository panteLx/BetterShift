"use client";

import { useState } from "react";
import {
  normalizeCapabilities,
  type Capability,
} from "@/lib/permission-bundles";
import type { PermissionBundleWithUsage } from "@/hooks/useCalendarBundles";

function sameCapabilities(a: Capability[], b: Capability[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((c) => setB.has(c));
}

/** Draft state for editing one bundle's name/capabilities (Gruppen tab). Instantiate keyed by bundle.id. */
export function usePermissionBundleForm(bundle: PermissionBundleWithUsage) {
  const [name, setName] = useState(bundle.name);
  const [capabilities, setCapabilities] = useState<Capability[]>(bundle.capabilities);

  // E7: a bundle reachable by a guest/link source can't hold admin-only capabilities.
  const isGuestBound = bundle.usage.isGuestBundle || bundle.usage.tokenCount > 0;

  // S4: "only stamp presets" is bypassable by creating an arbitrary preset first.
  const stampPresetBypassWarning =
    capabilities.includes("stampPreset") &&
    !capabilities.includes("createShift") &&
    capabilities.includes("createPreset");

  const toggle = (capability: Capability, checked: boolean) => {
    const next = checked
      ? [...capabilities, capability]
      : capabilities.filter((c) => c !== capability);
    // S3: dependencies are re-applied on every toggle so they stay visibly ticked.
    setCapabilities(normalizeCapabilities(next));
  };

  const dirty =
    name.trim() !== bundle.name || !sameCapabilities(capabilities, bundle.capabilities);

  const reset = () => {
    setName(bundle.name);
    setCapabilities(bundle.capabilities);
  };

  return {
    name,
    setName,
    capabilities,
    toggle,
    dirty,
    isGuestBound,
    stampPresetBypassWarning,
    reset,
  };
}
