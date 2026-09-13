import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Trims a string, turning an empty result into null — for optional text fields. */
export function trimOrNull(value: string): string | null {
  return value.trim() || null;
}

/** Whether a click should add to a selection instead of replacing it. */
export function isMultiSelectClick(event: {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey;
}

/** Reads a localStorage value, tolerating unavailable storage (private mode, quota). */
export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Writes a localStorage value, tolerating unavailable storage. */
export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable; the caller's state just won't persist
  }
}

/** Removes a localStorage value, tolerating unavailable storage. */
export function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable; nothing to remove then either
  }
}

/** Up to two initials from a name, falling back to the e-mail. */
export function getUserInitials(user: { name?: string | null; email?: string }): string {
  const source = user.name?.trim();
  if (source) {
    return source
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return user.email?.slice(0, 2).toUpperCase() || "?";
}
