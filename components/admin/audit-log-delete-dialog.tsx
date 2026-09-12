"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, inputClass } from "@/components/form-kit";
import { PanelDialog } from "@/components/panel-dialog";
import { StatusBanner } from "@/components/status-banner";
import { useAdminAuditLogs } from "@/hooks/useAdminAuditLogs";
import { formatDateToLocal, parseLocalDate } from "@/lib/date-utils";
import { getDateLocale } from "@/lib/locales";

interface AuditLogDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLogIds?: string[];
  onSuccess?: () => void;
}

export function AuditLogDeleteDialog({
  open,
  onOpenChange,
  selectedLogIds = [],
  onSuccess,
}: AuditLogDeleteDialogProps) {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const { deleteLogsByDate, deleteLogsByIds, isLoading } = useAdminAuditLogs(
    undefined,
    undefined,
    undefined,
    { listEnabled: false }
  );

  const [beforeDate, setBeforeDate] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  // Selected rows take precedence over the date cut-off
  const deleteByIds = selectedLogIds.length > 0;

  const reset = () => {
    setBeforeDate("");
    setConfirmed(false);
  };

  const handleDelete = async () => {
    if (!confirmed) {
      toast.error(t("admin.pleaseConfirmDeletion"));
      return;
    }

    let success: boolean;
    if (deleteByIds) {
      success = await deleteLogsByIds(selectedLogIds);
    } else {
      if (!beforeDate) {
        toast.error(t("admin.pleaseSelectDate"));
        return;
      }
      success = await deleteLogsByDate(beforeDate);
    }

    if (success) {
      onOpenChange(false);
      reset();
      onSuccess?.();
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      onOpenChange(true);
    } else if (!isLoading) {
      onOpenChange(false);
      reset();
    }
  };

  const title = deleteByIds ? t("common.deleteSelected") : t("admin.deleteOldLogs");

  return (
    <PanelDialog
      open={open}
      onOpenChange={handleOpenChange}
      width="sm"
      title={title}
      description={
        deleteByIds
          ? t("admin.deleteSelectedLogsDescription", { count: selectedLogIds.length })
          : t("admin.deleteLogsDescription")
      }
      bodyClassName="flex flex-col gap-4"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
            className="h-10 flex-1 font-semibold"
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading || (!deleteByIds && !beforeDate) || !confirmed}
            className="h-10 flex-1 font-semibold"
          >
            {isLoading ? t("common.loading") : title}
          </Button>
        </>
      }
    >
      {deleteByIds ? (
        <div className="rounded-[10px] border border-line bg-surface-panel px-3 py-2.5 text-[13px] text-fg-secondary">
          {t("admin.willDeleteSelectedLogs", { count: selectedLogIds.length })}
        </div>
      ) : (
        <>
          <Field label={t("admin.deleteLogsBefore")} htmlFor="audit-delete-before" hint={t("admin.deleteLogsBeforeHint")}>
            <Input
              id="audit-delete-before"
              type="date"
              value={beforeDate}
              onChange={(e) => setBeforeDate(e.target.value)}
              max={formatDateToLocal(new Date())}
              disabled={isLoading}
              className={inputClass}
            />
          </Field>
          {beforeDate && (
            <div className="rounded-[10px] border border-line bg-surface-panel px-3 py-2.5 text-[13px] text-fg-secondary">
              {t("admin.willDeleteLogsOlderThan", {
                date: format(parseLocalDate(beforeDate), "PP", { locale: dateLocale }),
              })}
            </div>
          )}
        </>
      )}

      <StatusBanner tone="danger" icon={TriangleAlert}>
        {t("admin.deleteLogsWarning")}
      </StatusBanner>

      <label htmlFor="confirm-delete" className="flex cursor-pointer items-start gap-3 text-[13px] text-fg-body">
        <Checkbox
          id="confirm-delete"
          checked={confirmed}
          onCheckedChange={(checked) => setConfirmed(checked === true)}
          disabled={isLoading}
          className="mt-px"
        />
        {t("admin.confirmPermanentDeletion")}
      </label>
    </PanelDialog>
  );
}
