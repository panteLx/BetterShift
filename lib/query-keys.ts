/**
 * Query Key Factory for TanStack Query
 *
 * Provides consistent, type-safe query keys for all data fetching operations.
 * Follow the structure: [entity, ...params] for proper cache invalidation.
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/query-keys
 */

export const queryKeys = {
  // Calendar Data
  calendars: {
    all: ["calendars"] as const,
    byId: (id: string) => ["calendars", id] as const,
  },
  shifts: {
    all: ["shifts"] as const,
    byCalendar: (calendarId: string) => ["shifts", calendarId] as const,
  },
  presets: {
    all: ["presets"] as const,
    byCalendar: (calendarId: string) => ["presets", calendarId] as const,
  },
  notes: {
    all: ["notes"] as const,
    byCalendar: (calendarId: string) => ["notes", calendarId] as const,
  },
  stats: {
    shifts: (calendarId: string, period: string, date: string) =>
      ["stats", "shifts", calendarId, period, date] as const,
  },
  externalSyncs: {
    byCalendar: (calendarId: string) => ["external-syncs", calendarId] as const,
    logs: (calendarId: string) => ["sync-logs", calendarId] as const,
  },

  // Admin Data
  admin: {
    stats: ["admin", "stats"] as const,
    users: (filters?: object) => ["admin", "users", filters] as const,
    userDetails: (userId: string) => ["admin", "users", userId] as const,
    calendars: (filters?: object) => ["admin", "calendars", filters] as const,
    calendarDetails: (calendarId: string) =>
      ["admin", "calendars", calendarId] as const,
    auditLogs: (filters?: object) => ["admin", "audit-logs", filters] as const,
  },

  // Calendar Features
  shares: {
    byCalendar: (calendarId: string) => ["shares", calendarId] as const,
  },
  tokens: {
    byCalendar: (calendarId: string) => ["tokens", calendarId] as const,
  },
  subscriptions: {
    all: ["subscriptions"] as const,
  },

  // User Activity Logs
  activityLogs: (filters?: object) => ["activity-logs", filters] as const,
} as const;
