#!/usr/bin/env tsx

/**
 * Find unused translation keys in the project
 *
 * This script:
 * 1. Reads all translation keys from messages/*.json files
 * 2. Searches for usage of t("key") in the codebase
 * 3. Reports keys that are never used
 * 4. Reports keys that are used in code but missing in de.json
 * 5. Checks if en.json and it.json are synchronized with de.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Directories to search for translations usage
const searchDirs = ["app", "components", "hooks", "lib"];

// Extensions to search in
const extensions = [".ts", ".tsx", ".js", ".jsx"];

/**
 * Flatten nested JSON object to dot-notation keys
 * Example: { common: { save: "Save" } } -> ["common.save"]
 */
function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

/**
 * Read all translation keys from a specific locale file
 */
function getTranslationKeys(locale: string): string[] {
  const messagesPath = path.join(rootDir, "messages", `${locale}.json`);
  const content = fs.readFileSync(messagesPath, "utf-8");
  const messages = JSON.parse(content) as Record<string, unknown>;
  return flattenKeys(messages);
}

/**
 * Read all translation keys from messages/de.json (source of truth)
 */
function getAllTranslationKeys(): string[] {
  return getTranslationKeys("de");
}

/**
 * Get all available locales from the messages directory
 */
function getAvailableLocales(): string[] {
  const messagesDir = path.join(rootDir, "messages");
  const files = fs.readdirSync(messagesDir);
  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""))
    .sort();
}

/**
 * Recursively find all files with given extensions in a directory
 */
