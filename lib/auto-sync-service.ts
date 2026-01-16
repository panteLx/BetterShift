/**
 * Auto-Sync Service for External Calendars
 * Runs in the background and periodically syncs calendars based on their autoSyncInterval
 * Supports iCloud, Google Calendar, and other iCal-based services
 */

import { db } from "@/lib/db";
import { externalSyncs, calendars } from "@/lib/db/schema";
import { gt, eq } from "drizzle-orm";
import { syncExternalCalendar } from "@/app/api/external-syncs/[id]/sync/route";
import { isAuthEnabled } from "@/lib/auth/feature-flags";

interface SyncJob {
  syncId: string;
  nextSyncTime: number;
  intervalMs: number;
}

class AutoSyncService {
  private jobs: Map<string, SyncJob> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private lastCleanupTime: number = 0;
  private isRunning = false;

  /**
   * Start the auto-sync service
   */
  async start() {
    if (this.isRunning) {
      console.log("Auto-sync service already running");
      return;
    }

    this.isRunning = true;
    console.log("Starting auto-sync service...");

    // Load all syncs with auto-sync enabled
    await this.loadSyncs();

    // Check for syncs every 5 minutes in case of changes
    this.pollInterval = setInterval(() => this.loadSyncs(), 5 * 60 * 1000);

    // Run orphaned sync cleanup every 24 hours
    await this.cleanupOrphanedSyncs();
    this.cleanupInterval = setInterval(
      () => this.cleanupOrphanedSyncs(),
      24 * 60 * 60 * 1000
    );
  }

  /**
   * Stop the auto-sync service
   */
  stop() {
    console.log("Stopping auto-sync service...");
    this.isRunning = false;

    // Clear the polling interval
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Clear the cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear all sync job timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.jobs.clear();
  }

  /**
   * Load syncs from database and schedule jobs
   */
  private async loadSyncs() {
    try {
      // Get all syncs with auto-sync enabled (autoSyncInterval > 0)
      const syncs = await db
        .select({
          sync: externalSyncs,
          calendar: calendars,
        })
        .from(externalSyncs)
        .leftJoin(calendars, eq(externalSyncs.calendarId, calendars.id))
        .where(gt(externalSyncs.autoSyncInterval, 0));

      // Remove jobs for syncs that were deleted or disabled
      for (const [syncId] of this.jobs) {
        if (!syncs.find((s) => s.sync.id === syncId)) {
          this.removeJob(syncId);
        }
      }

      // Add or update jobs for active syncs
      for (const { sync, calendar } of syncs) {
        // Skip syncs for orphaned calendars (only when auth is enabled)
        if (isAuthEnabled() && calendar && !calendar.ownerId) {
          console.warn(
            `Sync skipped for calendar [${calendar.id}] - no owner (orphaned calendar)`
          );
          // Remove job if it exists (calendar lost its owner)
          if (this.jobs.has(sync.id)) {
            this.removeJob(sync.id);
          }
          continue;
        }

        // Skip if calendar doesn't exist (shouldn't happen with foreign keys)
        if (!calendar) {
          console.warn(
            `Sync skipped for external sync [${sync.id}] - calendar not found`
          );
          if (this.jobs.has(sync.id)) {
            this.removeJob(sync.id);
          }
          continue;
        }

        const intervalMs = sync.autoSyncInterval * 60 * 1000; // Convert minutes to milliseconds
        const existingJob = this.jobs.get(sync.id);

        // If interval changed, reschedule
        if (existingJob && existingJob.intervalMs !== intervalMs) {
          this.removeJob(sync.id);
          this.scheduleJob(sync.id, intervalMs, sync.lastSyncedAt);
        } else if (!existingJob) {
          // New job
          this.scheduleJob(sync.id, intervalMs, sync.lastSyncedAt);
        }
      }
    } catch (error) {
      console.error("Failed to load syncs:", error);
    }
  }

  /**
   * Schedule a sync job
   */
  private scheduleJob(
    syncId: string,
    intervalMs: number,
    lastSyncedAt: Date | null
  ) {
    const now = Date.now();
    let nextSyncTime: number;

    if (lastSyncedAt) {
      // Schedule next sync based on last sync time + interval
      const lastSyncTime = lastSyncedAt.getTime();
      nextSyncTime = lastSyncTime + intervalMs;

      // If we're already past the next sync time, sync immediately
      if (nextSyncTime <= now) {
        nextSyncTime = now;
      }
    } else {
      // Never synced before, sync immediately
      nextSyncTime = now;
    }

    const delay = Math.max(0, nextSyncTime - now);

    console.log(
      `Scheduling sync ${syncId} in ${Math.round(delay / 1000)}s (interval: ${
        intervalMs / 60000
      }min)`
    );

    const timer = setTimeout(() => {
      this.executeSync(syncId, intervalMs);
    }, delay);

    this.jobs.set(syncId, { syncId, nextSyncTime, intervalMs });
    this.timers.set(syncId, timer);
  }

