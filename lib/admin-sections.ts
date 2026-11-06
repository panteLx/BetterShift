import type { WorkspaceRole } from "@/lib/auth/workspace-permissions";

export type AdminScope = "instance" | "global" | "workspace";
export type AdminSectionGroup = "management" | "system";
export type AdminIconName =
  | "LayoutDashboard" | "Users" | "Building2" | "UserCog" | "FolderClosed"
  | "Megaphone" | "ScrollText" | "Settings" | "Radio";

export interface AdminSectionDef {
  key: string;
  href: string;
  group: AdminSectionGroup;
  scopes: readonly AdminScope[];
  icon: AdminIconName;
  /** i18n keys */
  labelKey: string;
  shortLabelKey: string;
  /** Workspace scope only: sections needing the owner role. */
  ownerOnly?: boolean;
}

export const ADMIN_SECTIONS: readonly AdminSectionDef[] = [
  { key: "overview", href: "/admin", group: "management", scopes: ["instance", "global", "workspace"], icon: "LayoutDashboard", labelKey: "admin.dashboard", shortLabelKey: "admin.dashboard" },
  { key: "users", href: "/admin/users", group: "management", scopes: ["instance", "global"], icon: "Users", labelKey: "admin.usersMenu", shortLabelKey: "admin.usersMenu" },
  { key: "workspaces", href: "/admin/workspaces", group: "management", scopes: ["global"], icon: "Building2", labelKey: "admin.workspacesMenu", shortLabelKey: "admin.workspacesMenu" },
  { key: "members", href: "/admin/members", group: "management", scopes: ["workspace"], icon: "UserCog", labelKey: "adminWorkspace.membersMenu", shortLabelKey: "adminWorkspace.membersMenu" },
  { key: "calendars", href: "/admin/calendars", group: "management", scopes: ["instance", "global"], icon: "FolderClosed", labelKey: "admin.calendarsMenu", shortLabelKey: "admin.calendarsMenu" },
  { key: "announcements", href: "/admin/announcements", group: "management", scopes: ["instance", "global"], icon: "Megaphone", labelKey: "admin.announcementsMenu", shortLabelKey: "adminShell.announcementsShort" },
  { key: "logs", href: "/admin/logs", group: "system", scopes: ["instance", "global"], icon: "ScrollText", labelKey: "admin.auditLogs", shortLabelKey: "adminShell.logsShort" },
  { key: "settings", href: "/admin/settings", group: "system", scopes: ["instance", "global", "workspace"], icon: "Settings", labelKey: "admin.settingsMenu", shortLabelKey: "admin.settingsMenu", ownerOnly: true },
  { key: "telemetry", href: "/admin/telemetry", group: "system", scopes: ["instance", "global"], icon: "Radio", labelKey: "admin.telemetryMenu", shortLabelKey: "admin.telemetryMenu" },
];

export type HostKind = "portal" | "workspace" | "unknown";

export function adminScopeFor(multiTenant: boolean, hostKind: HostKind): AdminScope | null {
  if (!multiTenant) return "instance";
  if (hostKind === "portal") return "global";
  if (hostKind === "workspace") return "workspace";
  return null;
}

export function sectionsForScope(scope: AdminScope, workspaceRole?: WorkspaceRole | null): AdminSectionDef[] {
  return ADMIN_SECTIONS.filter(
    (s) => s.scopes.includes(scope) && !(scope === "workspace" && s.ownerOnly && workspaceRole !== "owner")
  );
}

export function isAdminPathAllowed(scope: AdminScope, pathname: string, workspaceRole?: WorkspaceRole | null): boolean {
  return sectionsForScope(scope, workspaceRole).some((s) =>
    s.href === "/admin" ? pathname === "/admin" : pathname === s.href || pathname.startsWith(`${s.href}/`)
  );
}
