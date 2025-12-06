/**
 * Auto-Sync Service for External Calendars
 * Runs in the background and periodically syncs calendars based on their autoSyncInterval
 * Supports iCloud, Google Calendar, and other iCal-based services
 */

import { db } from "@/lib/db";
import { externalSyncs } from "@/lib/db/schema";
import { gt, eq } from "drizzle-orm";
import { eventEmitter } from "@/lib/event-emitter";
import { syncExternalCalendar } from "@/app/api/external-syncs/[id]/sync/route";

interface SyncJob {
  syncId: string;
  nextSyncTime: number;
  intervalMs: number;
}

class AutoSyncService {
  private jobs: Map<string, SyncJob> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;
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
        .select()
        .from(externalSyncs)
        .where(gt(externalSyncs.autoSyncInterval, 0));

      // Remove jobs for syncs that were deleted or disabled
      for (const [syncId] of this.jobs) {
        if (!syncs.find((s) => s.id === syncId)) {
          this.removeJob(syncId);
        }
      }

      // Add or update jobs for active syncs
      for (const sync of syncs) {
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

        // Emit event to notify connected clients only if changes were made
        if (stats.created > 0 || stats.updated > 0 || stats.deleted > 0) {
          eventEmitter.emit("calendar-change", {
            type: "shift",
            action: "update",
            calendarId: stats.calendarId,
            data: { autoSync: true, syncId, stats },
          });
        }
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
}

// Singleton instance
export const autoSyncService = new AutoSyncService();
