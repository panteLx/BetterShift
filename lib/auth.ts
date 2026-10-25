import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth, admin, organization } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { auditLogPlugin } from "@/lib/auth/audit-plugin";
import { handleFirstUserPromotion } from "@/lib/auth/first-user";
import { handleSingleTenantMembership } from "@/lib/auth/workspace-membership";
import { ac, roles } from "@/lib/auth/access-control";
import { isReservedSlug, isValidSlugFormat } from "@/lib/workspace-slugs";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  CUSTOM_OIDC_ENABLED,
  CUSTOM_OIDC_CLIENT_ID,
  CUSTOM_OIDC_CLIENT_SECRET,
  CUSTOM_OIDC_ISSUER,
  CUSTOM_OIDC_SCOPES,
  SESSION_MAX_AGE,
  SESSION_UPDATE_AGE,
  BETTER_AUTH_TRUSTED_ORIGINS,
  BETTER_AUTH_URL,
  ALLOW_USER_REGISTRATION,
  MULTI_TENANT,
  TENANT_BASE_DOMAIN,
} from "@/lib/auth/env";

// Scheme and port follow BETTER_AUTH_URL, matching the workspace URLs proxy.ts redirects to.
// An unparsable URL adds nothing here; getTenancyConfigError() reports it and the proxy fails closed.
function workspaceOriginPatterns(): string[] {
  if (!URL.canParse(BETTER_AUTH_URL)) return [];
  const portal = new URL(BETTER_AUTH_URL);
  return [`${portal.protocol}//*.${TENANT_BASE_DOMAIN}${portal.port ? `:${portal.port}` : ""}`];
}

// Every HTTP path the organization plugin registers in better-auth 1.6.33.
const ORGANIZATION_PLUGIN_PATHS = [
  "accept-invitation", "add-team-member", "cancel-invitation", "check-slug", "create", "create-role",
  "create-team", "delete", "delete-role", "get-active-member", "get-active-member-role",
  "get-full-organization", "get-invitation", "get-role", "has-permission", "invite-member", "leave", "list",
  "list-invitations", "list-members", "list-roles", "list-team-members", "list-teams",
  "list-user-invitations", "list-user-teams", "reject-invitation", "remove-member", "remove-team",
  "remove-team-member", "set-active", "set-active-team", "update", "update-member-role",
  "update-role", "update-team",
].map((p) => `/organization/${p}`);

