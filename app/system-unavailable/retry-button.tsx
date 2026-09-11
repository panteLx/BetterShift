"use client";

import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stateActionClass } from "@/components/empty-state-block";

// The proxy sends a reload of this page back to "/" once the DB is healthy again
export function RetryButton({ label }: { label: string }) {
  return (
    <Button onClick={() => window.location.reload()} className={stateActionClass}>
      <RotateCw className="size-[17px]" />
      {label}
    </Button>
  );
}
