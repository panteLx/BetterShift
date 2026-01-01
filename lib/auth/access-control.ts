/**
 * Better Auth Access Control Configuration
 *
 * This file defines custom roles and permissions for Better Auth's Admin Plugin.
 * Required ONLY for Better Auth admin operations (ban, unban, password reset, removeUser).
 *
 * NOTE: This is NOT used for our custom permission checks (canEditUser, canDeleteUser, etc).
 * Those are in lib/auth/admin.ts and work independently.
 *
 * Why we need this:
 * - Better Auth doesn't recognize "admin" and "superadmin" by default
 * - Without this, Better Auth admin APIs (banUser, setUserPassword) throw permission errors
 * - This tells Better Auth: "superadmin" and "admin" are admin roles with full admin permissions
 */

import { createAccessControl } from "better-auth/plugins/access";

/**
 * Access control configuration for Better Auth
 *
 * Both "admin" and "superadmin" get ALL Better Auth admin permissions.
 * Fine-grained permission control (e.g., only superadmin can ban) is handled
 * by our custom permission functions in lib/auth/admin.ts
 */
export const ac = createAccessControl({
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "impersonate",
    "delete",
    "set-password",
  ],
  session: ["list", "delete"],
});

/**
 * Define custom roles with their permissions
 *
 * Strategy:
 * - Give both "admin" and "superadmin" ALL Better Auth permissions
 * - Use lib/auth/admin.ts functions to restrict actions (e.g., only superadmin can ban)
 * - This allows both roles to call Better Auth APIs, but we control what they can do
 */
export const roles = {
  superadmin: ac.newRole({
    user: [
      "create",
      "list",
      "set-role",
      "ban",
      "impersonate",
      "delete",
      "set-password",
    ],
    session: ["list", "delete"],
  }),
  admin: ac.newRole({
    user: [
      "create",
      "list",
      "set-role",
      "ban",
      "impersonate",
      "delete",
      "set-password",
    ],
    session: ["list", "delete"],
  }),
};
