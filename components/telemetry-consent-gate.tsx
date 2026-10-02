"use client";

import { useState } from "react";
import { TelemetryConsentDialog } from "@/components/telemetry-consent-dialog";
import { useVersionUpdateCheck } from "@/hooks/useVersionUpdate";

/** Consent prompt for pages outside the main app (portal); the server only asks instance admins off workspace hosts. */
export function TelemetryConsentGate() {
  const { versionInfo } = useVersionUpdateCheck();
  const [decided, setDecided] = useState(false);
  if (!versionInfo?.telemetryPrompt || decided) return null;
  return <TelemetryConsentDialog open onDecide={() => setDecided(true)} />;
}
