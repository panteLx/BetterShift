/**
 * Rate Limit Error Handler for Client-Side
 *
 * Provides user-friendly error messages and toast notifications
 * when rate limits are exceeded.
 *
 * Uses the app's existing i18n infrastructure (next-intl) for translations.
 */

import { toast } from "sonner";

export interface RateLimitError {
  error: string;
  retryAfter?: number;
}

/**
 * Translation function type (compatible with next-intl)
 */
type TranslateFn = (
  key: string,
  values?: Record<string, string | number | Date>
) => string;

/**
 * Check if a response is a rate limit error (429)
 */
export function isRateLimitError(response: Response): boolean {
  return response.status === 429;
}

/**
 * Handle rate limit error with user-friendly toast
 *
 * @param response - Fetch response object
 * @param t - Translation function from useTranslations()
 * @param action - Optional description of the action that was rate-limited
 *
 * @example
 * ```typescript
 * const t = useTranslations();
 * const response = await fetch('/api/auth/change-password', { ... });
 * if (isRateLimitError(response)) {
 *   await handleRateLimitError(response, t, 'change your password');
 *   return;
 * }
 * ```
 */
export async function handleRateLimitError(
  response: Response,
  t: TranslateFn,
  action?: string
): Promise<void> {
  try {
    const data: RateLimitError = await response.json();
    const retryAfter = data.retryAfter || 60;

    // Format retry time with proper pluralization
    let retryMessage = "";
    if (retryAfter < 60) {
      const unit =
        retryAfter === 1 ? t("rateLimit.second") : t("rateLimit.seconds");
      retryMessage = `${retryAfter} ${unit}`;
    } else if (retryAfter < 3600) {
      const minutes = Math.ceil(retryAfter / 60);
      const unit =
        minutes === 1 ? t("rateLimit.minute") : t("rateLimit.minutes");
      retryMessage = `${minutes} ${unit}`;
    } else {
      const hours = Math.ceil(retryAfter / 3600);
      const unit = hours === 1 ? t("rateLimit.hour") : t("rateLimit.hours");
      retryMessage = `${hours} ${unit}`;
    }

    // Build localized message
    const message = t("rateLimit.message", { time: retryMessage });
    const title = t("rateLimit.title");

    toast.error(title, {
      description: action ? `${action}\n\n${message}` : message,
      duration: 6000,
    });
  } catch {
    // Fallback if JSON parsing fails
    const title = t("rateLimit.title");
    const fallback = t("rateLimit.fallback");

    toast.error(title, {
      description: fallback,
      duration: 5000,
    });
  }
}

/**
 * Extract rate limit headers from response
 * Useful for displaying remaining requests in UI
 */
export function getRateLimitHeaders(response: Response): {
  limit?: number;
  remaining?: number;
  reset?: number;
  retryAfter?: number;
} {
  const headers = response.headers;

  return {
    limit: headers.get("X-RateLimit-Limit")
      ? parseInt(headers.get("X-RateLimit-Limit")!, 10)
      : undefined,
    remaining: headers.get("X-RateLimit-Remaining")
      ? parseInt(headers.get("X-RateLimit-Remaining")!, 10)
      : undefined,
    reset: headers.get("X-RateLimit-Reset")
      ? parseInt(headers.get("X-RateLimit-Reset")!, 10)
      : undefined,
    retryAfter: headers.get("Retry-After")
      ? parseInt(headers.get("Retry-After")!, 10)
      : undefined,
  };
}

/**
 * Create a fetch wrapper that automatically handles rate limit errors
 *
 * @param t - Translation function from useTranslations()
 * @param action - Optional description of the action that was rate-limited
 *
 * @example
 * ```typescript
 * const t = useTranslations();
 * const rateLimitedFetch = createRateLimitedFetch(t, 'change your password');
 * const response = await rateLimitedFetch('/api/auth/change-password', {
 *   method: 'POST',
 *   body: JSON.stringify({ ... }),
 * });
 * ```
 */
export function createRateLimitedFetch(t: TranslateFn, action?: string) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetch(input, init);

    if (isRateLimitError(response)) {
      await handleRateLimitError(response.clone(), t, action);
      throw new Error("Rate limit exceeded");
    }

    return response;
  };
}
