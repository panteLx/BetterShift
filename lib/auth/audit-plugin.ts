import { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import {
  logSecurityEvent,
  logUserAction,
  type LoginFailedMetadata,
  type LoginSuccessMetadata,
  type UserRegisteredMetadata,
  type ProfileUpdatedMetadata,
} from "@/lib/audit-log";

/**
 * Better Auth plugin for audit logging
 *
 * Logs all authentication events using Better Auth's hooks system
 */
export const auditLogPlugin = () => {
  return {
    id: "audit-log",
    hooks: {
      after: [
        {
          // Match all auth endpoints
          matcher: (context) => {
            return (
              context.path.startsWith("/sign-in") ||
              context.path.startsWith("/sign-up") ||
              context.path === "/update-user"
            );
          },
          handler: createAuthMiddleware(async (ctx) => {
            try {
              const newSession = ctx.context.newSession;

              // Log successful logins
              if (ctx.path === "/sign-in/email" && newSession?.user) {
                await logUserAction<LoginSuccessMetadata>({
                  action: "auth.login.success",
                  userId: newSession.user.id,
                  resourceType: "user",
                  metadata: {
                    email: newSession.user.email,
                    newDevice: false, // TODO: Track device fingerprint
                  },
                  request: ctx.request!,
                });
              }

              // Log failed logins (no session was created)
              if (ctx.path === "/sign-in/email" && !newSession) {
                const email = ctx.body?.email;
                if (email) {
                  // Default to invalid_password, actual reason detection would need response parsing
                  await logSecurityEvent<LoginFailedMetadata>({
                    action: "auth.login.failed",
                    resourceType: "user",
                    metadata: {
                      email,
                      reason: "invalid_password",
                    },
                    request: ctx.request!,
                  });
                }
              }

              // Log user registrations
              if (ctx.path === "/sign-up/email" && newSession?.user) {
                await logUserAction<UserRegisteredMetadata>({
                  action: "auth.user.registered",
                  userId: newSession.user.id,
                  resourceType: "user",
                  metadata: {
                    email: newSession.user.email,
                    name: newSession.user.name,
                    registrationMethod: "email",
                  },
                  request: ctx.request!,
                });
              }

              // Log profile updates
              if (ctx.path === "/update-user" && ctx.body) {
                const changes: string[] = [];

                if (ctx.body.name !== undefined) changes.push("name");
                if (ctx.body.email !== undefined) changes.push("email");
                if (ctx.body.image !== undefined) changes.push("avatar");

                if (changes.length > 0 && newSession?.user) {
                  await logUserAction<ProfileUpdatedMetadata>({
                    action: "auth.profile.updated",
                    userId: newSession.user.id,
                    resourceType: "user",
                    metadata: {
                      changes,
                      newValues: {
                        name: ctx.body.name,
                        email: ctx.body.email,
                      },
                    },
                    request: ctx.request!,
                  });
                }
              }
            } catch (error) {
              // Audit logging failures should not break auth flow
              console.error("[Audit Log Plugin] Failed to log event:", error);
            }

            // Don't modify the response
            return;
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
};
