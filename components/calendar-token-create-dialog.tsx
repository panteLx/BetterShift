"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { Copy, Check, AlertTriangle, Link as LinkIcon } from "lucide-react";
import { useCalendarTokens } from "@/hooks/useCalendarTokens";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getDateLocale } from "@/lib/locales";
import { useLocale } from "next-intl";

interface CalendarTokenCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string;
  onSuccess?: () => void;
}

export function CalendarTokenCreateDialog({
  open,
  onOpenChange,
  calendarId,
  onSuccess,
}: CalendarTokenCreateDialogProps) {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const { createToken, getShareLink } = useCalendarTokens(calendarId);

  const [step, setStep] = useState<"config" | "success">("config");
  const [name, setName] = useState("");
  const [permission, setPermission] = useState<"read" | "write">("read");
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(undefined);
  const [isCreating, setIsCreating] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Helper function to check if a preset button should be highlighted
  const isPresetActive = (days: number): boolean => {
    if (!expiresAt) return false;
    const now = new Date();
    const targetDate = new Date(now.getTime() + days * 86400000);
    return Math.abs(expiresAt.getTime() - targetDate.getTime()) < 3600000;
  };

  const handleCreate = async () => {
    setIsCreating(true);

    const token = await createToken({
      name: name.trim() || undefined,
      permission,
      expiresAt: expiresAt?.toISOString() || null,
    });

    setIsCreating(false);

    if (token && token.token) {
      setGeneratedToken(token.token);
      setShareLink(getShareLink(token.token));
      setStep("success");
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleClose = () => {
    // Call onSuccess when closing after successful creation
    if (step === "success") {
      onSuccess?.();
    }

    // Reset state
    setStep("config");
    setName("");
    setPermission("read");
    setExpiresAt(undefined);
    setGeneratedToken(null);
    setShareLink(null);
    setCopied(false);
    onOpenChange(false);
  };

  const handleExpirationPreset = (days: number | null) => {
    if (days === null) {
      setExpiresAt(undefined);
    } else {
      const date = new Date();
      date.setDate(date.getDate() + days);
      setExpiresAt(date);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        {step === "config" && (
          <>
            <DialogHeader>
              <DialogTitle>{t("token.createLink")}</DialogTitle>
              <DialogDescription>
                {t("token.createLinkDescription")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Name (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="token-name">
                  {t("common.labels.name")} {t("common.optional")}
                </Label>
                <Input
                  id="token-name"
                  placeholder={t("token.namePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                />
              </div>

              {/* Permission */}
              <div className="space-y-2">
                <Label htmlFor="token-permission">
                  {t("common.labels.permission")}
                </Label>
                <Select
                  value={permission}
                  onValueChange={(value: "read" | "write") =>
                    setPermission(value)
                  }
                >
                  <SelectTrigger id="token-permission">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">
                      {t("common.labels.permissions.read")} -{" "}
                      {t("token.readOnlyDescription")}
                    </SelectItem>
                    <SelectItem value="write">
                      {t("common.labels.permissions.write")} -{" "}
                      {t("token.editDescription")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Expiration */}
              <div className="space-y-2">
                <Label>{t("token.expiration")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={isPresetActive(1) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleExpirationPreset(1)}
                  >
                    {t("token.expiration1Day")}
                  </Button>
                  <Button
                    type="button"
                    variant={isPresetActive(7) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleExpirationPreset(7)}
                  >
                    {t("token.expiration7Days")}
                  </Button>
                  <Button
                    type="button"
                    variant={isPresetActive(30) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleExpirationPreset(30)}
                  >
                    {t("token.expiration30Days")}
                  </Button>
                  <Button
                    type="button"
                    variant={!expiresAt ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleExpirationPreset(null)}
                  >
                    {t("token.expirationNever")}
                  </Button>
                </div>
                {expiresAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("token.expiresOn")}:{" "}
                    {format(expiresAt, "PPP", { locale: dateLocale })}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating ? t("common.adding") : t("token.generate")}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "success" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                {t("token.linkCreated")}
              </DialogTitle>
              <DialogDescription>
                {t("token.linkCreatedDescription")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Warning */}
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{t("token.saveWarning")}</AlertDescription>
              </Alert>

              {/* Share Link */}
              <div className="space-y-2">
                <Label>{t("token.shareLink")}</Label>
                <div className="flex gap-2">
                  <Input
                    value={shareLink || ""}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleCopyLink}
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Token Preview */}
              {generatedToken && (
                <div className="space-y-2">
                  <Label>{t("token.tokenValue")}</Label>
                  <div className="p-3 bg-muted rounded-md font-mono text-xs break-all">
                    {generatedToken}
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex items-start gap-2">
                  <LinkIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{t("token.shareInfo")}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                {t("common.close")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
