"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useCalendarTokens,
  CalendarAccessToken,
} from "@/hooks/useCalendarTokens";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarTokenCreateDialog } from "@/components/calendar-token-create-dialog";
import {
  Plus,
  MoreVertical,
  Eye,
  EyeOff,
  Trash2,
  Link as LinkIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getDateLocale } from "@/lib/locales";
import { useLocale } from "next-intl";

interface CalendarTokenListProps {
  calendarId: string;
}

export function CalendarTokenList({ calendarId }: CalendarTokenListProps) {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);

  const { tokens, fetchTokens, deleteToken, updateToken } =
    useCalendarTokens(calendarId);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tokenToDelete, setTokenToDelete] =
    useState<CalendarAccessToken | null>(null);

  useEffect(() => {
    if (calendarId) {
      void fetchTokens();
    }
  }, [calendarId, fetchTokens]);

  const handleDelete = async () => {
    if (!tokenToDelete) return;

    const success = await deleteToken(tokenToDelete.id);
    if (success) {
      setDeleteDialogOpen(false);
      setTokenToDelete(null);
    }
  };

  const handleToggleActive = async (token: CalendarAccessToken) => {
    await updateToken(token.id, {
      isActive: !token.isActive,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">
            {t("token.accessLinks")} ({tokens.length})
          </p>
          <p className="text-xs text-muted-foreground">
            {t("token.accessLinksDescription")}
          </p>
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          size="sm"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {t("common.add")}
        </Button>
      </div>

      {/* Token List */}
      {tokens.length === 0 ? (
        <div className="border rounded-lg p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <LinkIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{t("token.noTokensYet")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("token.noTokensDescription")}
              </p>
            </div>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              size="sm"
              className="gap-2 mt-2"
            >
              <Plus className="h-4 w-4" />
              {t("token.createFirstLink")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.labels.name")}</TableHead>
                <TableHead>{t("token.token")}</TableHead>
                <TableHead>{t("common.labels.permission")}</TableHead>
                <TableHead>{t("token.expires")}</TableHead>
                <TableHead>{t("token.usage")}</TableHead>
                <TableHead>{t("common.labels.status")}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((token) => (
                <TableRow key={token.id}>
                  {/* Name */}
                  <TableCell className="font-medium">
                    {token.name || (
                      <span className="text-muted-foreground italic">
                        {t("token.unnamed")}
                      </span>
                    )}
                  </TableCell>

                  {/* Token Preview */}
                  <TableCell className="font-mono text-xs">
                    {token.tokenPreview}
                  </TableCell>

                  {/* Permission */}
                  <TableCell>
                    <Badge variant="secondary">
                      {token.permission === "read"
                        ? t("common.labels.permissions.read")
                        : t("common.labels.permissions.write")}
                    </Badge>
                  </TableCell>

                  {/* Expiration */}
                  <TableCell className="text-sm">
                    {token.expiresAt ? (
                      <span>
                        {new Date(token.expiresAt) < new Date() ? (
                          <span className="text-destructive">
                            {t("token.expired")}
                          </span>
                        ) : (
                          formatDistanceToNow(new Date(token.expiresAt), {
                            addSuffix: true,
                            locale: dateLocale,
                          })
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {t("common.time.never")}
                      </span>
                    )}
                  </TableCell>

                  {/* Usage Stats */}
                  <TableCell className="text-sm">
                    <div className="space-y-0.5">
                      <div>
                        {t("token.usedCount", { count: token.usageCount })}
                      </div>
                      {token.lastUsedAt ? (
                        <div className="text-xs text-muted-foreground">
                          {" "}
                          {formatDistanceToNow(new Date(token.lastUsedAt), {
                            addSuffix: true,
                            locale: dateLocale,
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          {t("token.neverUsed")}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge variant={token.isActive ? "default" : "secondary"}>
                      {token.isActive
                        ? t("common.status.active")
                        : t("common.status.inactive")}
                    </Badge>
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleToggleActive(token)}
                        >
                          {token.isActive ? (
                            <>
                              <EyeOff className="h-4 w-4 mr-2" />
                              {t("token.disable")}
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-2" />
                              {t("token.enable")}
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setTokenToDelete(token);
                            setDeleteDialogOpen(true);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t("token.revoke")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Dialog */}
      <CalendarTokenCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        calendarId={calendarId}
        onSuccess={fetchTokens}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("token.revokeConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("token.revokeConfirmDescription", {
                name: tokenToDelete?.name || t("token.unnamed"),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive"
            >
              {t("token.revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
