import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const calendars = sqliteTable("calendars", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  color: text("color").notNull().default("#3b82f6"),
  passwordHash: text("password_hash"),
  isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const externalSyncs = sqliteTable("external_syncs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  calendarId: text("calendar_id")
    .notNull()
    .references(() => calendars.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  syncType: text("sync_type").notNull().default("icloud"), // icloud, google, custom
  calendarUrl: text("calendar_url").notNull(),
  color: text("color").notNull().default("#3b82f6"),
  displayMode: text("display_mode").notNull().default("normal"),
  isHidden: integer("is_hidden", { mode: "boolean" }).notNull().default(false),
  hideFromStats: integer("hide_from_stats", { mode: "boolean" })
    .notNull()
    .default(false),
  autoSyncInterval: integer("auto_sync_interval").notNull().default(0), // 0 = manual, otherwise minutes
  isOneTimeImport: integer("is_one_time_import", { mode: "boolean" })
    .notNull()
    .default(false), // true for uploaded files (no sync), false for URLs (can sync)
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const shifts = sqliteTable("shifts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  calendarId: text("calendar_id")
    .notNull()
    .references(() => calendars.id, { onDelete: "cascade" }),
  presetId: text("preset_id").references(() => shiftPresets.id, {
    onDelete: "set null",
  }),
  date: integer("date", { mode: "timestamp" }).notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  title: text("title").notNull(),
  color: text("color").notNull().default("#3b82f6"),
  notes: text("notes"),
  isAllDay: integer("is_all_day", { mode: "boolean" }).notNull().default(false),
  isSecondary: integer("is_secondary", { mode: "boolean" })
    .notNull()
    .default(false),
  externalEventId: text("external_event_id"),
  externalSyncId: text("external_sync_id").references(() => externalSyncs.id, {
    onDelete: "cascade",
  }),
  syncedFromExternal: integer("synced_from_external", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const shiftPresets = sqliteTable("shift_presets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  calendarId: text("calendar_id")
    .notNull()
    .references(() => calendars.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  color: text("color").notNull().default("#3b82f6"),
  notes: text("notes"),
  isSecondary: integer("is_secondary", { mode: "boolean" })
    .notNull()
    .default(false),
  isAllDay: integer("is_all_day", { mode: "boolean" }).notNull().default(false),
  hideFromStats: integer("hide_from_stats", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const calendarNotes = sqliteTable("calendar_notes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  calendarId: text("calendar_id")
    .notNull()
    .references(() => calendars.id, { onDelete: "cascade" }),
  date: integer("date", { mode: "timestamp" }).notNull(),
  note: text("note").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const syncLogs = sqliteTable("sync_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  calendarId: text("calendar_id")
    .notNull()
    .references(() => calendars.id, { onDelete: "cascade" }),
  externalSyncId: text("external_sync_id")
    .notNull()
    .references(() => externalSyncs.id, { onDelete: "cascade" }),
  externalSyncName: text("external_sync_name").notNull(), // Denormalized for history
  status: text("status").notNull(), // success, error
  errorMessage: text("error_message"),
  shiftsCreated: integer("shifts_created").notNull().default(0),
  shiftsUpdated: integer("shifts_updated").notNull().default(0),
  shiftsDeleted: integer("shifts_deleted").notNull().default(0),
  syncType: text("sync_type").notNull().default("auto"), // auto, manual
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  syncedAt: integer("synced_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type Calendar = typeof calendars.$inferSelect;
export type NewCalendar = typeof calendars.$inferInsert;
export type ExternalSync = typeof externalSyncs.$inferSelect;
export type NewExternalSync = typeof externalSyncs.$inferInsert;
export type Shift = typeof shifts.$inferSelect;
export type NewShift = typeof shifts.$inferInsert;
export type ShiftPreset = typeof shiftPresets.$inferSelect;
export type NewShiftPreset = typeof shiftPresets.$inferInsert;
export type CalendarNote = typeof calendarNotes.$inferSelect;
export type NewCalendarNote = typeof calendarNotes.$inferInsert;
export type SyncLog = typeof syncLogs.$inferSelect;
export type NewSyncLog = typeof syncLogs.$inferInsert;
