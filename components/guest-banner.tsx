"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBanner } from "@/components/status-banner";

interface GuestBannerProps {
  variant?: "default" | "compact";
}

export function GuestBanner({ variant = "default" }: GuestBannerProps) {
  const t = useTranslations();

  return (
    <StatusBanner
      tone="info"
      icon={Info}
      title={t("guest.viewingAsGuest")}
      action={
        <Button asChild size="sm" variant="outline" className="h-8 font-semibold">
          <Link href="/login">{t("auth.login")}</Link>
        </Button>
      }
    >
      {variant === "default" ? t("guest.bannerMessage") : undefined}
    </StatusBanner>
  );
}
