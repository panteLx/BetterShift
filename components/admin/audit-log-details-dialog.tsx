"use client";

import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { getDateLocale } from "@/lib/locales";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Copy, X } from "lucide-react";
import { toast } from "sonner";
import type { AuditLog } from "@/hooks/useAuditLogs";

interface AuditLogDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: AuditLog;
}

export function AuditLogDetailsDialog({
  open,
  onOpenChange,
  log,
}: AuditLogDetailsDialogProps) {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);

  // Get user initials
  const getUserInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Severity badge color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "info":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "warning":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "error":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "critical":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  // Action category badge color
  const getActionColor = (action: string) => {
    if (action.startsWith("admin.")) {
      return "bg-red-500/10 text-red-500 border-red-500/20";
    }
    if (action.startsWith("calendar")) {
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
    if (action.startsWith("auth")) {
      return "bg-green-500/10 text-green-500 border-green-500/20";
    }
    if (action.startsWith("security")) {
      return "bg-orange-500/10 text-orange-500 border-orange-500/20";
    }
    return "bg-gray-500/10 text-gray-500 border-gray-500/20";
  };

  // Copy JSON to clipboard
  const copyToClipboard = () => {
    const jsonString = JSON.stringify(
      {
        id: log.id,
        action: log.action,
        timestamp: log.timestamp,
        severity: log.severity,
        userId: log.userId,
        userName: log.userName,
        userEmail: log.userEmail,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        isUserVisible: log.isUserVisible,
      },
      null,
      2
    );

    navigator.clipboard.writeText(jsonString);
    toast.success(t("common.copied", { item: t("admin.metadata") }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("admin.auditLogDetails")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Action & Severity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                {t("common.labels.action")}
              </div>
              <Badge variant="outline" className={getActionColor(log.action)}>
                {log.action}
              </Badge>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                {t("common.labels.severity")}
              </div>
              <Badge
                variant="outline"
                className={getSeverityColor(log.severity)}
              >
                {log.severity}
              </Badge>
            </div>
          </div>

          {/* Timestamp */}
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">
              {t("admin.timestamp")}
            </div>
            <div className="text-sm">
              {format(new Date(log.timestamp), "PPpp", { locale: dateLocale })}
            </div>
          </div>

          {/* User Details */}
          {log.userId != null && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                {t("common.labels.user")}
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Avatar className="h-10 w-10">
                  {log.userImage && (
                    <AvatarImage src={log.userImage} alt={log.userName || ""} />
                  )}
                  <AvatarFallback>
                    {getUserInitials(log.userName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-medium">
                    {log.userName || t("admin.unknownUser")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {log.userEmail || "—"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Resource */}
          {log.resourceType != null && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  {t("admin.resourceType")}
                </div>
                <div className="text-sm">{log.resourceType}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  {t("admin.resourceId")}
                </div>
                <div className="text-sm font-mono text-xs">
                  {log.resourceId || "—"}
                </div>
              </div>
            </div>
          )}

          {/* IP Address */}
          {log.ipAddress != null && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                {t("common.labels.ipAddress")}
              </div>
              <div className="text-sm font-mono">{log.ipAddress}</div>
            </div>
          )}

          {/* User Agent */}
          {log.userAgent != null && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                {t("admin.userAgent")}
              </div>
              <div className="text-xs text-muted-foreground break-all">
                {log.userAgent}
              </div>
            </div>
          )}

          {/* Metadata */}
          {log.metadata != null && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-muted-foreground">
                  {t("admin.metadata")}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyToClipboard}
                  className="h-7"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  {t("common.copy")}
                </Button>
              </div>
              <pre className="text-xs bg-muted p-4 rounded-lg border overflow-x-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}

          {/* Additional Info */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                {t("admin.logId")}
              </div>
              <div className="text-xs font-mono">{log.id}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                {t("admin.userVisible")}
              </div>
              <div className="text-sm">
                {log.isUserVisible ? t("common.yes") : t("common.no")}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