function findFiles(dir: string, exts: string[]): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      // Skip node_modules and hidden directories
      if (item.name === "node_modules" || item.name.startsWith(".")) {
        continue;
      }
      results.push(...findFiles(fullPath, exts));
    } else if (item.isFile() && exts.some((ext) => item.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Find all files to search in
 */
function getSearchFiles(): string[] {
  const files: string[] = [];

  for (const dir of searchDirs) {
    const fullPath = path.join(rootDir, dir);
    files.push(...findFiles(fullPath, extensions));
  }

  return files;
}

/**
 * Check if a key contains dynamic template syntax
 */
function isDynamicKey(key: string): boolean {
  return key.includes("${");
}

/**
 * Extract static prefix and original pattern from a dynamic key
 * Example: "language.${locale}" -> { prefix: "language", pattern: "language.${locale}" }
 * Example: "admin.role${role}" -> { prefix: "admin.role", pattern: "admin.role${role}" }
 */
function extractDynamicKeyInfo(key: string): {
  prefix: string;
  pattern: string;
} | null {
  // Find the position of the first ${
  const dollarIndex = key.indexOf("${");
  if (dollarIndex === -1) return null;

  // Get everything before ${ - this is our prefix
  // For "admin.role${...}", beforeDollar = "admin.role"
  // For "language.${...}", beforeDollar = "language"
  const beforeDollar = key.substring(0, dollarIndex);

  // The prefix is everything before ${, which represents the static part
  // This allows matching keys like:
  // - "admin.role" + "User" = "admin.roleUser"
  // - "admin.role" + "Admin" = "admin.roleAdmin"
  // - "language" + ".de" = "language.de"
  const prefix = beforeDollar;

  return {
    prefix,
    pattern: key,
  };
}

/**
 * Store for dynamic patterns with their original code representation
 */
const dynamicPatterns = new Map<string, string>();

/**
 * Extract translation key usage patterns from file content
 * Matches: t("key"), t('key'), t(`key`)
 * Also matches: t("key", ...), t.rich("key"), etc.
 * Also matches: tRef.current("key") and similar ref patterns
 * Handles both static keys and dynamic template patterns
 */
function extractUsedKeys(content: string): Set<string> {
  const keys = new Set<string>();

  // Match t("key"), t('key')
  // Also handles t.rich(), t.raw(), etc.
  // Also handles tRef.current("key"), translationRef.current("key"), etc.
  const stringPatterns = [
    /\bt(?:\.\w+)?\s*\(\s*["']([^"']+)["']/g, // t("key") or t.rich("key")
    /\w+Ref\.current\s*\(\s*["']([^"']+)["']/g, // tRef.current("key")
  ];

  for (const pattern of stringPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const key = match[1];
      keys.add(key);
    }
  }

  // Special handling for template literals: t(`key`) and t(`key${var}`)
  // Also handles tRef.current(`key`)
  // Use 's' flag to match across newlines (dotall mode)
  // Match opening backtick, capture everything until closing backtick
  const templatePatterns = [
    /\bt(?:\.\w+)?\s*\(\s*`([^`]+)`/gs, // t(`key`)
    /\w+Ref\.current\s*\(\s*`([^`]+)`/gs, // tRef.current(`key`)
  ];

  for (const templatePattern of templatePatterns) {
    let templateMatch;
    while ((templateMatch = templatePattern.exec(content)) !== null) {
      // Normalize whitespace in the captured template string
      const fullTemplate = templateMatch[1].replace(/\s+/g, " ").trim();

      // Check if it contains ${...} template expressions
      if (isDynamicKey(fullTemplate)) {
        const info = extractDynamicKeyInfo(fullTemplate);
        if (info) {
          // Store the original pattern for later display
          dynamicPatterns.set(info.prefix, fullTemplate);
          // Store the prefix as a marker
          keys.add(`${info.prefix}.*`);
        }
      } else {
        // Static template literal (no ${})
        keys.add(fullTemplate);
      }
    }
  }

  return keys;
}

/**
 * Find all used translation keys in the codebase
 */
function findUsedKeys(files: string[]): Set<string> {
  const usedKeys = new Set<string>();

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const fileKeys = extractUsedKeys(content);

    for (const key of fileKeys) {
      usedKeys.add(key);
    }
  }

  return usedKeys;
}

/**
 * Check if a key or any of its parent keys are used
 * Example: If "common" is used, then "common.save" is considered used too
 * Also handles wildcard patterns like "admin.role.*" matching "admin.roleUser"
 */
function isKeyOrParentUsed(key: string, usedKeys: Set<string>): boolean {
  // Check exact match
  if (usedKeys.has(key)) {
    return true;
  }

  // Check if any wildcard pattern matches
  // Wildcard patterns like "admin.role.*" should match keys like "admin.roleUser"
  // BUT NOT "admin.role" itself or "admin.roleSettings.foo"
  for (const usedKey of usedKeys) {
    if (usedKey.endsWith(".*")) {
      const prefix = usedKey.slice(0, -2); // Remove ".*" -> "admin.role"

      // Check if key starts with prefix + "."
      if (key.startsWith(prefix)) {
        // Get the part after the prefix
        const afterPrefix = key.substring(prefix.length);

        // Only match if:
        // 1. There's exactly one more segment (e.g., "admin.role" + "User" = "admin.roleUser")
        // 2. No dots in the remaining part (not "admin.roleSettings.foo")
        if (afterPrefix.length > 0 && !afterPrefix.includes(".")) {
          return true;
        }
      }
    }
  }

  // Check if any parent key is used
  // Example: If "common" is used, "common.save" is considered used
  const parts = key.split(".");
  for (let i = parts.length - 1; i > 0; i--) {
    const parentKey = parts.slice(0, i).join(".");
    if (usedKeys.has(parentKey)) {
      return true;
    }
  }

  return false;
}

/**
 * Compare translation files and find missing/extra keys
 */
function compareTranslationFiles(): {
  [locale: string]: {
    missing: string[];
    extra: string[];
  };
} {
  const locales = getAvailableLocales();
  const deKeys = new Set(getTranslationKeys("de"));
  const otherLocales = locales.filter((l) => l !== "de");

  const results: {
    [locale: string]: {
      missing: string[];
      extra: string[];
    };
  } = {};

  for (const locale of otherLocales) {
    const localeKeys = new Set(getTranslationKeys(locale));

    const missing: string[] = [];
    const extra: string[] = [];

    // Find keys missing in this locale
    for (const key of deKeys) {
      if (!localeKeys.has(key)) {
        missing.push(key);
      }
    }

    // Find extra keys in this locale
    for (const key of localeKeys) {
      if (!deKeys.has(key)) {
        extra.push(key);
      }
    }

    results[locale] = { missing, extra };
  }

  return results;
}

/**
 * Find keys that are used in code but missing in de.json
 */
function findMissingKeys(
  usedKeys: Set<string>,
  allKeys: string[],
): Array<{ key: string; pattern?: string; existingKeys?: string[] }> {
  const allKeysSet = new Set(allKeys);
  const missingKeys: Array<{
    key: string;
    pattern?: string;
    existingKeys?: string[];
  }> = [];

  for (const usedKey of usedKeys) {
    // Handle wildcard patterns
    if (usedKey.endsWith(".*")) {
      const prefix = usedKey.slice(0, -2); // Remove ".*"
      const originalPattern = dynamicPatterns.get(prefix);

      // Find all keys that match this prefix
      // Two possible patterns:
      // 1. prefix + "." + something (e.g., "language." + "de" = "language.de")
      // 2. prefix + something (e.g., "admin.role" + "User" = "admin.roleUser")
      const matchingKeys = allKeys.filter((key) => {
        if (key.startsWith(prefix + ".")) {
          return true; // Pattern 1: language.${locale} -> language.de
        }
        if (key.startsWith(prefix) && key.length > prefix.length) {
          const afterPrefix = key.substring(prefix.length);
          // Check if there's no dot in the remaining part
          // This catches: admin.roleUser but not admin.role.something
          return !afterPrefix.includes(".");
        }
        return false;
      });

      if (matchingKeys.length === 0) {
        // No keys found with this prefix at all
        missingKeys.push({
          key: `${prefix}.*`,
          pattern: originalPattern,
          existingKeys: [],
        });
      }
      // If some keys exist with this prefix, we assume it's OK
      // (we can't know which specific keys are needed at runtime)
    } else {
      // Static key - check if it exists
      if (!isKeyOrParentUsed(usedKey, allKeysSet)) {
        missingKeys.push({ key: usedKey });
      }
    }
  }

  return missingKeys.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Main function
 */
function main() {
  console.log("🔍 Analyzing translation keys...\n");
  let hasIssues = false;

  // Get all translation keys
  console.log("📖 Reading translation keys from messages/de.json...");
  const allKeys = getAllTranslationKeys();
  console.log(`   Found ${allKeys.length} translation keys\n`);

  // Get all files to search
  console.log("📁 Finding source files...");
  const files = getSearchFiles();
  console.log(`   Found ${files.length} files to search\n`);

  // Find used keys
  console.log("🔎 Searching for translation key usage...");
  const usedKeys = findUsedKeys(files);
  const staticKeys = Array.from(usedKeys).filter((k) => !k.endsWith(".*"));
  const wildcardPatterns = Array.from(usedKeys).filter((k) => k.endsWith(".*"));

  // Identify phantom keys (used in code but don't exist in de.json)
  const allKeysSet = new Set(allKeys);
  const phantomKeys = staticKeys.filter((key) => !allKeysSet.has(key));
  const realStaticKeys = staticKeys.filter((key) => allKeysSet.has(key));

  // Count how many actual keys are matched by wildcards
  let wildcardMatchedKeysCount = 0;
  for (const wildcardKey of wildcardPatterns) {
    const prefix = wildcardKey.slice(0, -2); // Remove ".*"
    const matchingKeys = allKeys.filter((key) => {
      if (key.startsWith(prefix + ".")) return true;
      if (key.startsWith(prefix) && key.length > prefix.length) {
        const afterPrefix = key.substring(prefix.length);
        return !afterPrefix.includes(".");
      }
      return false;
    });
    wildcardMatchedKeysCount += matchingKeys.length;
  }

  // Keys that are used via both static AND wildcard (avoid double counting)
  const keysInBoth = realStaticKeys.filter((key) => {
    for (const wildcardKey of wildcardPatterns) {
      const prefix = wildcardKey.slice(0, -2);
      if (
        key.startsWith(prefix + ".") ||
        (key.startsWith(prefix) &&
          key.length > prefix.length &&
          !key.substring(prefix.length).includes("."))
      ) {
        return true;
      }
    }
    return false;
  });

  const totalUniqueKeysUsed =
    realStaticKeys.length + wildcardMatchedKeysCount - keysInBoth.length;

  console.log(`   Found ${totalUniqueKeysUsed} keys used in code`);
  if (phantomKeys.length > 0) {
    console.log(`   ⚠️  ${phantomKeys.length} missing in de.json`);
  }
  console.log();

  // 1. Find unused keys
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("1️⃣  UNUSED KEYS (in de.json but not used in code)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const unusedKeys = allKeys.filter((key) => !isKeyOrParentUsed(key, usedKeys));

  if (unusedKeys.length === 0) {
    console.log("✅ No unused translation keys found!\n");
  } else {
    hasIssues = true;
    // Group unused keys by top-level namespace
    const groupedKeys = new Map<string, string[]>();

    for (const key of unusedKeys) {
      const namespace = key.split(".")[0];
      if (!groupedKeys.has(namespace)) {
        groupedKeys.set(namespace, []);
      }
      groupedKeys.get(namespace)!.push(key);
    }

    console.log(`❌ Found ${unusedKeys.length} unused translation keys:\n`);

    for (const [namespace, keys] of Array.from(groupedKeys.entries()).sort()) {
      console.log(`📦 ${namespace} (${keys.length} unused):`);
      for (const key of keys.sort()) {
        console.log(`   - ${key}`);
      }
      console.log();
    }
  }

  // 2. Find missing keys
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("2️⃣  MISSING KEYS (used in code but not in de.json)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const missingKeys = findMissingKeys(usedKeys, allKeys);

  // Show phantom keys first (static keys that don't exist)
  if (phantomKeys.length > 0) {
    hasIssues = true;
    console.log(`❌ Found ${phantomKeys.length} missing static keys:\n`);
    for (const key of phantomKeys.sort()) {
      console.log(`   - ${key}`);
    }
    console.log();
  }

  // Show missing dynamic pattern keys
  if (missingKeys.length > 0) {
    hasIssues = true;
    console.log(
      `❌ Found ${missingKeys.length} missing dynamic pattern keys:\n`,
    );
    for (const item of missingKeys) {
      if (item.pattern) {
        // Dynamic pattern
        console.log(
          `   - ${
            item.pattern
          } (dynamic key - no keys with prefix '${item.key.replace(
            ".*",
            "",
          )}' found)`,
        );
      } else {
        // Static key
        console.log(`   - ${item.key}`);
      }
    }
    console.log();
  }

  // If no missing keys at all
  if (phantomKeys.length === 0 && missingKeys.length === 0) {
    console.log("✅ No missing translation keys found!\n");
  }

  // 3. Compare translation files
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("3️⃣  FILE SYNCHRONIZATION (de.json vs other locales)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const comparisonResults = compareTranslationFiles();
  const allLocales = getAvailableLocales();
  const otherLocales = allLocales.filter((l) => l !== "de");

  let totalSyncIssues = 0;
  const localeIssues: { [locale: string]: number } = {};

  for (const locale of otherLocales) {
    const { missing, extra } = comparisonResults[locale];
    localeIssues[locale] = missing.length + extra.length;
    totalSyncIssues += localeIssues[locale];
  }

  if (totalSyncIssues === 0) {
    console.log("✅ All translation files are synchronized!\n");
  } else {
    hasIssues = true;

    for (const locale of otherLocales) {
      const { missing, extra } = comparisonResults[locale];

      if (missing.length > 0) {
        console.log(`❌ Missing in ${locale}.json (${missing.length} keys):`);
        for (const key of missing.sort()) {
          console.log(`   - ${key}`);
        }
        console.log();
      }

      if (extra.length > 0) {
        console.log(
          `⚠️  Extra in ${locale}.json (${extra.length} keys not in de.json):`,
        );
        for (const key of extra.sort()) {
          console.log(`   - ${key}`);
        }
        console.log();
      }
    }
  }

  // Summary
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 SUMMARY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Calculate overall health
  let totalSyncIssuesInSummary = 0;
  for (const locale of otherLocales) {
    const { missing, extra } = comparisonResults[locale];
    totalSyncIssuesInSummary += missing.length + extra.length;
  }

  const totalIssues =
    unusedKeys.length +
    phantomKeys.length +
    missingKeys.length +
    totalSyncIssuesInSummary;
  const healthScore =
    totalIssues === 0 ? 100 : Math.max(0, 100 - totalIssues * 2);
  const healthIcon =
    healthScore === 100 ? "✅" : healthScore >= 80 ? "⚠️" : "❌";

  console.log(`${healthIcon} Overall Health: ${healthScore}%\n`);

  // Main stats
  console.log("📊 Translation Keys:");
  console.log(`   Keys in de.json:     ${allKeys.length}`);
  console.log(`   Keys used in code:   ${totalUniqueKeysUsed}`);
  console.log(`   Unused keys:         ${unusedKeys.length}`);
  const missingTotal = phantomKeys.length + missingKeys.length;
  if (missingTotal > 0) {
    console.log(`   Missing keys:        ${missingTotal}`);
  }

  const matchRate = ((totalUniqueKeysUsed / allKeys.length) * 100).toFixed(1);
  console.log(`   Match rate:          ${matchRate}%`);
  console.log();

  if (phantomKeys.length > 0 || missingKeys.length > 0) {
    console.log("⚠️  Issues:");
    console.log(
      `   Missing in de.json: ${phantomKeys.length + missingKeys.length}`,
    );
    console.log();
  }

  console.log("🌍 File Synchronization:");
  for (const locale of otherLocales) {
    const { missing, extra } = comparisonResults[locale];
    const issues = missing.length + extra.length;
    const status =
      issues === 0
        ? "✅ Synced"
        : `⚠️  ${missing.length} missing, ${extra.length} extra`;
    console.log(`   ${locale}.json:             ${status}`);
  }
  console.log();

  if (!hasIssues) {
    console.log("✅ All checks passed!");
  } else {
    console.log("❌ Issues found. Please review the report above.");
  }

  // Exit with error code if any issues found
  process.exit(hasIssues ? 1 : 0);
}

main();