  /**
   * Execute a sync job
   */
  private async executeSync(syncId: string, intervalMs: number) {
    console.log(`Executing auto-sync for ${syncId}`);

    try {
      // Call sync function with "auto" type
      const stats = await syncExternalCalendar(syncId, "auto");

      if (stats) {
        console.log(`Auto-sync completed for ${syncId}:`, stats);
      }
    } catch (error) {
      console.error(`Auto-sync error for ${syncId}:`, error);
    }

    // Schedule next sync
    this.scheduleJob(syncId, intervalMs, new Date());
  }

  /**
   * Remove a sync job
   */
  private removeJob(syncId: string) {
    const timer = this.timers.get(syncId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(syncId);
    }
    this.jobs.delete(syncId);
    console.log(`Removed sync job ${syncId}`);
  }

  /**
   * Manually trigger a sync (doesn't affect schedule)
   */
  async triggerSync(syncId: string) {
    console.log(`Manually triggering sync for ${syncId}`);

    try {
      // Call sync function with "manual" type
      const stats = await syncExternalCalendar(syncId, "manual");

      if (stats) {
        console.log(`Manual sync completed for ${syncId}:`, stats);

        // Reschedule based on new lastSyncedAt
        const job = this.jobs.get(syncId);
        if (job) {
          this.removeJob(syncId);
          this.scheduleJob(syncId, job.intervalMs, new Date());
        }

        return { stats };
      }

      return null;
    } catch (error) {
      console.error(`Manual sync error for ${syncId}:`, error);
      return null;
    }
  }

  /**
   * Cleanup orphaned syncs (syncs for calendars without owners)
   * This runs periodically to disable auto-sync for orphaned calendars
   */
  private async cleanupOrphanedSyncs() {
    // Only run cleanup when auth is enabled
    if (!isAuthEnabled()) {
      return;
    }

    // Prevent running cleanup too frequently (minimum 1 hour between runs)
    const now = Date.now();
    if (now - this.lastCleanupTime < 60 * 60 * 1000) {
      return;
    }

    this.lastCleanupTime = now;
    console.log("Running orphaned sync cleanup...");

    try {
      // Find all external syncs with auto-sync enabled that belong to orphaned calendars
      const results = await db
        .select({
          syncId: externalSyncs.id,
          syncName: externalSyncs.name,
          calendarId: externalSyncs.calendarId,
          ownerId: calendars.ownerId,
        })
        .from(externalSyncs)
        .leftJoin(calendars, eq(externalSyncs.calendarId, calendars.id))
        .where(gt(externalSyncs.autoSyncInterval, 0));

      // Filter for orphaned syncs (calendar exists but has no owner)
      const orphanedSyncs = results.filter(
        (r) => r.calendarId && r.ownerId === null
      );

      if (orphanedSyncs.length === 0) {
        console.log("No orphaned syncs found.");
        return;
      }

      console.log(`Found ${orphanedSyncs.length} orphaned sync(s) to disable`);

      // Disable auto-sync for orphaned calendars by setting interval to 0
      for (const orphanedSync of orphanedSyncs) {
        try {
          await db
            .update(externalSyncs)
            .set({
              autoSyncInterval: 0,
              updatedAt: new Date(),
            })
            .where(eq(externalSyncs.id, orphanedSync.syncId));

          console.log(
            `Disabled auto-sync for orphaned calendar: ${orphanedSync.syncName} (Calendar: ${orphanedSync.calendarId})`
          );

          // Remove from active jobs
          if (this.jobs.has(orphanedSync.syncId)) {
            this.removeJob(orphanedSync.syncId);
          }

          // TODO: Log to audit log when Admin Panel is implemented (Phase 9)
          // This will be tracked as: action: "sync.orphaned.disabled"
          // Metadata: { calendarId, syncName, reason: "calendar_has_no_owner" }
        } catch (error) {
          console.error(
            `Failed to disable sync ${orphanedSync.syncId}:`,
            error
          );
        }
      }

      console.log("Orphaned sync cleanup completed.");
    } catch (error) {
      console.error("Error during orphaned sync cleanup:", error);
    }
  }
}

// Singleton instance
export const autoSyncService = new AutoSyncService();
