/**
 * Registration Whitelist Utilities
 *
 * Functions for checking and managing the registration whitelist.
 */

import { db } from "@/lib/db";
import { registrationWhitelist, user } from "@/lib/db/schema";
import { eq, or, and, isNull } from "drizzle-orm";
import { getRegistrationMode } from "@/lib/settings";

/**
 * Check if an email is allowed to register based on the current registration mode
 * and whitelist entries.
 *
 * @param email - The email address to check
 * @returns Object with allowed status and reason
 */
export async function isEmailAllowedToRegister(
    email: string
): Promise<{ allowed: boolean; reason?: string }> {
    const registrationMode = await getRegistrationMode();

    // Open mode - anyone can register
    if (registrationMode === "open") {
        return { allowed: true };
    }

    // Closed mode - no one can register
    if (registrationMode === "closed") {
        return {
            allowed: false,
            reason: "Registration is currently disabled. Please contact an administrator.",
        };
    }

    // Whitelist mode - check if email matches a whitelist entry
    const normalizedEmail = email.toLowerCase().trim();
    const emailDomain = normalizedEmail.split("@")[1];

    // Check for exact email match (unused only) or domain pattern
    const matchingEntries = await db
        .select()
        .from(registrationWhitelist)
        .where(
            or(
                // Exact email match - only if not already used
                and(
                    eq(registrationWhitelist.pattern, normalizedEmail),
                    eq(registrationWhitelist.patternType, "email"),
                    isNull(registrationWhitelist.usedAt)
                ),
                // Domain pattern match (e.g., *@company.com)
                and(
                    eq(registrationWhitelist.pattern, `*@${emailDomain}`),
                    eq(registrationWhitelist.patternType, "domain")
                )
            )
        )
        .limit(1);

    if (matchingEntries.length > 0) {
        return { allowed: true };
    }

    return {
        allowed: false,
        reason:
            "Your email is not on the registration whitelist. Please contact an administrator for access.",
    };
}

/**
 * Mark a whitelist entry as used after successful registration.
 *
 * @param email - The email that was used to register
 * @param userId - The ID of the newly created user
 */
export async function markWhitelistEntryAsUsed(
    email: string,
    userId: string
): Promise<void> {
    const registrationMode = await getRegistrationMode();
    if (registrationMode !== "whitelist") {
        return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Only mark exact email matches as used (domain patterns stay active)
    await db
        .update(registrationWhitelist)
        .set({
            usedAt: new Date(),
            usedByUserId: userId,
        })
        .where(
            and(
                eq(registrationWhitelist.pattern, normalizedEmail),
                eq(registrationWhitelist.patternType, "email"),
                isNull(registrationWhitelist.usedAt)
            )
        );
}

/**
 * Determine the pattern type from a pattern string.
 *
 * @param pattern - The pattern (email or domain wildcard)
 * @returns "email" or "domain"
 */
export function getPatternType(pattern: string): "email" | "domain" {
    return pattern.startsWith("*@") ? "domain" : "email";
}

/**
 * Validate a whitelist pattern.
 *
 * @param pattern - The pattern to validate
 * @returns Validation result with error message if invalid
 */
export function validateWhitelistPattern(
    pattern: string
): { valid: boolean; error?: string } {
    const trimmed = pattern.trim().toLowerCase();

    if (!trimmed) {
        return { valid: false, error: "Pattern cannot be empty" };
    }

    // Check domain pattern format (*@domain.com)
    if (trimmed.startsWith("*@")) {
        const domain = trimmed.slice(2);
        if (!domain.includes(".")) {
            return { valid: false, error: "Invalid domain format" };
        }
        return { valid: true };
    }

    // Check email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
        return { valid: false, error: "Invalid email format" };
    }

    return { valid: true };
}

/**
 * Check if a user has superadmin or admin role.
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
    const [userData] = await db
        .select({ role: user.role })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

    return userData?.role === "superadmin";
}
