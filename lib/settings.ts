import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Valid setting keys
export type SettingKey = "registration_mode";

// Setting value types
export type RegistrationMode = "open" | "whitelist" | "closed";

// Default values for settings (used when not set in DB)
const SETTING_DEFAULTS: Record<SettingKey, string> = {
    registration_mode:
        process.env.REGISTRATION_MODE ||
        (process.env.ALLOW_USER_REGISTRATION !== "false" ? "open" : "closed"),
};

/**
 * Get a system setting value
 * Priority: Database > Environment Variable > Default
 */
export async function getSetting<T extends string = string>(
    key: SettingKey
): Promise<T> {
    try {
        const result = await db
            .select({ value: systemSettings.value })
            .from(systemSettings)
            .where(eq(systemSettings.key, key))
            .limit(1);

        if (result.length > 0 && result[0].value) {
            return result[0].value as T;
        }
    } catch (error) {
        console.error(`Failed to get setting ${key}:`, error);
    }

    return SETTING_DEFAULTS[key] as T;
}

/**
 * Set a system setting value
 */
export async function setSetting(
    key: SettingKey,
    value: string,
    userId?: string
): Promise<void> {
    await db
        .insert(systemSettings)
        .values({
            key,
            value,
            updatedBy: userId || null,
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: systemSettings.key,
            set: {
                value,
                updatedBy: userId || null,
                updatedAt: new Date(),
            },
        });
}

/**
 * Get all system settings
 */
export async function getAllSettings(): Promise<
    Record<SettingKey, { value: string; updatedBy: string | null; updatedAt: Date }>
> {
    try {
        const results = await db.select().from(systemSettings);

        const settings: Record<
            string,
            { value: string; updatedBy: string | null; updatedAt: Date }
        > = {};

        for (const row of results) {
            settings[row.key] = {
                value: row.value,
                updatedBy: row.updatedBy,
                updatedAt: row.updatedAt,
            };
        }

        // Fill in defaults for missing keys
        for (const [key, defaultValue] of Object.entries(SETTING_DEFAULTS)) {
            if (!settings[key]) {
                settings[key] = {
                    value: defaultValue,
                    updatedBy: null,
                    updatedAt: new Date(),
                };
            }
        }

        return settings as Record<
            SettingKey,
            { value: string; updatedBy: string | null; updatedAt: Date }
        >;
    } catch (error) {
        console.error("Failed to get all settings:", error);
        // Return defaults on error
        return Object.fromEntries(
            Object.entries(SETTING_DEFAULTS).map(([key, value]) => [
                key,
                { value, updatedBy: null, updatedAt: new Date() },
            ])
        ) as Record<
            SettingKey,
            { value: string; updatedBy: string | null; updatedAt: Date }
        >;
    }
}

/**
 * Get the current registration mode
 * Convenience function for the most commonly accessed setting
 */
export async function getRegistrationMode(): Promise<RegistrationMode> {
    return getSetting<RegistrationMode>("registration_mode");
}

/**
 * Set the registration mode
 */
export async function setRegistrationMode(
    mode: RegistrationMode,
    userId?: string
): Promise<void> {
    return setSetting("registration_mode", mode, userId);
}
