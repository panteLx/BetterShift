"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Search, Mail, Globe, Check, Clock, Shield, ShieldOff, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { getDateLocale } from "@/lib/locales";
import { useLocale } from "next-intl";

type RegistrationMode = "open" | "whitelist" | "closed";

interface WhitelistEntry {
    id: string;
    pattern: string;
    patternType: "email" | "domain";
    addedBy: string | null;
    usedAt: string | null;
    usedByUserId: string | null;
    createdAt: string;
    addedByUser?: { id: string; name: string; email: string } | null;
    usedByUser?: { id: string; name: string; email: string } | null;
}

export default function AdminWhitelistPage() {
    const t = useTranslations();
    const locale = useLocale();
    const dateLocale = getDateLocale(locale);

    const [entries, setEntries] = useState<WhitelistEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Registration mode state
    const [registrationMode, setRegistrationMode] = useState<RegistrationMode>("open");
    const [isChangingMode, setIsChangingMode] = useState(false);

    // Add dialog
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [newPattern, setNewPattern] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    // Delete dialog
    const [deleteEntry, setDeleteEntry] = useState<WhitelistEntry | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Fetch settings
    const fetchSettings = async () => {
        try {
            const response = await fetch("/api/admin/settings");
            if (response.ok) {
                const data = await response.json();
                setRegistrationMode(data.registrationMode);
            }
        } catch (error) {
            console.error("Failed to fetch settings:", error);
        }
    };

    // Fetch whitelist entries
    const fetchEntries = async () => {
        try {
            const response = await fetch("/api/admin/whitelist");
            if (!response.ok) throw new Error("Failed to fetch");
            const data = await response.json();
            setEntries(data);
        } catch (error) {
            console.error("Failed to fetch whitelist:", error);
            toast.error(t("admin.whitelist.fetchError"));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
        fetchEntries();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Change registration mode
    const handleModeChange = async (newMode: RegistrationMode) => {
        if (newMode === registrationMode) return;

        setIsChangingMode(true);
        try {
            const response = await fetch("/api/admin/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ registrationMode: newMode }),
            });

            if (!response.ok) {
                throw new Error("Failed to update");
            }

            const data = await response.json();
            setRegistrationMode(data.registrationMode);
            toast.success(t("admin.whitelist.modeChangeSuccess"));
        } catch (error) {
            console.error("Failed to change registration mode:", error);
            toast.error(t("admin.whitelist.modeChangeError"));
        } finally {
            setIsChangingMode(false);
        }
    };

    // Add entry
    const handleAdd = async () => {
        if (!newPattern.trim()) return;

        setIsAdding(true);
        try {
            const response = await fetch("/api/admin/whitelist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pattern: newPattern.trim() }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to add");
            }

            toast.success(t("admin.whitelist.addSuccess"));
            setShowAddDialog(false);
            setNewPattern("");
            fetchEntries();
        } catch (error) {
            console.error("Failed to add to whitelist:", error);
            toast.error(
                error instanceof Error ? error.message : t("admin.whitelist.addError")
            );
        } finally {
            setIsAdding(false);
        }
    };

    // Delete entry
    const handleDelete = async () => {
        if (!deleteEntry) return;

        setIsDeleting(true);
        try {
            const response = await fetch(`/api/admin/whitelist/${deleteEntry.id}`, {
                method: "DELETE",
            });

            if (!response.ok) throw new Error("Failed to delete");

            toast.success(t("admin.whitelist.deleteSuccess"));
            setDeleteEntry(null);
            fetchEntries();
        } catch (error) {
            console.error("Failed to delete whitelist entry:", error);
            toast.error(t("admin.whitelist.deleteError"));
        } finally {
            setIsDeleting(false);
        }
    };

    // Filter entries
    const filteredEntries = entries.filter(
        (entry) =>
            entry.pattern.toLowerCase().includes(searchQuery.toLowerCase()) ||
            entry.addedByUser?.name
                ?.toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
            entry.usedByUser?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Stats
    const totalEntries = entries.length;
    const usedEntries = entries.filter((e) => e.usedAt).length;
    const pendingEntries = entries.filter(
        (e) => !e.usedAt && e.patternType === "email"
    ).length;
    const domainEntries = entries.filter((e) => e.patternType === "domain").length;

    if (isLoading) {
        return <FullscreenLoader />;
    }

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">
                            {t("admin.whitelist.title")}
                        </h2>
                        <p className="text-muted-foreground mt-2">
                            {t("admin.whitelist.description")}
                        </p>
                    </div>
                    <Button onClick={() => setShowAddDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t("admin.whitelist.addEntry")}
                    </Button>
                </div>

                {/* Registration Mode Card with Selector */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            {t("admin.whitelist.currentMode")}
                        </CardTitle>
                        <CardDescription>
                            {t("admin.whitelist.modeSelectDescription")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {/* Open Mode */}
                            <button
                                onClick={() => handleModeChange("open")}
                                disabled={isChangingMode}
                                className={`relative flex flex-col items-start gap-2 rounded-lg border-2 p-4 text-left transition-all hover:bg-accent ${registrationMode === "open"
                                        ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                                        : "border-border hover:border-green-500/50"
                                    }`}
                            >
                                <div className="flex w-full items-center justify-between">
                                    <ShieldOff className={`h-5 w-5 ${registrationMode === "open" ? "text-green-600" : "text-muted-foreground"}`} />
                                    {registrationMode === "open" && (
                                        <Badge variant="secondary" className="bg-green-500 text-white">
                                            {t("admin.whitelist.active")}
                                        </Badge>
                                    )}
                                </div>
                                <div>
                                    <p className="font-medium">{t("admin.whitelist.modeOpen")}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {t("admin.whitelist.modeOpenDescription")}
                                    </p>
                                </div>
                            </button>

                            {/* Whitelist Mode */}
                            <button
                                onClick={() => handleModeChange("whitelist")}
                                disabled={isChangingMode}
                                className={`relative flex flex-col items-start gap-2 rounded-lg border-2 p-4 text-left transition-all hover:bg-accent ${registrationMode === "whitelist"
                                        ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
                                        : "border-border hover:border-yellow-500/50"
                                    }`}
                            >
                                <div className="flex w-full items-center justify-between">
                                    <ShieldCheck className={`h-5 w-5 ${registrationMode === "whitelist" ? "text-yellow-600" : "text-muted-foreground"}`} />
                                    {registrationMode === "whitelist" && (
                                        <Badge variant="secondary" className="bg-yellow-500 text-white">
                                            {t("admin.whitelist.active")}
                                        </Badge>
                                    )}
                                </div>
                                <div>
                                    <p className="font-medium">{t("admin.whitelist.modeWhitelist")}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {t("admin.whitelist.modeWhitelistDescription")}
                                    </p>
                                </div>
                            </button>

                            {/* Closed Mode */}
                            <button
                                onClick={() => handleModeChange("closed")}
                                disabled={isChangingMode}
                                className={`relative flex flex-col items-start gap-2 rounded-lg border-2 p-4 text-left transition-all hover:bg-accent ${registrationMode === "closed"
                                        ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                                        : "border-border hover:border-red-500/50"
                                    }`}
                            >
                                <div className="flex w-full items-center justify-between">
                                    <Shield className={`h-5 w-5 ${registrationMode === "closed" ? "text-red-600" : "text-muted-foreground"}`} />
                                    {registrationMode === "closed" && (
                                        <Badge variant="secondary" className="bg-red-500 text-white">
                                            {t("admin.whitelist.active")}
                                        </Badge>
                                    )}
                                </div>
                                <div>
                                    <p className="font-medium">{t("admin.whitelist.modeClosed")}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {t("admin.whitelist.modeClosedDescription")}
                                    </p>
                                </div>
                            </button>
                        </div>
                    </CardContent>
                </Card>

                {/* Stats */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {t("admin.whitelist.totalEntries")}
                            </CardTitle>
                            <Mail className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalEntries}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {t("admin.whitelist.pending")}
                            </CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{pendingEntries}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {t("admin.whitelist.used")}
                            </CardTitle>
                            <Check className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{usedEntries}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {t("admin.whitelist.domains")}
                            </CardTitle>
                            <Globe className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{domainEntries}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={t("admin.whitelist.searchPlaceholder")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {/* Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t("admin.whitelist.entries")}</CardTitle>
                        <CardDescription>
                            {t("admin.whitelist.entriesDescription")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {filteredEntries.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                {searchQuery
                                    ? t("admin.whitelist.noSearchResults")
                                    : t("admin.whitelist.noEntries")}
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t("admin.whitelist.pattern")}</TableHead>
                                        <TableHead>{t("admin.whitelist.type")}</TableHead>
                                        <TableHead>{t("admin.whitelist.status")}</TableHead>
                                        <TableHead>{t("admin.whitelist.addedBy")}</TableHead>
                                        <TableHead>{t("admin.whitelist.addedAt")}</TableHead>
                                        <TableHead className="text-right">
                                            {t("common.actions")}
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredEntries.map((entry) => (
                                        <TableRow key={entry.id}>
                                            <TableCell className="font-mono">{entry.pattern}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        entry.patternType === "domain"
                                                            ? "secondary"
                                                            : "outline"
                                                    }
                                                >
                                                    {entry.patternType === "domain" ? (
                                                        <>
                                                            <Globe className="h-3 w-3 mr-1" />
                                                            {t("admin.whitelist.typeDomain")}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Mail className="h-3 w-3 mr-1" />
                                                            {t("admin.whitelist.typeEmail")}
                                                        </>
                                                    )}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {entry.patternType === "domain" ? (
                                                    <Badge variant="secondary">
                                                        {t("admin.whitelist.statusActive")}
                                                    </Badge>
                                                ) : entry.usedAt ? (
                                                    <Badge variant="default">
                                                        <Check className="h-3 w-3 mr-1" />
                                                        {t("admin.whitelist.statusUsed")}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline">
                                                        <Clock className="h-3 w-3 mr-1" />
                                                        {t("admin.whitelist.statusPending")}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {entry.addedByUser?.name || "-"}
                                            </TableCell>
                                            <TableCell>
                                                {formatDistanceToNow(new Date(entry.createdAt), {
                                                    addSuffix: true,
                                                    locale: dateLocale,
                                                })}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setDeleteEntry(entry)}
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Add Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("admin.whitelist.addDialogTitle")}</DialogTitle>
                        <DialogDescription>
                            {t("admin.whitelist.addDialogDescription")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Input
                            placeholder={t("admin.whitelist.patternPlaceholder")}
                            value={newPattern}
                            onChange={(e) => setNewPattern(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleAdd();
                            }}
                        />
                        <p className="text-sm text-muted-foreground">
                            {t("admin.whitelist.patternHelp")}
                        </p>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowAddDialog(false)}
                            disabled={isAdding}
                        >
                            {t("common.cancel")}
                        </Button>
                        <Button onClick={handleAdd} disabled={isAdding || !newPattern.trim()}>
                            {isAdding ? t("common.adding") : t("common.add")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog
                open={!!deleteEntry}
                onOpenChange={(open) => !open && setDeleteEntry(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("admin.whitelist.deleteDialogTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("admin.whitelist.deleteDialogDescription", {
                                pattern: deleteEntry?.pattern ?? "",
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>
                            {t("common.cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? t("common.deleting") : t("common.delete")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
