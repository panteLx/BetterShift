import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isDemoMode(): boolean {
  // Server-side: check actual environment variable
  if (typeof window === "undefined") {
    return process.env.DEMO_MODE === "true";
  }
  // Client-side: will be passed via props or API
  return false;
}
