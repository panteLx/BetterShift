/**
 * Carries the HTTP status alongside the message so the query client can tell a
 * refused request from a network blip. Pure module: no React, no fetch.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * True for a 4xx, which is a verdict rather than a hiccup: retrying a 403 only
 * repeats it, and retrying a 429 makes the rate limit worse. Duck-typed on
 * `status`, so `AdminRequestError` is covered too.
 */
export function isClientError(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}
