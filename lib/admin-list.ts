/**
 * Shared contract of the paginated admin list endpoints (`/api/admin/users`,
 * `/api/admin/calendars`) and the hooks that call them. Pure module: safe to
 * import from route handlers and client code alike.
 */

export const ADMIN_PAGE_SIZE = 25;
export const ADMIN_MAX_PAGE_SIZE = 100;

export const SORT_ORDERS = ["asc", "desc"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export interface AdminListResponse<T, C> {
  items: T[];
  /** Rows matching the current search and filters */
  total: number;
  /** Instance-wide totals, independent of search and filters */
  counts: C;
  /** The page actually served; out-of-range requests get the last page */
  page: number;
  limit: number;
}

// Users

export const USER_ROLE_FILTERS = ["all", "superadmin", "admin", "user"] as const;
export const USER_STATUS_FILTERS = ["all", "active", "banned"] as const;
export const USER_SORT_FIELDS = [
  "name",
  "email",
  "role",
  "status",
  "createdAt",
  "lastActivity",
  "calendarCount",
] as const;

export type UserRoleFilter = (typeof USER_ROLE_FILTERS)[number];
export type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number];
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export interface UserListParams {
  search: string;
  role: UserRoleFilter;
  status: UserStatusFilter;
  sort: UserSortField;
  order: SortOrder;
  page: number;
  limit: number;
}

export interface UserListCounts {
  total: number;
  superadmin: number;
  admin: number;
  user: number;
  banned: number;
  active: number;
}

// Calendars

export const CALENDAR_CONTENT_FILTERS = ["all", "shared", "synced"] as const;
export const CALENDAR_OWNER_FILTERS = ["all", "orphaned", "with-owner"] as const;
export const CALENDAR_SORT_FIELDS = [
  "name",
  "createdAt",
  "owner",
  "shiftsCount",
  "sharesCount",
  "externalSyncsCount",
  "guestPermission",
] as const;

export type CalendarContentFilter = (typeof CALENDAR_CONTENT_FILTERS)[number];
export type CalendarOwnerFilter = (typeof CALENDAR_OWNER_FILTERS)[number];
export type CalendarSortField = (typeof CALENDAR_SORT_FIELDS)[number];

export interface CalendarListParams {
  search: string;
  content: CalendarContentFilter;
  owner: CalendarOwnerFilter;
  sort: CalendarSortField;
  order: SortOrder;
  page: number;
  limit: number;
}

export interface CalendarListCounts {
  total: number;
  orphaned: number;
  shared: number;
  synced: number;
  shifts: number;
}

// Helpers

export function pickParam<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T
): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Requested page (1-based) and page size, with the size capped. */
export function parsePaging(searchParams: URLSearchParams) {
  return {
    page: positiveInt(searchParams.get("page"), 1),
    limit: Math.min(positiveInt(searchParams.get("limit"), ADMIN_PAGE_SIZE), ADMIN_MAX_PAGE_SIZE),
  };
}

/** Clamps the page to the last one that has rows, so a shrinking list never shows an empty page. */
export function clampPage(page: number, limit: number, total: number) {
  const lastPage = Math.max(1, Math.ceil(total / limit));
  const served = Math.min(page, lastPage);
  return { page: served, offset: (served - 1) * limit };
}

/** Lower-cased `LIKE` pattern with `%`, `_` and `\` escaped; pair it with `ESCAPE '\'`. */
export function containsPattern(search: string): string {
  return `%${search.toLowerCase().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export function toSearchParams(params: object): URLSearchParams {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== "all") {
      searchParams.set(key, String(value));
    }
  }
  return searchParams;
}

/** Failed admin request; hooks translate `status` into a message when they show it. */
export class AdminRequestError extends Error {
  constructor(public readonly status: number) {
    super(`Admin request failed with status ${status}`);
    this.name = "AdminRequestError";
  }
}
