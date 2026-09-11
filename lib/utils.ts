import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
