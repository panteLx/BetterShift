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
 * Handles both static keys and dynamic template patterns
 */
function extractUsedKeys(content: string): Set<string> {
  const keys = new Set<string>();

  // Match t("key"), t('key')
  // Also handles t.rich(), t.raw(), etc.
  const stringPatterns = [
    /\bt(?:\.\w+)?\s*\(\s*["']([^"']+)["']/g, // t("key") or t.rich("key")
  ];

  for (const pattern of stringPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const key = match[1];
      keys.add(key);
    }
  }

  // Special handling for template literals: t(`key`) and t(`key${var}`)
  // Use 's' flag to match across newlines (dotall mode)
  // Match opening backtick, capture everything until closing backtick
  const templatePattern = /\bt(?:\.\w+)?\s*\(\s*`([^`]+)`/gs;
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
  missingInEn: string[];
  missingInIt: string[];
  extraInEn: string[];
  extraInIt: string[];
} {
  const deKeys = new Set(getTranslationKeys("de"));
  const enKeys = new Set(getTranslationKeys("en"));
  const itKeys = new Set(getTranslationKeys("it"));

  const missingInEn: string[] = [];
  const missingInIt: string[] = [];
  const extraInEn: string[] = [];
  const extraInIt: string[] = [];

  // Find keys missing in en.json and it.json
  for (const key of deKeys) {
    if (!enKeys.has(key)) {
      missingInEn.push(key);
    }
    if (!itKeys.has(key)) {
      missingInIt.push(key);
    }
  }

  // Find extra keys in en.json and it.json
  for (const key of enKeys) {
    if (!deKeys.has(key)) {
      extraInEn.push(key);
    }
  }

  for (const key of itKeys) {
    if (!deKeys.has(key)) {
      extraInIt.push(key);
    }
  }

  return { missingInEn, missingInIt, extraInEn, extraInIt };
}

/**
 * Find keys that are used in code but missing in de.json
 */
function findMissingKeys(
  usedKeys: Set<string>,
  allKeys: string[]
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
  console.log(
    `   Found ${staticKeys.length} static keys + ${wildcardPatterns.length} dynamic patterns\n`
  );

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

  if (missingKeys.length === 0) {
    console.log("✅ No missing translation keys found!\n");
  } else {
    hasIssues = true;
    console.log(`❌ Found ${missingKeys.length} missing translation keys:\n`);
    for (const item of missingKeys) {
      if (item.pattern) {
        // Dynamic pattern
        console.log(
          `   - ${
            item.pattern
          } (dynamic key - no keys with prefix '${item.key.replace(
            ".*",
            ""
          )}' found)`
        );
      } else {
        // Static key
        console.log(`   - ${item.key}`);
      }
    }
    console.log();
  }

  // 3. Compare translation files
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("3️⃣  FILE SYNCHRONIZATION (de.json vs en.json vs it.json)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const { missingInEn, missingInIt, extraInEn, extraInIt } =
    compareTranslationFiles();

  const syncIssues =
    missingInEn.length +
    missingInIt.length +
    extraInEn.length +
    extraInIt.length;

  if (syncIssues === 0) {
    console.log("✅ All translation files are synchronized!\n");
  } else {
    hasIssues = true;

    if (missingInEn.length > 0) {
      console.log(`❌ Missing in en.json (${missingInEn.length} keys):`);
      for (const key of missingInEn.sort()) {
        console.log(`   - ${key}`);
      }
      console.log();
    }

    if (missingInIt.length > 0) {
      console.log(`❌ Missing in it.json (${missingInIt.length} keys):`);
      for (const key of missingInIt.sort()) {
        console.log(`   - ${key}`);
      }
      console.log();
    }

    if (extraInEn.length > 0) {
      console.log(
        `⚠️  Extra in en.json (${extraInEn.length} keys not in de.json):`
      );
      for (const key of extraInEn.sort()) {
        console.log(`   - ${key}`);
      }
      console.log();
    }

    if (extraInIt.length > 0) {
      console.log(
        `⚠️  Extra in it.json (${extraInIt.length} keys not in de.json):`
      );
      for (const key of extraInIt.sort()) {
        console.log(`   - ${key}`);
      }
      console.log();
    }
  }

  // Summary
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 SUMMARY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log(`   Total keys in de.json: ${allKeys.length}`);
  console.log(`   Static keys used in code: ${staticKeys.length}`);
  console.log(`   Dynamic patterns (wildcards): ${wildcardPatterns.length}`);
  console.log(`   Unused keys: ${unusedKeys.length}`);
  console.log(`   Missing keys: ${missingKeys.length}`);
  console.log(
    `   Usage rate: ${((1 - unusedKeys.length / allKeys.length) * 100).toFixed(
      1
    )}%`
  );
  console.log();
  console.log(`   en.json missing: ${missingInEn.length}`);
  console.log(`   en.json extra: ${extraInEn.length}`);
  console.log(`   it.json missing: ${missingInIt.length}`);
  console.log(`   it.json extra: ${extraInIt.length}`);
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