export const auth = betterAuth({
  // Base URL configuration (critical for reverse proxy setups)
  baseURL: BETTER_AUTH_URL,
  basePath: "/api/auth",
  // Membership changes go through our own routes, which clean up shares/feeds; see lib/workspace-membership-end.ts.
  disabledPaths: ORGANIZATION_PLUGIN_PATHS,

  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      ...schema,
    },
  }),

  // Email and Password authentication
  emailAndPassword: {
    disableSignUp: !ALLOW_USER_REGISTRATION,
    enabled: true,
  },

  // Built-in social providers
  socialProviders: {
    google: GOOGLE_CLIENT_ID
      ? {
          clientId: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET!,
        }
      : undefined,
    github: GITHUB_CLIENT_ID
      ? {
          clientId: GITHUB_CLIENT_ID,
          clientSecret: GITHUB_CLIENT_SECRET!,
        }
      : undefined,
    discord: DISCORD_CLIENT_ID
      ? {
          clientId: DISCORD_CLIENT_ID,
          clientSecret: DISCORD_CLIENT_SECRET!,
        }
      : undefined,
  },

  // Generic OAuth plugin for Custom OIDC
  plugins: [
    // Audit logging plugin
    auditLogPlugin(),

    // Admin plugin for user management
    admin({
      defaultRole: "user",
      // Custom access control to support "admin" and "superadmin" roles
      // Both roles get all Better Auth admin permissions
      // Fine-grained permission control (e.g., only superadmin can ban/delete)
      // is handled by our custom checks in lib/auth/admin.ts
      ac,
      roles,
    }),

    // Workspaces. The plugin's HTTP paths are all disabled (see disabledPaths); creation goes through
    // lib/workspaces.ts. The options and hooks below only guard server-side auth.api.* calls (none today).
    organization({
      disableOrganizationDeletion: true,
      requireEmailVerificationOnInvitation: true,
      allowUserToCreateOrganization: async (user) =>
        user.role === "admin" || user.role === "superadmin",
      organizationHooks: {
        beforeCreateOrganization: async ({ organization }) => {
          const slug = organization.slug ?? "";
          if (!isValidSlugFormat(slug) || isReservedSlug(slug)) {
            throw new APIError("BAD_REQUEST", { message: "Invalid workspace slug" });
          }
        },
        // The slug is the workspace's subdomain; renaming it would strand every link to it.
        beforeUpdateOrganization: async ({ organization }) => {
          if ("slug" in organization) {
            throw new APIError("BAD_REQUEST", { message: "Workspace slug cannot be changed" });
          }
        },
      },
    }),

    // Custom OIDC
    genericOAuth({
      config: [
        // Custom OIDC Provider
        ...(CUSTOM_OIDC_ENABLED && CUSTOM_OIDC_CLIENT_ID
          ? [
              {
                providerId: "custom-oidc",
                clientId: CUSTOM_OIDC_CLIENT_ID,
                clientSecret: CUSTOM_OIDC_CLIENT_SECRET!,
                discoveryUrl: CUSTOM_OIDC_ISSUER!,
                scopes: CUSTOM_OIDC_SCOPES?.split(" ") || [
                  "openid",
                  "profile",
                  "email",
                ],
              },
            ]
          : []),
      ],
    }),
  ],

  // Session configuration
  session: {
    expiresIn: SESSION_MAX_AGE,
    updateAge: SESSION_UPDATE_AGE,
  },

  // Advanced settings
  advanced: {
    // Secure cookies: Use HTTPS detection instead of just NODE_ENV
    // Better Auth will automatically add __Secure- prefix when enabled
    useSecureCookies: BETTER_AUTH_URL.startsWith("https://"),

    // Default cookie attributes (defense in depth)
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: BETTER_AUTH_URL.startsWith("https://"), // Only send over HTTPS
      httpOnly: true, // Prevent XSS attacks (already default, but explicit)
    },
    ...(MULTI_TENANT && TENANT_BASE_DOMAIN
      ? { crossSubDomainCookies: { enabled: true, domain: TENANT_BASE_DOMAIN } }
      : {}),
  },

  // User registration settings
  user: {
    // Disable sign-up if configured
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: true,
    },
    // Off: better-auth's /delete-user would bypass app/api/auth/delete-account's cleanup.
    deleteUser: {
      enabled: false,
    },
    additionalFields: {
      // Set on admin-created accounts (see POST /api/admin/users); input: false
      // blocks self-signup from setting it, but not the admin plugin's `data`
      // passthrough on /admin/create-user.
      mustChangePassword: {
        type: "boolean",
        defaultValue: false,
        input: false,
      },
    },
  },

  // Database hooks for user creation control
  databaseHooks: {
    user: {
      create: {
        before: async (_user, context) => {
          // Admin-created users always work, even when self-registration is
          // disabled -- see docs/ADMIN_PANEL.md. Checked via the acting
          // session's role (mirrors isAdmin's rule) rather than matching
          // better-auth's internal /admin/create-user route, which is an
          // implementation detail.
          const actorRole = context?.context?.session?.user?.role;
          if (actorRole === "admin" || actorRole === "superadmin") return;

          // Block OAuth/OIDC registration when ALLOW_USER_REGISTRATION is false
          // This hook runs for ALL user creation attempts (email + OAuth/OIDC)
          // Email registration is already blocked by disableSignUp config
          if (!ALLOW_USER_REGISTRATION) {
            throw new Error(
              "Registration is currently disabled. Please contact an administrator."
            );
          }
          // Return void to allow creation
        },
        after: async (user) => {
          // Auto-promote first user to superadmin
          // This hook runs immediately after user creation for ALL registration methods:
          // - Email/password registration
          // - OAuth (Google, GitHub, Discord)
          // - Custom OIDC
          if (user?.id) {
            handleFirstUserPromotion(user.id).catch((error) => {
              console.error("Failed to promote first user:", error);
            });
            if (!MULTI_TENANT) {
              handleSingleTenantMembership(user.id).catch((error) => {
                console.error(
                  "Failed to create default workspace membership:",
                  error
                );
              });
            }
          }
        },
      },
    },
  },

  // Trust host for deployment
  trustedOrigins:
    MULTI_TENANT && TENANT_BASE_DOMAIN
      ? [...BETTER_AUTH_TRUSTED_ORIGINS, ...workspaceOriginPatterns()]
      : BETTER_AUTH_TRUSTED_ORIGINS,
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
