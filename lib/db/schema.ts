import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const calendars = sqliteTable("calendars", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  color: text("color").notNull().default("#3b82f6"),
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
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type Calendar = typeof calendars.$inferSelect;
export type NewCalendar = typeof calendars.$inferInsert;
export type Shift = typeof shifts.$inferSelect;
export type NewShift = typeof shifts.$inferInsert;
export type ShiftPreset = typeof shiftPresets.$inferSelect;
export type NewShiftPreset = typeof shiftPresets.$inferInsert;
