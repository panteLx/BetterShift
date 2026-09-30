export const WORKSPACE_ROLES = ["owner", "admin", "member"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];
type Actor = WorkspaceRole | null | undefined;

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return typeof value === "string" && (WORKSPACE_ROLES as readonly string[]).includes(value);
}

export const canManageMembers = (actor: Actor) => actor === "owner" || actor === "admin";

export function canRemoveMember(actor: Actor, target: WorkspaceRole): boolean {
  if (target === "owner") return false;
  if (actor === "owner") return true;
  return actor === "admin" && target === "member";
}

// Only the owner changes roles; the owner row itself is never touched, and `owner` cannot be granted this way.
export function canChangeRole(actor: Actor, target: WorkspaceRole, next: "admin" | "member"): boolean {
  return actor === "owner" && target !== "owner" && (next === "admin" || next === "member");
}

export function canCreateJoinLink(actor: Actor, linkRole: "member" | "admin"): boolean {
  if (actor === "owner") return true;
  return actor === "admin" && linkRole === "member";
}

export function canRevokeJoinLink(actor: Actor, linkRole: string): boolean {
  if (actor === "owner") return true;
  return actor === "admin" && linkRole === "member";
}

export const canEditWorkspaceSettings = (actor: Actor) => actor === "owner";
export const canDeleteWorkspace = (actor: Actor) => actor === "owner";
export const canTransferOwnership = (actor: Actor) => actor === "owner";
